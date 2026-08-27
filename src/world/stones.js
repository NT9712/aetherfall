// Ancient steles: carved monuments rather than plain slabs.
// Each is a tapered obelisk with a chiselled cap, a stepped plinth, scattered
// foundation stones, moss creeping up the base and glowing runes.

import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { STONES } from '../data/lore.js';
import { makeRng } from '../core/noise.js';

function weather(geo, rng, amount = 0.02) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h1 = Math.abs(Math.sin(p.getX(i) * 37.1 + p.getY(i) * 11.7 + p.getZ(i) * 53.3)) % 1;
    const h2 = Math.abs(Math.sin(p.getX(i) * 19.3 + p.getY(i) * 71.9 + p.getZ(i) * 23.1)) % 1;
    p.setXYZ(i,
      p.getX(i) + (h1 - 0.5) * amount,
      p.getY(i) + (h2 - 0.5) * amount * 0.6,
      p.getZ(i) + (h1 * h2 - 0.25) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createStones(scene, stoneList = STONES) {
  const items = [];
  const rng = makeRng(8823);

  const stoneMat = new THREE.MeshToonMaterial({ color: '#a49c8c' });
  const stoneDark = new THREE.MeshToonMaterial({ color: '#857d6f' });
  const mossMat = new THREE.MeshToonMaterial({ color: '#5f7a3e' });
  const goldMat = new THREE.MeshToonMaterial({ color: '#d8b45c' });
  const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.9, 2.1) });

  for (const st of stoneList) {
    const [x, z] = st.pos;
    const y = heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = st.rotY;

    // Stepped plinth.
    const base0 = new THREE.Mesh(weather(new THREE.BoxGeometry(2.5, 0.30, 1.7), rng, 0.05), stoneDark);
    base0.position.y = 0.14;
    const base1 = new THREE.Mesh(weather(new THREE.BoxGeometry(2.0, 0.26, 1.35), rng, 0.04), stoneMat);
    base1.position.y = 0.42;
    base0.castShadow = base1.castShadow = true;
    base0.receiveShadow = base1.receiveShadow = true;

    // Tapered shaft (cylinder with 6 sides reads as chiselled stone).
    const shaft = new THREE.Mesh(
      weather(new THREE.CylinderGeometry(0.62, 0.78, 2.7, 6, 3), rng, 0.045), stoneMat);
    shaft.position.y = 1.92;
    shaft.rotation.y = Math.PI / 6;
    shaft.castShadow = shaft.receiveShadow = true;

    // Chiselled cap + finial.
    const cap = new THREE.Mesh(weather(new THREE.CylinderGeometry(0.80, 0.66, 0.30, 6), rng, 0.03), stoneDark);
    cap.position.y = 3.40;
    cap.rotation.y = Math.PI / 6;
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), goldMat);
    finial.position.y = 3.78;
    cap.castShadow = finial.castShadow = true;

    // Inscription panel, slightly recessed and darker.
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.7, 0.06), stoneDark);
    panel.position.set(0, 2.0, 0.60);

    g.add(base0, base1, shaft, cap, finial, panel);

    // Foundation rubble around the plinth.
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1.2 + rng() * 0.7;
      const s = 0.12 + rng() * 0.22;
      const rock = new THREE.Mesh(weather(new THREE.IcosahedronGeometry(s, 0), rng, s * 0.5),
        rng() > 0.5 ? stoneMat : stoneDark);
      rock.position.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r);
      rock.castShadow = true;
      g.add(rock);
    }

    // Moss creeping up the plinth and shaft base.
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.16 + rng() * 0.14, 7, 6), mossMat);
      moss.position.set(Math.cos(a) * 0.85, 0.15 + rng() * 0.55, Math.sin(a) * 0.62);
      moss.scale.set(1, 0.45, 1);
      g.add(moss);
    }

    // Runes down the inscription panel.
    const runes = [];
    for (let i = 0; i < 6; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.055, 0.02), runeMat.clone());
      rune.material.transparent = true;
      rune.position.set((i % 2) * 0.12 - 0.06, 2.62 - i * 0.24, 0.645);
      rune.userData.phase = i * 1.1;
      g.add(rune);
      runes.push(rune);
    }

    scene.add(g);
    items.push({ ...st, x, z, y, group: g, runes });
  }

  return {
    items,
    rebuild(next) {
      for (const it of items) { scene.remove(it.group); }
      items.length = 0;
      next.forEach((st) => {
        const [x, z] = st.pos;
        const y = heightAt(x, z);
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = st.rotY;
        const base0 = new THREE.Mesh(weather(new THREE.BoxGeometry(2.5, 0.30, 1.7), rng, 0.05), stoneDark);
        base0.position.y = 0.14;
        const base1 = new THREE.Mesh(weather(new THREE.BoxGeometry(2.0, 0.26, 1.35), rng, 0.04), stoneMat);
        base1.position.y = 0.42;
        const shaft = new THREE.Mesh(weather(new THREE.CylinderGeometry(0.62, 0.78, 2.7, 6, 3), rng, 0.045), stoneMat);
        shaft.position.y = 1.92; shaft.rotation.y = Math.PI / 6;
        const cap = new THREE.Mesh(weather(new THREE.CylinderGeometry(0.80, 0.66, 0.30, 6), rng, 0.03), stoneDark);
        cap.position.y = 3.40; cap.rotation.y = Math.PI / 6;
        const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), goldMat);
        finial.position.y = 3.78;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.7, 0.06), stoneDark);
        panel.position.set(0, 2.0, 0.60);
        [base0, base1, shaft, cap, finial].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
        g.add(base0, base1, shaft, cap, finial, panel);
        for (let i = 0; i < 5; i++) {
          const a = rng() * Math.PI * 2, r = 1.2 + rng() * 0.7, s2 = 0.12 + rng() * 0.22;
          const rock2 = new THREE.Mesh(weather(new THREE.IcosahedronGeometry(s2, 0), rng, s2 * 0.5), rng() > 0.5 ? stoneMat : stoneDark);
          rock2.position.set(Math.cos(a) * r, s2 * 0.5, Math.sin(a) * r);
          rock2.castShadow = true;
          g.add(rock2);
        }
        for (let i = 0; i < 7; i++) {
          const a = rng() * Math.PI * 2;
          const moss = new THREE.Mesh(new THREE.SphereGeometry(0.16 + rng() * 0.14, 7, 6), mossMat);
          moss.position.set(Math.cos(a) * 0.85, 0.15 + rng() * 0.55, Math.sin(a) * 0.62);
          moss.scale.set(1, 0.45, 1);
          g.add(moss);
        }
        const runes = [];
        for (let i = 0; i < 6; i++) {
          const rune = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.055, 0.02), runeMat.clone());
          rune.material.transparent = true;
          rune.position.set((i % 2) * 0.12 - 0.06, 2.62 - i * 0.24, 0.645);
          rune.userData.phase = i * 1.1;
          g.add(rune);
          runes.push(rune);
        }
        scene.add(g);
        items.push({ ...st, x, z, y, group: g, runes });
      });
    },
    update(t) {
      for (const st of items) {
        for (const r of st.runes) {
          r.material.opacity = 0.5 + 0.5 * Math.sin(t * 2.0 + st.x + r.userData.phase);
        }
      }
    },
    nearest(pos) {
      let best = null, bestD = 4.0;
      for (const st of items) {
        const d = Math.hypot(pos.x - st.x, pos.z - st.z);
        if (d < bestD) { bestD = d; best = st; }
      }
      return best;
    },
  };
}
