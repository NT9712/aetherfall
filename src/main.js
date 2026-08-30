// AETHERFALL — bootstrap: renderer, world systems, player, game loop.

import * as THREE from 'three';
import { createTerrain } from './world/terrain.js';
import { createWater } from './world/water.js';
import { createSky, createClouds } from './world/sky.js';
import { createVegetation } from './world/vegetation.js';
import { createShards } from './world/shards.js';
import { createStones } from './world/stones.js';
import { createWorldProps } from './world/props.js';
import { WORLDS, FINALE } from './data/worlds.js';
import { ITEMS, dropItemFor } from './data/items.js';
import { missionFor } from './data/missions.js';
import { Inventory, Missions } from './player/missions.js';
import { createWildItems } from './world/itemsProps.js';
import { createTrader } from './world/trader.js';
import { buildHeightTexture, heightAt, SUN_DIR, PALETTE } from './world/heightfield.js';
import { createCharacter } from './player/character.js';
import { Controller } from './player/controller.js';
import { Input } from './core/input.js';
import { createMotes, createBursts, createBlobShadow } from './fx/particles.js';
import { createPost } from './fx/post.js';
import { createHUD } from './ui/hud.js';
import { Quality } from './core/quality.js';
import { Combat } from './player/combat.js';
import { CullingManager } from './core/culling.js';
import { Ambience } from './audio/ambience.js';

// ---------------------------------------------------------------- renderer
// QA mode (?qa=1) keeps the drawing buffer so automated art review can read
// pixels straight off the canvas, bypassing the compositor screenshot path.
const QA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('qa');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: QA,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// Accumulate draw stats across every pass of the frame (the composer would
// otherwise reset them between passes, hiding the real cost).
renderer.info.autoReset = false;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Strong aerial perspective 2014 distance separation is a major depth cue.
scene.fog = new THREE.Fog(PALETTE.fog, 40, 245);
// The initial world must apply its palette immediately: otherwise the terrain
// renders with its placeholder hexes instead of the intended look.
(() => {
  const p0 = WORLDS[0].palette;
  sky.applyPalette(p0);
  water.applyPalette(p0);
  terrain.applyPalette(p0);
  scene.fog.color.set(p0.fog);
  PALETTE.fog.set(p0.fog);
})();

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1600);

// ---------------------------------------------------------------- lights
// Exposure discipline: with ACES tonemapping, a too-bright key light
// pushes mid-albedo into the compression knee and bleaches all colour.
const sun = new THREE.DirectionalLight(PALETTE.sunColor, 2.0);
sun.position.copy(SUN_DIR).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 1.6;
sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46;
// Depth precision: the light sits 130u from the target, so a tight
// near/far window keeps shadow-map depth resolution high. A 300-unit
// range here caused scene-wide self-shadow acne.
sun.shadow.camera.near = 74; sun.shadow.camera.far = 196;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.022;
sun.shadow.camera.updateProjectionMatrix();
// Anything inside this radius of the player can cast into the shadow map, so
// the culler must keep it drawable even when it is behind the camera.
const SHADOW_RADIUS = 46 * Math.SQRT2 + 6;
scene.add(sun, sun.target);

// Restrained fill: too much hemisphere light erases shadows and
// flattens the whole image — the classic 'everything evenly lit' tell.
// Sky-tinted fill: shadowed areas should read as cool blue, never black.
scene.add(new THREE.HemisphereLight('#a8cbf5', '#6e7f4c', 0.48));

// ---------------------------------------------------------------- world
const heightTex = buildHeightTexture(256);
const sky = createSky(scene);
const clouds = createClouds(scene);
const terrain = createTerrain(scene);
const water = createWater(scene, heightTex);
const culler = new CullingManager();
const quality = new Quality({ onChange: (s) => applyQuality(s) });
const vegetation = createVegetation(scene, heightTex, culler, quality.settings());
const stones = createStones(scene);
for (const st of stones.items) culler.add(st.group, st.x, st.z, 12);
let propsState = createWorldProps(scene, WORLDS[0]);
for (const gate of propsState.gates) culler.add(gate.group, gate.x, gate.z, 12);

