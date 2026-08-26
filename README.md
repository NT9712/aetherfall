# AETHERFALL — Whispers of the Sunken Starlace

A third-person open-world adventure vignette built in **Three.js**, in the
stylized cel-shaded tradition of Genshin Impact. No external art assets —
every mesh, texture, shader and note of music is generated procedurally at
runtime.

**▶ Play: https://aetherfall-seven.vercel.app**
**◆ Source: https://github.com/NT9712/aetherfall**

## Run it

**One-liner — single self-contained file, no server, no install:**

```bash
xdg-open ~/aetherfall.html          # Linux
open ~/aetherfall.html              # macOS
```

That file (`dist/aetherfall.html`, 570 KB) has Three.js, every addon, all game
modules and the CSS inlined. Double-clicking it works too. It runs fully
offline — only the web fonts come from the network, and there are serif
fallbacks if they're unavailable.

If your browser restricts `file://`, serve it instead:

```bash
npx --yes serve ~/projects/aetherfall/dist
```

**Development (unbundled ES modules):**

```bash
cd ~/projects/aetherfall
npm run serve        # http://localhost:8787
npm run build        # rebuild dist/aetherfall.html
npm run verify       # headless smoke test of the single file
```

Requires a browser with WebGL2.

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move (camera-relative) |
| `Shift` | Sprint (drains stamina) |
| `Space` | Jump — press again mid-fall to deploy the wind glider |
| `E` | Read ancient steles / close dialogue |
| `Mouse` | Look (click to capture pointer) · `Wheel` zoom |
| `M` | Toggle ambience |
| `Tab` | Graphics settings |

## The game

Seven shards of the **Starlace** fell onto Aetherfall Isle. Each is marked by
a beacon of light visible across the island. Collect all seven to re-weave the
sky. Four weathered steles tell the story of Lyra the Skyward and the
Sundering.

## Rendering: chunked visibility culling

The world is partitioned into 34m sectors, Minecraft-style. Every frame each
sector runs a gauntlet of increasingly expensive tests and is rejected as early
as possible:

1. **Distance** — outside the render-distance ring
2. **Frustum** — outside the camera's view volume
3. **Occlusion** — line of sight blocked by terrain. The eye→sector segment is
   marched looking for ground standing above the ray; two hits are required so
   heightmap noise can't produce false positives.

Static props (trees, canopies, shrubs, rocks, contact shadows, flowers) are
merged **per sector** rather than into one island-wide batch, so rejecting a
sector removes its entire polygon batch with a single visibility flag — the GPU
never sees those triangles. Grass is 36 chunk meshes; its toroidal wrap is a
per-chunk uniform so each chunk keeps a tight bounding sphere that can actually
be frustum-tested.

Measured at the spawn vantage:

| | culling off | culling on |
|---|---|---|
| triangles | 1,197k | **939k** (−21.5%) |
| draw calls | 717 | **428** |
| sectors drawn | 70/70 | **25/70** |

Occlusion alone rejects 5 sectors per frame that survive the frustum test.

## Quality: three sliders, FPS-adaptive

`Tab` opens a graphics panel with three sliders, each a five-step ladder from
Potato to Ultra:

- **Render Distance** — sector cull ring, fog band, grass reach
- **Vegetation Density** — grass / flower / shrub instance budgets
- **Effects Quality** — bloom, shadow map size, pixel ratio, particle budget

An adaptive controller samples a rolling FPS average and walks the levels to
hold 60fps. It smooths asymmetrically (fast to react to drops, slow to claim
gains) so a momentary stall doesn't yank quality, sheds the most expensive
setting first, and uses hysteresis plus a cooldown so it can't oscillate.
Touching a slider switches adaptive off; while it's on, the sliders track it.

Settings retune the live scene rather than rebuilding it. Covered by
`tools/quality-test.mjs`:

```
PASS  30 fps sustained downshifts from High        -> [0,0,0]
PASS  144 fps sustained upshifts toward Ultra      -> [4,4,4]
PASS  60 fps steady holds its levels               -> [3,3,3]
PASS  effects shed before density                  -> [2,3,0]
PASS  manual mode ignores framerate                -> [3,0,3]
```

