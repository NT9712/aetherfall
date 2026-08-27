// Aether Shards: seven floating crystal fragments, each with a sky-beacon
// light pillar and glow halo so they read as landmarks across the island.
// Handles proximity pickup + a satisfying collect animation.

import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { SHARDS } from '../data/lore.js';

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(180,240,255,1)');
  g.addColorStop(0.25, 'rgba(120,210,255,0.55)');
  g.addColorStop(1, 'rgba(80,180,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const SHARD_DATA = SHARDS;   // default journey (kept for compat)

export function createShards(scene, shardList = SHARDS) {
  const group = new THREE.Group();
  const glowTex = makeGlowTexture();
  const items = [];

  for (const [x, z] of shardList) {
    const baseY = Math.max(heightAt(x, z), 0.5);

    // Crystal core — HDR-bright so bloom picks it up.
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 4.5, 6.5) })
    );
    core.position.set(x, baseY + 1.6, z);

    // Halo sprite.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.setScalar(3.2);
    core.add(halo);

    // Sky beacon pillar.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.55, 90, 12, 1, true),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          void main(){
            float fade = pow(vUv.y, 1.6);                    // bright at base
            float pulse = 0.75 + 0.25 * sin(uTime * 2.0 - vUv.y * 6.0);
            float edge = smoothstep(0.0, 0.25, vUv.x) ;      // cylinder uv wrap soft
            gl_FragColor = vec4(vec3(0.45, 0.85, 1.0), fade * 0.28 * pulse);
          }
        `,
      })
    );
    beam.position.set(x, baseY + 45, z);
    beam.renderOrder = 2;

    // Ground sigil ring.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.55, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.7, 1.8, 2.6),
        transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, baseY + 0.06, z);

    scene.add(core, beam, ring);
    group.add(core);
    items.push({ x, z, baseY, core, beam, ring, collected: false, animT: 0 });
  }

  let collectedCount = 0;

  return {
    group,
    rebuild(next) {
      // Remove all current shard objects and start fresh for another world.
      for (const s of items) { scene.remove(s.core, s.beam, s.ring); s.core.geometry.dispose(); }
      items.length = 0;
      collectedCount = 0;
      next.forEach(([x, z]) => {
        const baseY = Math.max(heightAt(x, z), 0.5);
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 4.5, 6.5) })
        );
        core.position.set(x, baseY + 1.6, z);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.setScalar(3.2);
        core.add(halo);
        const beamM = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          uniforms: { uTime: { value: 0 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `varying vec2 vUv; uniform float uTime;
            void main(){ float fade=pow(vUv.y,1.6); float pulse=0.75+0.25*sin(uTime*2.0-vUv.y*6.0);
              gl_FragColor=vec4(vec3(0.45,0.85,1.0), fade*0.28*pulse); }`,
        });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 90, 12, 1, true), beamM);
        beam.position.set(x, baseY + 45, z);
        beam.renderOrder = 2;
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 40),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.8, 2.6), transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, baseY + 0.06, z);
        scene.add(core, beam, ring);
        group.add(core);
        items.push({ x, z, baseY, core, beam, ring, collected: false, animT: 0 });
      });
    },
    get collectedCount() { return collectedCount; },
    // Returns the shard that was picked up this frame, if any.
    update(t, dt, playerPos) {
      let picked = null;
      for (const s of items) {
        if (s.collected) {
          // Collect animation: rise + spin + shrink.
          if (s.animT < 1) {
            s.animT = Math.min(1, s.animT + dt * 1.4);
            const k = s.animT;
            s.core.position.y += dt * 6 * (1 - k);
            s.core.rotation.y += dt * 14;
            s.core.scale.setScalar(Math.max(0.001, 1 - k));
            s.ring.material.opacity = 0.5 * (1 - k);
            s.beam.material.uniforms.uTime.value = t;
            if (k >= 1) {
              s.core.visible = false;
              s.beam.visible = false;
            }
          }
          continue;
        }
        s.core.rotation.y = t * 1.4;
        s.core.rotation.z = Math.sin(t * 0.9) * 0.18;
        s.core.position.y = s.baseY + 1.6 + Math.sin(t * 1.7) * 0.22;
        s.ring.rotation.z = t * 0.4;
        s.beam.material.uniforms.uTime.value = t;

        const dxz = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
        const dy = Math.abs(playerPos.y - s.core.position.y);
        if (dxz < 2.3 && dy < 4.0) {
          s.collected = true;
          collectedCount++;
          picked = s;
        }
      }
      return picked;
    },
  };
}