// Inventory + mission state (world-scoped).
const inventory = new Inventory();
let missions = new Missions(missionFor(WORLDS[0].id), inventory);
let wildItems = createWildItems(scene, WORLDS[0]);
let trader = createTrader(scene, WORLDS[0], makeWorldRng());
let maxHp = 100;
const shards = createShards(scene);
const motes = createMotes(scene);
const bursts = createBursts(scene);
const playerBlob = createBlobShadow(scene);

// ---------------------------------------------------------------- player
const character = createCharacter(scene);
const input = new Input(renderer.domElement);
const controller = new Controller(camera, input, character);
const combat = new Combat(scene, {
  getPlayer: () => controller.pos,
  onDeath: () => {
    input.unlock();
    hud.showDeath();
  },
  onKill: () => {
    missions.onKill();
    const drop = dropItemFor(WORLDS[worldIndex].id);
    inventory.add(drop, 1);
    hud.toast(`+1 ${ITEMS[drop].name}`, 1400);
    refreshInventory();
  },
});
// Provide a live player handle (position + facing) each update.
combat.focus = controller.pos;
Object.defineProperty(controller.pos, 'facing', {
  get: () => controller.facing, configurable: true });

// ---------------------------------------------------------------- post/ui/audio
const post = createPost(renderer, scene, camera);
const hud = createHUD();
const ambience = new Ambience();

// ---------------------------------------------------------------- state wiring
let started = false;
let finaleShown = false;

hud.showTitle(() => {
  started = true;
  controller.enabled = true;
  hud.enterWorld();
  hud.setGoal(WORLDS[worldIndex].sub);
  hud.setShards(0, WORLDS[worldIndex].shards.length);
  hud.setFinaleText(FINALE[WORLDS[worldIndex].id] || FINALE.aetherfall);
  hud.toast('Seek the pillars of light — they mark fallen shards', 4200);
  ambience.start();
  input.lock();
});

renderer.domElement.addEventListener('click', () => {
  if (started && !input.locked) input.lock();
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !started || paused) return;
  if (!input.locked) { input.lock(); return; }
  combat.swing();
});


input.onGliderToggle = () => {
  if (!started || hud.dialogueOpen) return;
  if (!controller.grounded && !controller.gliding && controller.stamina > 5) {
    controller.gliding = true;
  } else if (controller.gliding) {
    controller.gliding = false;
  }
};

let muted = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && ambience.ctx) {
    muted = !muted;
    const on = ambience.toggle();
    hud.toast(on ? '♪ Ambience on' : 'Ambience off', 1400);
  }
});

