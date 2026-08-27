// Lightweight melee combat, gated by performance.
//
// A handful of Wraiths (glowing shade wisps) drift toward the player and sap
// health on touch; the player sweeps them with a sword swing. The number that
// spawns is tied to the quality controller's Density tier:
//
//   0  -> none (combat fully off)
//   1  -> 3     2 -> 6     3 -> 9     4 -> 12
//
// So on weak hardware the adaptive controller lowers density and the enemies
// literally thin out or vanish — combat "permits itself" based on framerate.
// Enemies are dumb on purpose: no navigation, they follow height and float, so
// the whole system stays cheap and predictable.

import * as THREE from 'three';
import { heightAtFast, ISLAND_RADIUS } from '../world/heightfield.js';
import { makeRng } from '../core/noise.js';

const RING = ISLAND_RADIUS - 25;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(180,240,255,1)');
  g.addColorStop(0.4, 'rgba(120,200,255,0.5)');
  g.addColorStop(1, 'rgba(80,160,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Combat {
  constructor(scene, { getPlayer, onDeath, accent = 0x58c8f0 }) {
    this.scene = scene;
    this.getPlayer = getPlayer;
    this.onDeath = onDeath;
    this.accent = accent;
    this.rng = makeRng(2024);
    this.spawnTex = glowTexture();

    this.enemies = [];          // descriptor pool (rebuildable)
    this.pool = [];             // attached meshes
    this.health = 100;
    this.alive = true;
    this.swingT = -1;           // -1 = not swinging; else 0..1 timer
    this.swingCd = 0;
    this.attackKnock = 3.6;     // sword reach
    this.spawned = 0;
    this.active = false;
  }

  resetHealth() { this.health = 100; this.alive = true; }

  rebuild(world) {
    // Tear down old enemies.
    for (const p of this.pool) this.scene.remove(p);
    this.pool.length = 0;
    this.enemies.length = 0;
    this.spawned = 0;

    // Ring positions around wherever the player starts this world.
    const cx = world.spawn[0], cz = world.spawn[1];
    const r = makeRng(777 + world.id.length * 13);
    for (let i = 0; i < this.maxEnemies; i++) {
      const a = r() * Math.PI * 2;
      const rr = 55 + r() * 70;
      this.enemies.push({
        x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr,
        hp: 2, seeded: r(),
      });
    }
    this.spawnEnemies();
    this.applySpawnedCount();
    this.active = this.maxEnemies > 0;
  }

  // maxEnemies depends on the density tier (performance gate).
  set density(tier) {
    this._density = tier;
    this.maxEnemies = [0, 3, 6, 9, 12][tier] || 0;
    if (this.enemies.length) this.applySpawnedCount();
  }
  get density() { return this._density || 0; }

  // Attach meshes for alive enemies.
  spawnEnemies() {
    for (let i = this.pool.length; i < this.maxEnemies; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(this.accent).multiplyScalar(1.4) }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.spawnTex, transparent: true, opacity: 0.8, depthWrite: false,
        blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(2.4);
      g.add(core, glow);
      this.scene.add(g);
      this.pool.push({ group: g, core, glow, enabled: false });
    }
  }

  applySpawnedCount() {
    this.pool.forEach((p, i) => {
      const keep = i < this.maxEnemies;
      p.enabled = keep;
      p.group.visible = keep;
    });
  }

  swing() {
    if (this.swingCd > 0 || !this.alive) return false;
    this.swingT = 0;
    this.swingCd = 0.4;
    return true;
  }

  update(dt, focus) {
    if (focus) this.focus = focus;               // Vector3 of the player
    if (this._density >= 0) {}
    this.swingCd = Math.max(0, this.swingCd - dt);
    if (this.swingCd === 0 && this.swingT >= 0) this.swingT = -1;

    if (!this.active || !this.alive) {
      return this.health;
    }

    // Advance swing animation (0..0.28s active window).
    if (this.swingT >= 0) this.swingT += dt;

    const player = this.focus || this.getPlayer();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const p = this.pool[i];
      if (!p || !p.enabled || e.hp <= 0) continue;

      // Drift toward the player at a modest speed.
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const speed = 2.2;
      e.x += (dx / dist) * speed * dt;
      e.z += (dz / dist) * speed * dt;
      const gy = heightAtFast(e.x, e.z);
      const bob = Math.sin(performance.now() * 0.004 + e.seeded * 9) * 0.35;
      const py = player.y;
      const y = Math.max(gy + 1.0, py - 0.9) + bob;
      p.group.position.set(e.x, y, e.z);
      e.y = y;

      // Contact damage.
      const worldDist = Math.hypot(player.x - e.x, player.z - e.z);
      if (worldDist < 0.9 && Math.abs(player.y - y) < 1.6) {
        this.health -= 8 * dt;         // ~8hp/s
        if (this.health <= 0 && this.alive) {
          this.health = 0; this.alive = false;
          if (this.onDeath) this.onDeath();
        }
      }

      // Sword sweep.
      if (this.swingT >= 0.06 && this.swingT <= 0.28 && worldDist < this.attackKnock) {
        // Must be roughly in front of the player (facing cone). Use the
        // vector from the player toward the enemy, not the reverse.
        const facing = player.facing !== undefined ? player.facing : 0;
        // facing is a world heading (contoller uses atan2(dx,dz)); measure the
        // enemy the same way from the player outward.
        const ex = e.x - player.x, ez = e.z - player.z;
        const toEnemy = Math.atan2(ex, ez);
        let diff = Math.abs((toEnemy - facing + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (diff < 1.1) {
          e.hp -= 1;
          p.glow.material.opacity = 0.9;
          // knock it back a touch
          e.x -= (dx / dist) * 1.6;
          e.z -= (dz / dist) * 1.6;
          if (e.hp <= 0) { p.enabled = false; p.group.visible = false; }
        }
      }
    }
    return this.health;
  }
}