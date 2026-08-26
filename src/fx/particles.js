// Ambient atmosphere motes drifting around the player + pickup burst FX.

import * as THREE from 'three';
import { makeRng } from '../core/noise.js';

function moteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.4, 'rgba(255,240,180,0.5)');
  g.addColorStop(1, 'rgba(255,235,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createMotes(scene) {
  const COUNT = 260;
  const rng = makeRng(99887766);
  const positions = new Float32Array(COUNT * 3);
  const seeds = [];
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (rng() - 0.5) * 60;
    positions[i * 3 + 1] = rng() * 10 + 0.5;
    positions[i * 3 + 2] = (rng() - 0.5) * 60;
    seeds.push({ sx: rng() * 100, sy: rng() * 100 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Custom point shader: clamped size + near-camera fade. A drifting mote
  // passing close to the lens would otherwise blow up into a full-screen
  // additive flash (gl_PointSize scales as 1/z).
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: moteTexture() },
      uPixelScale: { value: window.innerHeight * 0.5 },
    },
    vertexShader: /* glsl */ `
      uniform float uPixelScale;
      varying float vFade;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        gl_PointSize = clamp(0.22 * uPixelScale / max(dist, 0.001), 1.0, 26.0);
        // Fade motes that drift into the lens.
        vFade = smoothstep(0.6, 3.0, dist) * (1.0 - smoothstep(38.0, 52.0, dist));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying float vFade;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(tex.rgb, tex.a * 0.75 * vFade);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  window.addEventListener('resize', () => {
    mat.uniforms.uPixelScale.value = window.innerHeight * 0.5;
  });

  const t0 = performance.now() * 0.001;
  return {
    points,
    update(t, playerPos) {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        const s = seeds[i];
        // Drift in gentle loops relative to origin; recentered on the player.
        let x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
        x += Math.sin(t * 0.5 + s.sx) * 0.004 + 0.006;
        y += Math.sin(t * 0.7 + s.sy) * 0.005;
        z += Math.cos(t * 0.4 + s.sx) * 0.006;
        // Wrap into a 60x60 box centered on the player.
        const wrap = (v, c) => {
          let d = v - c;
          if (d > 30) v -= 60; else if (d < -30) v += 60;
          return v;
        };
        x = wrap(x, playerPos.x);
        z = wrap(z, playerPos.z);
        if (y > playerPos.y + 12) y = playerPos.y + 0.5;
        if (y < playerPos.y - 4) y = playerPos.y + 9;
        arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
      void t0;
    },
  };
}

// One-shot collect burst: expanding ring + rising sparks.
export function createBursts(scene) {
  const bursts = [];
  const sparkTex = moteTexture();

  function spawn(x, y, z) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.34, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.2, 2.4, 3.2),
        transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);

    const N = 36;
    const pos = new Float32Array(N * 3);
    const vel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * 3.5;
      const r = 1.5 + Math.random() * 2.5;
      vel.push(new THREE.Vector3(Math.cos(a) * r, up, Math.sin(a) * r));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(g, new THREE.PointsMaterial({
      map: sparkTex, size: 0.3, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      sizeAttenuation: true,
    }));
    // Bursts spawn at arm's length from the camera at most; keep the
    // attenuated size sane so a spark can't fill the frame.
    sparks.onBeforeRender = () => {
      sparks.material.size = 0.3;
    };
    sparks.frustumCulled = false;

    scene.add(ring, sparks);
    bursts.push({ ring, sparks, vel, t: 0 });
  }

  return {
    spawn,
    update(dt) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.t += dt;
        const k = b.t / 1.1;
        b.ring.scale.setScalar(1 + k * 8);
        b.ring.material.opacity = Math.max(0, 0.9 * (1 - k));
        const arr = b.sparks.geometry.attributes.position.array;
        for (let j = 0; j < b.vel.length; j++) {
          b.vel[j].y -= 6 * dt;
          arr[j * 3] += b.vel[j].x * dt;
          arr[j * 3 + 1] += b.vel[j].y * dt;
          arr[j * 3 + 2] += b.vel[j].z * dt;
        }
        b.sparks.geometry.attributes.position.needsUpdate = true;
        b.sparks.material.opacity = Math.max(0, 1 - k);
        if (k >= 1) {
          scene.remove(b.ring, b.sparks);
          b.ring.geometry.dispose(); b.ring.material.dispose();
          b.sparks.geometry.dispose(); b.sparks.material.dispose();
          bursts.splice(i, 1);
        }
      }
    },
  };
}

// Soft contact blob that hugs the terrain — grounds characters on grass
// where shadow maps can't reach (the blades cover the ground).
export function createBlobShadow(scene) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(10,20,12,0.55)');
  g.addColorStop(0.55, 'rgba(10,20,12,0.30)');
  g.addColorStop(1, 'rgba(10,20,12,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      opacity: 0.9, fog: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 3; // after grass, so it shades the blades too
  scene.add(mesh);
  return {
    mesh,
    update(playerPos, terrainY) {
      mesh.position.set(playerPos.x, terrainY + 0.05, playerPos.z);
      const air = Math.max(0, playerPos.y - terrainY);
      const s = 1 + air * 0.12;
      mesh.scale.set(s, s, 1);
      mesh.material.opacity = 0.9 / (1 + air * 0.7);
    },
  };
}