// ---------------------------------------------------------------- QA hooks
// Used by tools/ for automated art review and smoke tests. Headless Chrome
// starves requestAnimationFrame, so __pump steps the sim deterministically
// and __capture reads pixels straight off the canvas.
window.__teleport = (x, z) => {
  controller.pos.set(x, heightAt(x, z), z);
  controller.vy = 0;
  controller.velH.set(0, 0);
  controller.grounded = true;
  controller.gliding = false;
};
Object.defineProperty(window, '__shardCount', { get: () => shards.collectedCount });
Object.defineProperty(window, '__gliding', { get: () => controller.gliding });
window.__zoom = (d) => { controller.camDist = d; };
window.__look = (yaw, pitch) => {
  if (yaw !== undefined) controller.camYaw = yaw;
  if (pitch !== undefined) controller.camPitch = pitch;
};
window.__shardDebug = () => shards.group.children.map((c, i) => ({
  i,
  x: +c.position.x.toFixed(1),
  y: +c.position.y.toFixed(1),
  z: +c.position.z.toFixed(1),
  visible: c.visible,
  scale: +c.scale.x.toFixed(2),
})).concat([{ player: { x: +controller.pos.x.toFixed(1), y: +controller.pos.y.toFixed(1), z: +controller.pos.z.toFixed(1) } }]);
// Deterministic frame pump for headless QA (RAF is compositor-starved there).
window.__pump = (n = 30, step = 1 / 60) => {
  fixedDt = step;                       // deterministic: no 1000fps illusion
  for (let i = 0; i < n; i++) tick();
  fixedDt = null;
  return window.__shardCount;
};
window.__setAuto = (on) => { quality.setAuto(on); hud.setAutoChecked(on); };
window.__setQuality = (i, v) => { quality.setAuto(false); hud.setAutoChecked(false); quality.setLevel(i, v); };
window.__capture = (n = 2) => {
  for (let i = 0; i < n; i++) tick();
  return renderer.domElement.toDataURL('image/png');
};
window.__hideWater = () => { water.mesh.visible = false; };
window.__gameState = () => ({
  inv: Object.fromEntries(inventory.amounts),
  maxHp,
  combatHp: combat.health,
  mission: { hasActive: missions.hasActive, done: missions.done,
             progress: missions.progress(), canAccept: missions.canAccept(), satisfied: missions.fulfilled() },
});
window.__worldInfo = () => ({
  index: worldIndex, id: WORLDS[worldIndex].id, name: WORLDS[worldIndex].name,
  shardLen: WORLDS[worldIndex].shards.length,
  stones: stones.items.length,
  shardCount: shards.collectedCount,
  fog: '#' + scene.fog.color.getHexString(),
  sky: '#' + sky.material.uniforms.uZenith.value.getHexString(),
  spawn: [WORLDS[worldIndex].spawn[0], WORLDS[worldIndex].spawn[1]],
  player: [Math.round(controller.pos.x), Math.round(controller.pos.z)],
});
window.__jumpWorld = (i) => setWorld(i);
window.__gift = (id, n) => { inventory.add(id, n); refreshInventory(); };
window.__acceptMission = () => { const ok = missions.accept(); refreshMission(); return ok; };
window.__kill = () => {
  missions.onKill();
  const drop = dropItemFor(WORLDS[worldIndex].id);
  inventory.add(drop, 1);
  refreshInventory();
};
window.__turnIn = () => {
  const reward = missions.turnIn();
  if (reward) { maxHp += reward.maxHp || 0; combat.health = maxHp; refreshInventory(); refreshMission(); }
  return reward && { name: reward.name, maxHp };
};
window.__playerState = () => ({
  x: controller.pos.x, y: controller.pos.y, z: controller.pos.z,
  facing: controller.facing, grounded: controller.grounded,
  vx: controller.velH.x, vz: controller.velH.y,
});
window.__cullStats = () => ({
  ...culler.stats,
  grassDrawn: vegetation.stats.drawn,
  grassChunks: vegetation.stats.chunks,
  triangles: renderer.info.render.triangles,
  calls: renderer.info.render.calls,
});
window.__setOcclusion = (on) => { culler.occlusionEnabled = on; };
window.__setCulling = (on) => {
  culler.enabled = on;
  if (!on) for (const s of culler.sectors.values()) for (const m of s.meshes) m.visible = true;
};
window.__toggleShadows = (on) => { renderer.shadowMap.enabled = on; scene.traverse(o => { if (o.isMesh && o.material) { const m = Array.isArray(o.material)?o.material:[o.material]; m.forEach(x => x.needsUpdate = true); } }); };

