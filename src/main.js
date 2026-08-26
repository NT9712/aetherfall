// AETHERFALL — bootstrap: renderer, world systems, player, game loop.

import * as THREE from 'three';
import { createTerrain } from './world/terrain.js';
import { createWater } from './world/water.js';
import { createSky, createClouds } from './world/sky.js';
import { createVegetation } from './world/vegetation.js';
import { createShards } from './world/shards.js';
import { createStones } from './world/stones.js';
import { buildHeightTexture, heightAt, SUN_DIR, PALETTE } from './world/heightfield.js';
import { createCharacter } from './player/character.js';
import { Controller } from './player/controller.js';
import { Input } from './core/input.js';
import { createMotes, createBursts, createBlobShadow } from './fx/particles.js';
import { createPost } from './fx/post.js';
import { createHUD } from './ui/hud.js';
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
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Strong aerial perspective 2014 distance separation is a major depth cue.
scene.fog = new THREE.Fog(PALETTE.fog, 55, 430);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1600);

// ---------------------------------------------------------------- lights
// Exposure discipline: with ACES tonemapping, a too-bright key light
// pushes mid-albedo into the compression knee and bleaches all colour.
const sun = new THREE.DirectionalLight(PALETTE.sunColor, 2.0);
sun.position.copy(SUN_DIR).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 2.2;
sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46;
// Depth precision: the light sits 130u from the target, so a tight
// near/far window keeps shadow-map depth resolution high. A 300-unit
// range here caused scene-wide self-shadow acne.
sun.shadow.camera.near = 74; sun.shadow.camera.far = 196;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
sun.shadow.camera.updateProjectionMatrix();
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
const vegetation = createVegetation(scene, heightTex);
const stones = createStones(scene);
const shards = createShards(scene);
const motes = createMotes(scene);
const bursts = createBursts(scene);
const playerBlob = createBlobShadow(scene);

// ---------------------------------------------------------------- player
const character = createCharacter(scene);
const input = new Input(renderer.domElement);
const controller = new Controller(camera, input, character);

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
  hud.setShards(0);
  hud.toast('Seek the pillars of light — they mark fallen shards', 4200);
  ambience.start();
  input.lock();
});

renderer.domElement.addEventListener('click', () => {
  if (started && !input.locked) input.lock();
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
window.__pump = (n = 30) => { for (let i = 0; i < n; i++) tick(); return window.__shardCount; };
window.__capture = (n = 2) => {
  for (let i = 0; i < n; i++) tick();
  return renderer.domElement.toDataURL('image/png');
};
window.__hideWater = () => { water.mesh.visible = false; };
window.__toggleShadows = (on) => { renderer.shadowMap.enabled = on; scene.traverse(o => { if (o.isMesh && o.material) { const m = Array.isArray(o.material)?o.material:[o.material]; m.forEach(x => x.needsUpdate = true); } }); };

// Dialogue interaction.
input.onInteract = () => {
  if (!started) return;
  if (hud.dialogueOpen) { hud.closeDialogue(); return; }
  const st = stones.nearest(controller.pos);
  if (st) {
    hud.openDialogue(st.name, st.text);
  }
};

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();

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
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (started) {
    controller.update(dt);

    // Shards pickup + finale.
    const picked = shards.update(t, dt, controller.pos);
    if (picked) {
      bursts.spawn(picked.x, picked.core.position.y + 1, picked.z);
      ambience.pickupSting();
      hud.setShards(shards.collectedCount);
      if (shards.collectedCount >= 7) {
        setTimeout(() => {
          if (!finaleShown) { finaleShown = true; hud.showFinale(); }
        }, 900);
      } else {
        hud.toast(`Aether Shard — ${7 - shards.collectedCount} remaining`, 2400);
      }
    }

    hud.setStamina(controller.stamina / 100);
    const st = hud.dialogueOpen ? null : stones.nearest(controller.pos);
    hud.setPrompt(st ? `[ E ]  Read ${st.name}` : null);

    // Sun shadow rig follows the player.
    sun.position.set(
      controller.pos.x + SUN_DIR.x * 130,
      controller.pos.y + SUN_DIR.y * 130,
      controller.pos.z + SUN_DIR.z * 130
    );
    sun.target.position.copy(controller.pos);
    sun.target.updateMatrixWorld();

    motes.update(t, controller.pos);
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
  vegetation.update(t, camera.position, started ? controller.pos : camera.position);
  stones.update(t);
  terrain.update(camera.position);

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
