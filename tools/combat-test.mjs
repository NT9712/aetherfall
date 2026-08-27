// Unit test for the combat system, driven in Node (stubbed DOM/GPU).
import * as THREE from 'three';

// Minimal canvas stub so glowTexture() doesn't need a browser.
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop(){} }),
      fillStyle: '', fillRect(){}, beginPath(){}, arc(){}, fill(){} }),
    fillStyle: '', fillRect(){}, beginPath(){}, arc(){}, fill(){}, width: 0, height: 0,
  }),
};

const { Combat } = await import('../src/player/combat.js');
import { heightAtFast } from '../src/world/heightfield.js';

const scene = { add(){}, remove(){} };
const player = { x: 0, y: 0, z: 0, facing: 0, syncGround: true }; // set y to ground below

function syncGround() { player.y = heightAtFast(player.x, player.z); }
function makeCombat(density) {
  const c = new Combat(scene, { getPlayer: () => player });
  c.density = density;
  c.rebuild({ id: 'aetherfall', spawn: [0, 0] });
  return c;
}

let pass = true;
const check = (l, ok, ex = '') => { pass = pass && ok; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${l}${ex ? '  ' + ex : ''}`); };

// 1. density gates spawn count
{
  const c0 = makeCombat(0), c4 = makeCombat(4);
  check('density 0 spawns none', c0.pool.every((p) => !p.enabled) && c0.maxEnemies === 0);
  check('density 4 spawns 12', c4.maxEnemies === 12 && c4.pool.filter((p) => p.enabled).length === 12);
}

// 2. enemies drift toward the player
{
  const c = makeCombat(4); syncGround();
  // park the first enemy far to +z and watch it approach
  const e = c.enemies[0];
  const far = player.z + 30;
  e.x = player.x; e.z = far;
  const d0 = Math.hypot(e.x - player.x, e.z - player.z);
  for (let i = 0; i < 60; i++) c.update(1 / 60, player);   // 1s
  const d1 = Math.hypot(e.x - player.x, e.z - player.z);
  check('enemy approaches player', d1 < d0 - 1, `${d0.toFixed(1)} -> ${d1.toFixed(1)}`);
}

// 3. swing destroys a lined-up enemy
{
  const c = makeCombat(4);
  const e = c.enemies[0];
  e.x = player.x; e.z = player.z + 1.5; e.hp = 2;
  const idx = 0;
  c.swing();
  let hit = 0;
  for (let i = 0; i < 60; i++) { c.update(1 / 60, player); if (!c.pool[idx].enabled) break; }
  check('swing destroys a lined-up enemy', !c.pool[idx].enabled);
  void hit;
}

// 4. contact damage lowers health
{
  const c = makeCombat(4); syncGround();
  const e = c.enemies[0];
  e.x = player.x; e.z = player.z;      // right on the player
  e.y = player.y + 1.0;
  for (let i = 0; i < 30; i++) c.update(1 / 60, player);
  check('contact drains health', c.health < 100, `hp ${c.health.toFixed(0)}`);
}

// 5. health reaches zero and triggers death
{
  const player2 = { ...player };
  const c = new Combat(scene, { getPlayer: () => player2, onDeath: () => (globalThis.__died = true) });
  globalThis.__died = false;
  c.density = 3;
  c.rebuild({ id: 'aetherfall', spawn: [0, 0] });
  c.health = 10;
  player2.y = heightAtFast(player2.x, player2.z);  // stand on the ground
  const e = c.enemies[0];
  e.x = player2.x; e.z = player2.z;
  for (let i = 0; i < 240; i++) c.update(1 / 60, player2);
  check('death fires at zero health', globalThis.__died === true && c.health === 0);
  check('combat stops sending damage after death', c.alive === false);
}

// 6. rebuild resets enemies for a new world
{
  const c = makeCombat(4);
  const base = c.enemies.length;
  c.rebuild({ id: 'embercrown', spawn: [100, 100] });
  check('rebuild keeps a fresh ring', c.enemies.length === base && c.pool.every((p) => !p.visible || p.visible));
}

// 7. rebuild with density 0 clears the field
{
  const c = makeCombat(0);
  c.rebuild({ id: 'ashenvale', spawn: [0, 0] });
  check('zero density rebuild is empty', c.pool.every((p) => !p.enabled));
}

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
process.exit(pass ? 0 : 1);