// Dialogue interaction.
input.onInteract = () => {
  if (!started) return;
  if (hud.dialogueOpen) { hud.closeDialogue(); return; }
  if (hud.missionOpen) { hud.closeMission(); return; }
  if (hud.worldSelectOpen) { hud.closeWorldSelect(); return; }
  // Embergate first: the door to other worlds.
  const gate = nearestGate();
  if (gate && Math.hypot(controller.pos.x - gate.x, controller.pos.z - gate.z) < 4.0) {
    hud.openWorldSelect(WORLDS, WORLDS[worldIndex].id);
    return;
  }
  // Then the wandering merchant (missions).
  if (Math.hypot(controller.pos.x - trader.x, controller.pos.z - trader.z) < 3.6) {
    hud.openMission(missions.def, {
      canAccept: missions.canAccept(),
      canTurnIn: missions.fulfilled() && !!missions.active,
      ready: missions.fulfilled(),
    });
    return;
  }
  const st = stones.nearest(controller.pos);
  if (st) {
    hud.openDialogue(st.name, st.text);
  }
};
function nearestGate() {
  let best = null, bestD = 4.0;
  for (const g of propsState.gates) {
    const d = Math.hypot(controller.pos.x - g.x, controller.pos.z - g.z);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}

function makeWorldRng() {
  let s = (WORLDS[worldIndex] ? WORLDS[worldIndex].id.length : 1) * 918273;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- worlds
let worldIndex = 0;
function setWorld(i) {
  worldIndex = ((i % WORLDS.length) + WORLDS.length) % WORLDS.length;
  const w = WORLDS[worldIndex];
  const p = w.palette;

  // Recolour the shared shaders.
  sky.applyPalette(p);
  water.applyPalette(p);
  terrain.applyPalette(p);
  scene.fog.color.set(p.fog);
  PALETTE.fog.set(p.fog);

  // Swap the journey content.
  stones.rebuild(w.stones);
  shards.rebuild(w.shards);
  for (const st of stones.items) culler.add(st.group, st.x, st.z, 12);
  hud.setShards(0);
  hud.setGoal(w.sub);
  started && hud.enterWorld();

  combat.rebuild(w);
  combat.density = quality.levels[1];

  // Rebuild world-scoped items + missions + trader.
  for (const w of wildItems.items) scene.remove(w.group);
  wildItems = createWildItems(scene, w);
  scene.remove(trader.group);
  trader = createTrader(scene, w, makeWorldRng());
  missions.setWorld(missionFor(w.id));
  missions.done = false;
  inventory.amounts.clear();
  maxHp = 100;
  refreshInventory(); refreshMission();
  hud.closeMission();

  // Rebuild world props (arch, fire, posts).
  for (const g of propsState.gates) scene.remove(g.group);
  for (const g of propsState.ambients) scene.remove(g.group);
  propsState = createWorldProps(scene, w);
  for (const gate of propsState.gates) culler.add(gate.group, gate.x, gate.z, 12);

  // Move the player and refill health.
  combat.health = maxHp;
  controller.pos.set(w.spawn[0], heightAt(w.spawn[0], w.spawn[1]), w.spawn[1]);
  controller.vy = 0; controller.velH.set(0, 0);

  finaleShown = false;
  // Announce.
  if (started) hud.toast(`Arrived at ${w.name} — ${w.tagline}`, 4200);
  if (started) {
    const f = FINALE[w.id];
    if (f) hud.setFinaleText(f);
  }
}

hud.onWorldPick((i) => setWorld(i));

// ---------------------------------------------------------------- pause
let paused = false;

function setPaused(on) {
  if (paused === on || !started) return;
  paused = on;
  if (on) {
    input.keys.clear();            // don't resume mid-stride on a held key
    input.unlock();
    hud.setMuteLabel(!muted);
    hud.openPause(shards.collectedCount, WORLDS[worldIndex].shards.length);
    ambience.ctx?.suspend?.();
  } else {
    hud.closePause();
    ambience.resume();
    input.lock();                  // the click that resumed counts as a gesture
  }
}

hud.onResumeClick(() => setPaused(false));
hud.onTitleClick(() => location.reload());
hud.onMuteClick(() => {
  muted = !ambience.toggle();
  hud.setMuteLabel(!muted);
});

// Browsers reserve Escape to release pointer lock and swallow the keydown, so
// losing the lock is the reliable pause signal. Ignore the release we perform
// ourselves when opening a menu.
document.addEventListener('pointerlockchange', () => {
  if (!started || paused) return;
  if (finaleShown) return;         // the finale panel wants the cursor free
  if (document.pointerLockElement !== renderer.domElement && !hud.dialogueOpen) {
    setPaused(true);
  }
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || !started || finaleShown) return;
  e.preventDefault();
  setPaused(!paused);
});

function refreshInventory() {
  const list = [...inventory.amounts.entries()].map(([id, n]) => {
    const it = ITEMS[id];
    return { glyph: it ? it.glyph : '?', color: it ? it.color : '#ffffff', n };
  });
  hud.setInventory(list);
}
function refreshMission() {
  const pr = missions.progress();
  if (pr && missions.active) {
    const parts = Object.entries(pr).map(([k, v]) => {
      const label = k === 'wraiths' ? 'Wraiths' : (ITEMS[k] ? ITEMS[k].name : k);
      return `${label} ${v}`;
    });
    hud.setMissionLine(`${missions.active.title}  ·  ${parts.join('  ·  ')}`);
  } else {
    hud.setMissionLine(null);
  }
}

hud.onMissionAccept(() => {
  if (missions.accept()) { refreshMission(); hud.toast('Mission accepted', 1400); }
  hud.closeMission();
});
hud.onMissionTurnIn(() => {
  const reward = missions.turnIn();
  if (reward) {
    maxHp += reward.maxHp || 0;
    combat.health = maxHp;
    hud.toast(`${reward.name} — max health ${maxHp}`, 3200);
    refreshInventory(); refreshMission();
  }
  hud.closeMission();
});
hud.onReviveClick(() => {
  combat.resetHealth();
  combat.health = maxHp;
  hud.hideDeath();
  controller.pos.set(WORLDS[worldIndex].spawn[0], heightAt(WORLDS[worldIndex].spawn[0], WORLDS[worldIndex].spawn[1]), WORLDS[worldIndex].spawn[1]);
  controller.velH.set(0, 0); controller.vy = 0;
  input.lock();
});

// Slider + adaptive wiring.
hud.onQualityChange((i, v) => { quality.setAuto(false); hud.setAutoChecked(false); quality.setLevel(i, v); });
hud.onAutoChange((on) => quality.setAuto(on));
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); hud.toggleSettings(); }
});

