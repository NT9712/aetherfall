// Wild item pickups: little glowing flora that is gathered by walking near.
// Collection reports which item was grabbed so the game loop credits the
// inventory. Pure-ish (renders the props) but the pickup decision is trivially
// testable.

import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';
import { ITEMS, WILD_SPOTS, wildItemFor } from '../data/items.js';

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createWildItems(scene, world) {
  const items = [];
  const tex = glowTexture();
  const itemId = wildItemFor(world.id);
  const col = new THREE.Color(ITEMS[itemId].color);

  for (const [x, z] of WILD_SPOTS) {
    const y = heightAt(x, z);
    if (y < 0.8 || y > 22) continue;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.20, 0),
      new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6) })
    );
    core.position.y = 0.55;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.75, depthWrite: false,
      blending: THREE.AdditiveBlending, color: col.clone().multiplyScalar(1.4),
    }));
    halo.scale.setScalar(1.5);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5),
      new THREE.MeshToonMaterial({ color: '#5f8a3c' }));
    stem.position.y = 0.28;

    group.add(core, halo, stem);
    scene.add(group);
    items.push({ itemId, x, z, baseY: y, group, core, halo, collected: false });
  }

  return {
    items,
    update(t, playerPos) {
      let picked = null;
      for (const s of items) {
        if (s.collected) continue;
        s.core.rotation.y = t * 1.4 + s.x;
        s.core.position.y = s.baseY + 0.55 + Math.sin(t * 1.7 + s.x) * 0.12;
        const h = 0.7 + 0.3 * Math.sin(t * 4.0 + s.x);
        s.halo.scale.setScalar(1.5 * (1.6 - h * 0.6));
        if (Math.hypot(playerPos.x - s.x, playerPos.z - s.z) < 1.5) {
          s.collected = true;
          s.group.visible = false;
          picked = s;
        }
      }
      return picked;
    },
  };
}