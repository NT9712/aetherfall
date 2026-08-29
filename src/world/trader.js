// A wandering merchant's cart — the mission giver. A simple market stall with
// an awning, produce crates, a lantern and a string of the world's wild items.
// Standing near it and pressing E opens the mission dialog.

import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';
import { ITEMS, wildItemFor } from '../data/items.js';

export function createTrader(scene, world, rng) {
  const x = world.spawn[0] - 14, z = world.spawn[1] - 6;
  const y = heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rng() * 0.4;

  const woodMat = new THREE.MeshToonMaterial({ color: '#6b4a2e' });
  const clothMat = new THREE.MeshToonMaterial({ color: '#b5452f' });
  const goldMat = new THREE.MeshToonMaterial({ color: '#e9c15a' });

  // Cart box.
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.2), woodMat);
  box.position.y = 0.55;
  // Awning poles + canopy.
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), woodMat);
    pole.position.set(s * 0.9, 1.6, -0.4);
    g.add(pole);
  }
  const awning = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 4), clothMat);
  awning.position.set(0, 2.6, -0.4);
  awning.rotation.y = Math.PI / 4;
  g.add(awning);

  // Crates.
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), woodMat);
    crate.position.set(-0.5 + i * 0.5, 1.0, 0.1);
    crate.rotation.z = rng() * 0.3 - 0.15;
    g.add(crate);
  }

  // Lantern + a string of the world's wild items up on the cart.
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.7, 0.35) }));
  lantern.position.set(0, 2.0, 0.25);
  g.add(lantern);
  const itemId = wildItemFor(world.id);
  const itemCol = new THREE.Color(ITEMS[itemId].color);
  for (let i = 0; i < 4; i++) {
    const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0),
      new THREE.MeshBasicMaterial({ color: itemCol.clone().multiplyScalar(1.6) }));
    bead.position.set(-0.4 + i * 0.27, 1.7, 0.32);
    g.add(bead);
  }

  scene.add(g);
  return { group: g, x, z, y };
}