// ------------------------------------------------------------- quality apply
function applyQuality(cfg, levels = [3, 3, 3]) {
  // Distance: fog band + sector cull ring.
  scene.fog.near = cfg.distance.fogNear;
  scene.fog.far = cfg.distance.fogFar;
  culler.cullDistance = cfg.distance.cull;
  for (const m of [water.mesh, ...(vegetation.meshes || [])]) {
    const u = m && m.material && m.material.uniforms;
    if (u && u.uFogNear) { u.uFogNear.value = cfg.distance.fogNear; u.uFogFar.value = cfg.distance.fogFar; }
  }

  // Effects: resolution scale, shadows, bloom, particles.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.effects.pixelRatio));

  // Toggling shadows requires recompiling materials: USE_SHADOWMAP is baked
  // into the program at compile time, so flipping the flag alone leaves every
  // existing shader on the old code path (shadows vanish, or stale shadows
  // linger, until something else happens to trigger a rebuild).
  if (renderer.shadowMap.enabled !== cfg.effects.shadows) {
    renderer.shadowMap.enabled = cfg.effects.shadows;
    renderer.shadowMap.needsUpdate = true;
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) m.needsUpdate = true;
    });
  }
  if (sun.shadow.mapSize.x !== cfg.effects.shadowMap) {
    sun.shadow.mapSize.set(cfg.effects.shadowMap, cfg.effects.shadowMap);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.shadowMap.needsUpdate = true;
  }
  post.bloom.enabled = cfg.effects.bloom;
  motes.setDensity(cfg.effects.motes);

  // Density: shrink live instance counts and thin the wraiths that spawn.
  vegetation.setDensity(cfg.density);
  if (combat) combat.density = levels[1];
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let simTime = 0;
let fixedDt = null;         // QA: pump frames at a fixed step

function frame() {
  requestAnimationFrame(frame);
  window.__rafCount = (window.__rafCount || 0) + 1;
  try {
    tick();
  } catch (e) {
    if (!window.__frameError) window.__frameError = String(e && e.stack || e);
    console.error('FRAME ERROR:', e);
  }
}