## Architecture

```
src/
  main.js              bootstrap, lighting rig, game loop, quest wiring
  core/noise.js        seeded value-noise / fbm / ridged fractal toolkit
  core/culling.js      sector partitioning + distance/frustum/occlusion tests
  core/quality.js      quality ladders, FPS meter, adaptive controller
  core/input.js        keyboard + pointer-lock mouse
  data/lore.js         world text, stele inscriptions, shard placements
  world/heightfield.js single source of truth for island shape (+ baked
                       height texture consumed by the water shader)
  world/terrain.js     CPU-displaced island; MeshToonMaterial with an
                       onBeforeCompile injection that blends sand → meadow →
                       cliff strata → snowcap by height/slope, keeping real
                       shadow-map receiving
  world/water.js       turquoise depth ramp, animated procedural normals,
                       heightmap-driven shore foam, fresnel sky reflection,
                       clamped sun glitter
  world/sky.js         gradient dome with sun disc/halo + drifting clouds
  world/vegetation.js  95k instanced wind-swept grass blades, merged toon
                       forests and boulders, contact blobs
  world/shards.js      collectibles, beacon pillars, pickup handling
  world/stones.js      lore steles with pulsing runes
  player/character.js  primitive-built anime protagonist: cel shading, ink
                       outlines, procedural idle/run/sprint/jump/glide,
                       draped scarf and swaying braid
  player/controller.js movement states, stamina, gliding, camera collision
  fx/particles.js      ambient motes, collect bursts, blob shadows
  fx/post.js           bloom + color grade + tonemap/output chain
  ui/hud.js            title, quest tracker, stamina, prompts, typewriter
                       dialogue, finale
  audio/ambience.js    generative pad + pentatonic chimes with feedback delay
```

## Visual critic loop

`tools/critic.mjs` is an automated art director. It renders fixed vantages
(`tools/review-render.mjs`) and scores each frame on flat/untextured area,
edge density, luminance contrast, saturation, hue variety, highlight/shadow
clipping, tonal spread and atmospheric depth — thresholds calibrated to
stylized-open-world reference frames. It rejects frames without mercy:

```bash
node tools/review-render.mjs      # render the review vantages
node tools/critic.mjs review/*.png
```

Iterating against it took the meadow vantage from **REJECT** to **PASS**:

| metric | before | after |
|---|---|---|
| flat / untextured area | 0.547 | **0.159** |
| edge + detail density | 0.324 | **0.656** |
| saturation | 0.312 | **0.396** |
| atmospheric depth | 0.025 | **0.030** |

What the loop forced to be rebuilt:

- **Grass** — was ~1 blade/m² sprinkled over the whole island (confetti). Now a
  camera-following field: 150k blades wrapped toroidally around the player in
  the vertex shader, height and slope fetched from the terrain heightmap,
  blades on cliffs/sand/water collapsing to zero scale. ~16 blades/m² where it
  counts, with travelling gust fronts and real shadow reception.
- **Character** — rebuilt at ~6.5-head heroic-anime proportion: layered hair
  (cap, back mass, distinct brow locks, side sweeps, braid), a face that reads
  at distance (iris, pupil, specular, lash line, brows, blush), panelled coat
  skirt, sleeve caps, boot cuffs, counter-rotating torso, head stabilisation
  and blinking.
- **Terrain** — detail-normal perturbation, cavity AO, dirt trails, and
  procedural ground-cover texture so distance doesn't read as flat paint.
- **Sky** — billboard cloud sprites replaced with a procedural two-layer fbm
  cloud field with domain warping and sun-side silver lining.
- **Trees** — branched trunks with root flare and clustered canopy lobes with
  built-in vertical AO, instead of lollipop blobs. Plus a shrub layer, the
  missing mid-scale element between grass and trees.
- **Steles** — tapered obelisks with stepped plinths, chiselled caps, gold
  finials, foundation rubble and moss, instead of brown boxes.

### Performance notes

