// World props: the Embergate standing arch (the fast-travel device), a
// traveler's campfire built from primitives, and wayfarer posts marking trails.

import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';
import { makeRng } from '../core/noise.js';

function rock(rng, s = 0.2) {
  const g = new THREE.IcosahedronGeometry(s, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h1 = Math.abs(Math.sin(p.getX(i) * 37.1 + p.getY(i) * 11.7 + p.getZ(i) * 53.3)) % 1;
    const h2 = Math.abs(Math.sin(p.getX(i) * 19.3 + p.getY(i) * 71.9)) % 1;
    p.setXYZ(i, p.getX(i) * (0.8 + h1 * 0.4), p.getY(i) * (0.7 + h2 * 0.5), p.getZ(i) * (0.8 + h1 * 0.3));
  }
  g.computeVertexNormals();
  return g;
}

const stoneMat = new THREE.MeshToonMaterial({ color: '#9a958a' });
const stoneDark = new THREE.MeshToonMaterial({ color: '#716a5e' });
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.7, 0.35), transparent: true, opacity: 0.85 });
const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.8, 2.6) });

function addOutline(scene, mesh, scale = 1.06) {
  const ol = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: '#241b12', side: THREE.BackSide }));
  ol.scale.setScalar(scale); ol.raycast = () => {};
  mesh.add(ol);
}

// A standing arch of stone with a shimmering portal disc. Returns the group
// plus a world position used for the interact prompt.
export function createEmbergate(scene, x, z, rng) {
  const y = heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const H = 4.6, gap = 2.0;
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(rock(rng, 0.5), stoneMat);
    pillar.scale.set(0.55, H, 0.55);
    pillar.position.set(s * gap, H / 2, 0);
    g.add(pillar);
    const cap = new THREE.Mesh(rock(rng, 0.34), stoneDark);
    cap.position.set(s * gap, H + 0.15, 0);
    g.add(cap);
    // Runes up the pillar.
    for (let i = 0; i < 5; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.03), starMat.clone());
      rune.material.transparent = true;
      rune.position.set(s * gap - s * 0.34, 0.8 + i * 0.85, 0);
      rune.userData.i = i + (s < 0 ? 10 : 0);
      g.add(rune);
      addOutline(scene, rune, 1.2);
    }
  }
  // Lintel.
  const lintel = new THREE.Mesh(rock(rng, 0.5), stoneDark);
  lintel.scale.set(4.2, 0.9, 0.7);
  lintel.position.set(0, H + 0.1, 0);
  g.add(lintel);

  // Portal disc (faintly emissive, blooms).
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(gap * 0.98, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 1.8), transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  disc.position.set(0, H / 2, -0.15);
  g.add(disc);
  disc.userData.base = disc.material.opacity;

  scene.add(g);
  return { group: g, x, z, y, disc };
}

export function createCampfire(scene, x, z, rng) {
  const y = heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const st = new THREE.Mesh(rock(rng, 0.22), stoneDark);
    st.position.set(Math.cos(a) * 0.34, 0.1, Math.sin(a) * 0.34);
    st.rotation.y = a;
    g.add(st);
  }
  const logMat = new THREE.MeshToonMaterial({ color: '#5a432c' });
  for (const [dx, dy] of [[0.14, 0.05], [-0.12, 0.1], [0.02, 0.16], [-0.05, 0.02]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), logMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(dx, dy, 0);
    log.rotation.y = dy > 0.08 ? 0.9 : 0;
    g.add(log);
  }
  // Flame core + glow.
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 7),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.55, 0.2), transparent: true, opacity: 0.92 })
  );
  flame.position.y = 0.35;
  g.add(flame);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.0, 0.4) }));
  ember.position.y = 0.2;
  g.add(ember);

  scene.add(g);
  return {
    group: g,
    update(t) {
      flame.scale.y = 1 + Math.sin(t * 5.0) * 0.15;
      flame.rotation.y = t * 2.0;
      ember.scale.setScalar(0.8 + Math.sin(t * 7.0) * 0.25);
    },
  };
}

// Trail wayposts (themed per world via a dominant colour).
export function createWayposts(scene, x, z, accent) {
  const y = heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.7, 6),
    new THREE.MeshToonMaterial({ color: '#5f5544' }));
  post.position.y = 0.85;
  const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4),
    new THREE.MeshToonMaterial({ color: accent }));
  pennant.position.y = 1.9;
  pennant.rotation.y = Math.PI / 4;
  g.add(post, pennant);
  scene.add(g);
  return { group: g };
}

export function createWorldProps(scene, world) {
  const rng = makeRng(5533 + world.id.length * 7);
  const gates = [];
  const ambients = [];

  // Embergate near spawn.
  gates.push(createEmbergate(scene, world.spawn[0] + 26, world.spawn[1] - 6, rng));

  // Campfire near spawn.
  ambients.push(createCampfire(scene, world.spawn[0] + 8, world.spawn[1] - 10, rng));

  // A couple of wayposts along obvious directions.
  const accent = world.id === 'embercrown' ? '#c2502a' : world.id === 'ashenvale' ? '#aec9d8' : '#5a8fc9';
  createWayposts(scene, world.spawn[0] - 40, world.spawn[1] + 30, accent);
  createWayposts(scene, world.spawn[0] + 45, world.spawn[1] + 55, accent);
  createWayposts(scene, world.spawn[0] + 10, world.spawn[1] + 95, accent);

  return { gates, ambients };
}