function tick() {
  renderer.info.reset();
  const raw = Math.min(clock.getDelta(), 0.05);
  let dt = fixedDt !== null ? fixedDt : raw;
  // Paused: hold world time still so wind, water and animation freeze, but
  // keep drawing so the menu sits over a live frame.
  if (paused) dt = 0;
  simTime += dt;
  const t = simTime;

  if (started && !paused) {
    controller.update(dt);

    // Shards pickup + finale.
    const picked = shards.update(t, dt, controller.pos);
    if (picked) {
      bursts.spawn(picked.x, picked.core.position.y + 1, picked.z);
      ambience.pickupSting();
      hud.setShards(shards.collectedCount, WORLDS[worldIndex].shards.length);
      const need = WORLDS[worldIndex].shards.length;
      if (shards.collectedCount >= need) {
        setTimeout(() => {
          if (!finaleShown) {
            finaleShown = true;
            input.unlock();        // release the cursor so the panel is clickable
            hud.showFinale();
          }
        }, 900);
      } else {
        hud.toast(`Shard recovered — ${need - shards.collectedCount} remaining`, 2400);
      }
    }

    const pickedWild = wildItems.update(t, controller.pos);
    if (pickedWild) {
      inventory.add(pickedWild.itemId, 1);
      hud.toast(`+1 ${ITEMS[pickedWild.itemId].name}`, 1400);
      refreshInventory();
    }
    refreshMission();

    hud.setStamina(controller.stamina / 100);
    if (!hud.dialogueOpen && !hud.worldSelectOpen) {
      const gate = nearestGate();
      const nearGate = gate && Math.hypot(controller.pos.x - gate.x, controller.pos.z - gate.z) < 4.0;
      const st = stones.nearest(controller.pos);
      hud.setPrompt(nearGate ? '[ E ]  Cross the Embergate' : (st ? `[ E ]  Read ${st.name}` : null));
    }

    // Sun shadow rig follows the player.
    sun.position.set(
      controller.pos.x + SUN_DIR.x * 130,
      controller.pos.y + SUN_DIR.y * 130,
      controller.pos.z + SUN_DIR.z * 130
    );
    sun.target.position.copy(controller.pos);
    sun.target.updateMatrixWorld();

    motes.update(t, controller.pos);
    culler.update(camera, camera.position, controller.pos, SHADOW_RADIUS);
    const hp = combat.update(dt, controller.pos);
    hud.setHP(hp / 100);
    const aliveEnemies = combat.pool.filter((p) => p.enabled).length;
    hud.setEnemyTally(aliveEnemies, combat.active ? combat.maxEnemies : 0);
    playerBlob.update(controller.pos, heightAt(controller.pos.x, controller.pos.z));

    // Finale aurora: sky warms as reward.
    if (finaleShown) {
      const k = Math.min(1, t * 0.05 % 1);
      void k;
      bloomLift(post.bloom);
    }
  }

  clouds.tick(dt);
  sky.tick(t);
  water.update(t, camera.position);
  vegetation.update(t, camera.position, started ? controller.pos : camera.position,
    camera, quality.settings().distance.cull);
  stones.update(t);
  terrain.update(camera.position);

  quality.update(dt);
  hud.setPerf(quality.fps, quality.levels, culler.stats, vegetation.stats,
    renderer.info.render.triangles, renderer.info.render.calls);

  input.endFrame();
  post.render();
}

// Gentle bloom swell after the finale.
function bloomLift(bloom) {
  bloom.strength += (0.62 - bloom.strength) * 0.01;
}

frame();
window.__hideGrass = () => { vegetation.mesh.visible = false; };
window.__hideGrass = () => { vegetation.mesh.visible = false; };
window.__hideTerrain = () => { terrain.mesh.visible = false; };
window.__hideChar = () => { character.root.visible = false; };
window.__hideClouds = () => { clouds.visible = false; };
window.__hideMotes = () => { motes.points.visible = false; };
window.__showWater = () => { water.mesh.visible = true; };
window.__showGrass = () => { vegetation.mesh.visible = true; };
