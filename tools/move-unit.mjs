// Movement unit test: drives the real Controller with stubbed input,
// camera and character, so it needs no browser and no GPU.
import * as THREE from 'three';
import { Controller } from '../src/player/controller.js';

function makeRig() {
  const held = new Set();
  const input = {
    keys: held,
    isDown: (k) => held.has(k),
    wasPressed: () => false,
    consumeMouse: () => ({ dx: 0, dy: 0 }),
    consumeWheel: () => 0,
  };
  const character = {
    setPosition() {}, setYaw() {}, setGliding() {}, update() {},
  };
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1600);
  const c = new Controller(camera, input, character);
  c.enabled = true;
  return { c, held };
}

function run(yaw, keys, steps = 90, dt = 1 / 60) {
  const { c, held } = makeRig();
  c.camYaw = yaw;
  c.camPitch = 0.3;
  const start = c.pos.clone();
  for (const k of keys) held.add(k);
  for (let i = 0; i < steps; i++) c.update(dt);
  return { d: c.pos.clone().sub(start), facing: c.facing, c };
}

const V = (x, z) => `(${x.toFixed(2)},${z.toFixed(2)})`;
let pass = true;
const near = (a, b, tol = 0.09) => Math.abs(a - b) <= tol;

console.log('MOVEMENT DIRECTION');
for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const s = Math.sin(yaw), co = Math.cos(yaw);
  const expect = {
    KeyW: [-s, -co], KeyS: [s, co], KeyD: [co, -s], KeyA: [-co, s],
  };
  for (const [key, [ex, ez]] of Object.entries(expect)) {
    const { d } = run(yaw, [key]);
    const len = Math.hypot(d.x, d.z) || 1;
    const gx = d.x / len, gz = d.z / len;
    const ok = near(gx, ex) && near(gz, ez) && len > 1;
    pass = pass && ok;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} yaw ${String(Math.round(yaw * 180 / Math.PI)).padStart(4)}°` +
      ` ${key.slice(3)}  got ${V(gx, gz)} want ${V(ex, ez)}  moved ${len.toFixed(2)}m`);
  }
}

console.log('\nDIAGONAL SPEED (must not exceed straight-line speed)');
{
  const straight = run(0, ['KeyW']).d.length();
  const diag = run(0, ['KeyW', 'KeyD']).d.length();
  const ok = diag <= straight * 1.02;
  pass = pass && ok;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} straight ${straight.toFixed(2)}m  diagonal ${diag.toFixed(2)}m` +
    `  ratio ${(diag / straight).toFixed(3)}`);
}

console.log('\nFACING follows travel direction');
for (const yaw of [0, Math.PI / 2]) {
  const { d, facing } = run(yaw, ['KeyW']);
  const travel = Math.atan2(d.x, d.z);
  let diff = Math.abs(((facing - travel + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const ok = diff < 0.2;
  pass = pass && ok;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} yaw ${Math.round(yaw * 180 / Math.PI)}°  ` +
    `facing ${facing.toFixed(2)} travel ${travel.toFixed(2)} delta ${diff.toFixed(3)}`);
}

console.log('\nOPPOSITE KEYS cancel');
{
  const { d } = run(0, ['KeyW', 'KeyS']);
  const ok = d.length() < 0.35;
  pass = pass && ok;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} W+S drift ${d.length().toFixed(3)}m`);
}

console.log('\nSPRINT is faster than walk');
{
  const walk = run(0, ['KeyW']).d.length();
  const sprint = run(0, ['KeyW', 'ShiftLeft']).d.length();
  const ok = sprint > walk * 1.15;
  pass = pass && ok;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} walk ${walk.toFixed(2)}m  sprint ${sprint.toFixed(2)}m`);
}

console.log('\nEDGE CASES');
{
  // Island bound: walking outward must clamp horizontally without warping Y.
  const { c, held } = makeRig();
  c.camYaw = 0; c.pos.set(0, 0, 0);
  c.pos.set(200, 24, 40);                    // near the clamp ring, high up
  const y0 = c.pos.y;
  held.add('KeyS');                          // push outward (+z at yaw 0)
  for (let i = 0; i < 30; i++) c.update(1 / 60);
  const r = Math.hypot(c.pos.x, c.pos.z);
  const okR = r <= 206;
  console.log(`  ${okR ? 'PASS' : 'FAIL'} bound clamp radius ${r.toFixed(1)} (<=206)`);
  pass = pass && okR;
}
{
  // Shoreline: repeatedly pushing into deep water must not oscillate.
  const { c, held } = makeRig();
  c.camYaw = 0;
  c.pos.set(30, 0.5, -150);                  // south beach
  held.add('KeyS');                          // walk out to sea
  const xs = [];
  for (let i = 0; i < 120; i++) { c.update(1 / 60); xs.push(c.pos.z); }
  let flips = 0;
  for (let i = 2; i < xs.length; i++) {
    const a = Math.sign(xs[i] - xs[i - 1]), b = Math.sign(xs[i - 1] - xs[i - 2]);
    if (a !== 0 && b !== 0 && a !== b) flips++;
  }
  const okJ = flips < 12;
  console.log(`  ${okJ ? 'PASS' : 'FAIL'} shoreline direction flips: ${flips} (<12 = no jitter)`);
  pass = pass && okJ;
}
{
  // Jump then glide.
  const { c, held } = makeRig();
  c.input.wasPressed = (k) => k === 'Space' && c._testJump;
  c._testJump = true; c.update(1 / 60); c._testJump = false;
  const airborne = !c.grounded && c.vy > 0;
  for (let i = 0; i < 40; i++) c.update(1 / 60);
  c._testJump = true; c.update(1 / 60); c._testJump = false;
  const gliding = c.gliding;
  let minVy = 0;
  for (let i = 0; i < 30; i++) { c.update(1 / 60); minVy = Math.min(minVy, c.vy); }
  const okG = airborne && gliding && minVy > -3;
  console.log(`  ${okG ? 'PASS' : 'FAIL'} jump->glide (airborne ${airborne}, gliding ${gliding}, vy>=${minVy.toFixed(2)})`);
  pass = pass && okG;
}
{
  // Uphill walking must still make progress.
  const { c, held } = makeRig();
  c.camYaw = Math.PI; c.pos.set(-50, 0, 40);
  held.add('KeyW');
  const a = c.pos.clone();
  for (let i = 0; i < 120; i++) c.update(1 / 60);
  const moved = Math.hypot(c.pos.x - a.x, c.pos.z - a.z);
  const okU = moved > 6;
  console.log(`  ${okU ? 'PASS' : 'FAIL'} uphill travel ${moved.toFixed(1)}m in 2s`);
  pass = pass && okU;
}

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
process.exit(pass ? 0 : 1);