`heightAt()` evaluates several octaves of fbm and costs ~8.6us. That is fine
for gameplay queries, but per-frame systems that probe terrain hundreds of
times cannot afford it -- occlusion culling alone was spending 7.86ms/frame,
47% of a 60fps budget. `heightAtFast()` reads a bilinear lookup table filled
during the heightmap bake (0.6us, 0.127m mean error), taking occlusion to
0.55ms.

Sector culling deliberately retains sectors that contain shadow casters when
they fall inside the sun's shadow volume, even if the camera rejects them --
otherwise objects beside or behind the camera stop casting shadows into view.

### Bugs the loop exposed

1. **Broken toon ramp** — `makeGradientMap()` was called with no argument, so
   `new Uint8Array(undefined)` produced a zero-length array and a 0-width
   texture. The terrain had been sampling a degenerate ramp the whole time:
   3× too dark, and cast shadows only darkened it 7% instead of 48%.
2. **Shadow acne** — a 300-unit shadow-camera depth range for a ~50-unit scene
   destroyed depth precision. Tightened to a 74–196 window around the light.
3. **Over-exposure** — a 3.1-intensity key light pushed mid albedo into the
   ACES compression knee and bleached all colour; contrast had collapsed to
   0.132. Rebalanced with a sky-tinted fill so shadows read cool, not black.
4. **HDR fireflies** — unclamped water specular fed the bloom pass.
5. **Unclamped particle size** — size-attenuated motes could fill the screen.
6. **Stale shadow shaders** — `USE_SHADOWMAP` is compiled into the program, so
   toggling `renderer.shadowMap.enabled` without marking materials dirty left
   shadows broken after the adaptive controller changed the effects level.
7. **Culled shadow casters** — frustum-rejected sectors also disappear from the
   shadow pass, deleting shadows cast from off-screen.
8. **Bound clamp scaled Y** — `Vector3.multiplyScalar` on the island boundary
   shrank the player's height, dragging them down while held against the ring.
9. **Inert density slider** — the preset was only read at construction.

### Test suite

```bash
node tools/move-unit.mjs      # controller: directions, speed, bounds, glide
node tools/quality-test.mjs   # adaptive quality ladder behaviour
node tools/verify-lean.mjs    # end-to-end: 7 shards, finale, no errors
node tools/cull-test.mjs      # culling: triangles/draw calls saved
node tools/critic.mjs review/*.png
```

## Verification

Automated headless QA lives in `tools/`. The page exposes QA hooks
(`__pump`, `__teleport`, `__look`, `__shardCount`, `__hide*`) because headless
Chrome starves `requestAnimationFrame` — `__pump(n)` steps the simulation
deterministically.

Verified:

- **Live production site** (`verify-live.mjs`): loads, WebGL canvas active,
  all 7 shards collect, finale triggers, zero console/page/frame errors
- No shader compile errors, page errors or frame exceptions (`final-check.mjs`)
- All 7 shards collect and the finale triggers (`finale-logic.mjs`)
- Single-file offline build runs from `file://` (`verify-single.mjs`)
- Visual passes on: title screen, spawn meadow, character (front/back/profile),
  dialogue, shard pickup FX + HUD, snow mountains, ocean, shoreline

Two genuine rendering bugs were found and fixed by the review loop:

1. **HDR fireflies** — unclamped water specular/sparkle fed the bloom pass,
   producing colored fringe artifacts on bright ripples.
2. **Unclamped particle size** — ambient motes used size-attenuated points, so
   a mote drifting near the lens became a screen-filling additive flash
   (`gl_PointSize` scales as 1/z). Now clamped with a near-camera fade.

## Deployment

Static single-file deploy on Vercel (project `aetherfall`):

```bash
npm run build                                # produces dist/index.html
cp dist/index.html ~/deploy/aetherfall/
cd ~/deploy/aetherfall && vercel deploy --prod --yes
```

One self-contained HTML file is served — no build step, no framework
detection, no runtime dependencies.

Known environment limitation: the software rasterizer (SwiftShader) used in
this container cannot sustain the shoreline vantage (large alpha-blended
cloud sprites + transparent water + bloom) and crashes its GPU process there.
This is a fill-rate ceiling of the software renderer, not a defect in the
scene — the same vantage renders when cloud/mote layers are toggled off.
