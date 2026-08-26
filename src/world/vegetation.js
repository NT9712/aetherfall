// Vegetation: GPU-instanced meadow grass with wind waves, plus merged
// low-poly toon trees and boulders (2-3 draw calls each, shadow-casting).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, slopeAt, ISLAND_RADIUS, SHADER_COMMON } from './heightfield.js';
import { makeRng, smoothstep, valueNoise } from '../core/noise.js';
import { SUN_DIR, PALETTE } from './heightfield.js';

// ---------------------------------------------------------------- grass
// Camera-following grass field. Rather than sprinkling blades over the whole
// island (which yields ~1 blade/m² and reads as confetti), a fixed budget of
// blades is confined to a tile that wraps toroidally around the camera, giving
// ~25 blades/m² where it matters. Blade height is fetched from the terrain
// heightmap in the vertex shader, and blades on cliffs, sand or water collapse
// to zero scale.
function createGrass(scene, heightTex) {
  const COUNT = 150000;
  const TILE = 96;                       // metres; field spans ±TILE/2
  const decode = heightTex.userData.decode;

  const bladeGeo = new THREE.PlaneGeometry(0.085, 0.48, 1, 5);
  {
    const p = bladeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.24;
      const t = y / 0.48;
      p.setX(i, p.getX(i) * (1.0 - t * 0.78));
      p.setY(i, y);
      p.setZ(i, p.getZ(i) + t * t * 0.075);
    }
    bladeGeo.computeVertexNormals();
  }

  const rng = makeRng(20240817);
  const offs = new Float32Array(COUNT * 2);
  const rots = new Float32Array(COUNT);
  const scales = new Float32Array(COUNT * 2);
  const phases = new Float32Array(COUNT);
  const tints = new Float32Array(COUNT * 3);

  // Tufted distribution inside the tile.
  let n = 0;
  while (n < COUNT) {
    const cx = (rng() - 0.5) * TILE;
    const cz = (rng() - 0.5) * TILE;
    const blades = 4 + Math.floor(rng() * 10);
    const spread = 0.30 + rng() * 0.5;
    const patch = valueNoise(cx * 0.9 + 5, cz * 0.9 + 5, 77);
    for (let b = 0; b < blades && n < COUNT; b++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * spread;
      offs[n * 2] = cx + Math.cos(a) * r;
      offs[n * 2 + 1] = cz + Math.sin(a) * r;
      rots[n] = rng() * Math.PI * 2;
      const tall = rng() > 0.90 ? 1.45 : 1.0;
      scales[n * 2] = 0.85 + rng() * 0.4;
      scales[n * 2 + 1] = (0.8 + rng() * 0.55) * tall;
      phases[n] = rng() * Math.PI * 2;
      const warm = patch * 0.45 + rng() * 0.22;
      tints.set([0.24 + warm * 0.30, 0.50 + warm * 0.24 + rng() * 0.05, 0.14 + warm * 0.10], n * 3);
      n++;
    }
  }

  bladeGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs, 2));
  bladeGeo.setAttribute('aRot', new THREE.InstancedBufferAttribute(rots, 1));
  bladeGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 2));
  bladeGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  bladeGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));

  const mesh = new THREE.InstancedMesh(bladeGeo, null, COUNT);
  mesh.frustumCulled = false;

  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: SUN_DIR.clone() },
    uSkyAmbient: { value: PALETTE.zenith.clone().lerp(new THREE.Color('#ffffff'), 0.55) },
    uFogColor: { value: PALETTE.fog.clone() },
    uFogNear: { value: 55 },
    uFogFar: { value: 430 },
    uCamPos: { value: new THREE.Vector3() },
    uFocus: { value: new THREE.Vector2() },
    uTile: { value: TILE },
    uHeightMap: { value: heightTex },
    uHMin: { value: decode.MIN_H },
    uHRange: { value: decode.RANGE },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, uniforms]),
    lights: true,                      // grass receives real sun shadows
    side: THREE.DoubleSide,
    depthWrite: false, // let contact blobs & transparents sort over blades
    vertexShader: /* glsl */ `
      #include <common>
      #include <shadowmap_pars_vertex>
      attribute vec2 aOffset;
      attribute float aRot;
      attribute vec2 aScale;
      attribute float aPhase;
      attribute vec3 aTint;
      varying vec3 vColorW;
      varying float vHeightT;
      varying vec3 vWorldPos;
      uniform float uTime, uTile, uHMin, uHRange;
      uniform vec2 uFocus;
      uniform sampler2D uHeightMap;
      ${SHADER_COMMON}

      void main(){
        float t = clamp((position.y) / 0.48, 0.0, 1.0);
        vHeightT = t;

        // Toroidal wrap: keep every blade within ±tile/2 of the focus point.
        vec2 base = aOffset;
        vec2 wrapped = base + floor((uFocus - base) / uTile + 0.5) * uTile;

        // Terrain height + slope straight from the baked heightmap.
        float h  = sampleTerrain(uHeightMap, wrapped, uHMin, uHRange);
        float hx = sampleTerrain(uHeightMap, wrapped + vec2(1.2, 0.0), uHMin, uHRange);
        float hz = sampleTerrain(uHeightMap, wrapped + vec2(0.0, 1.2), uHMin, uHRange);
        float slope = length(vec2(hx - h, hz - h)) / 1.2;

        // Large-scale colour drift so the meadow has tonal regions.
        float region = vnoise(wrapped * 0.018);
        float dry = vnoise(wrapped * 0.052 + 17.0);
        vec3 tint = aTint;
        tint = mix(tint, tint * vec3(1.22, 1.12, 0.72), smoothstep(0.55, 0.85, dry) * 0.75);
        tint = mix(tint, tint * vec3(0.72, 0.88, 0.92), smoothstep(0.55, 0.85, 1.0 - region) * 0.6);
        vColorW = tint;

        // Cull: water, beach, cliffs, snowline. Collapsed blades cost nothing.
        float live = step(0.95, h) * (1.0 - step(19.0, h)) * (1.0 - smoothstep(0.40, 0.58, slope));
        float edge = 1.0 - smoothstep(uTile * 0.40, uTile * 0.495, distance(wrapped, uFocus));
        float grow = live * edge;

        vec3 p = position;
        p.xz *= aScale.x;
        p.y  *= aScale.y;

        float gust = sin(wrapped.x * 0.045 + wrapped.y * 0.032 - uTime * 1.15) * 0.5 + 0.5;
        float sway = sin(uTime * 1.9 + aPhase + wrapped.x * 0.06) * (0.35 + gust * 0.8);
        float flutter = sin(uTime * 5.1 + aPhase * 7.0) * 0.10;
        float bend = (sway + flutter) * t * t;
        p.x += bend * 0.16;
        p.z += bend * 0.10;
        p.y -= abs(bend) * 0.05;

        float c = cos(aRot), s = sin(aRot);
        vec3 rp = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
        rp *= grow;

        vec3 world = vec3(wrapped.x, h - 0.05, wrapped.y) + rp;
        vWorldPos = world;

        // Feed three's shadow machinery.
        vec4 worldPosition = vec4(world, 1.0);
        vec3 objectNormal = vec3(0.0, 1.0, 0.0);
        vec3 transformedNormal = objectNormal;
        vec4 mvPosition = viewMatrix * worldPosition;
        #include <shadowmap_vertex>

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      varying vec3 vColorW;
      varying float vHeightT;
      varying vec3 vWorldPos;
      uniform vec3 uSunDir, uSkyAmbient, uFogColor;
      uniform float uFogNear, uFogFar;
      uniform vec3 uCamPos;
      void main(){
        float ao = mix(0.52, 1.0, smoothstep(0.0, 0.38, vHeightT));
        vec3 col = vColorW * ao;

        vec3 L = normalize(uSunDir);
        float ndl = max(dot(vec3(0.0, 1.0, 0.0), L), 0.0);

        // Real shadow map: tree canopies and the player now darken the grass.
        float shadow = getShadowMask();
        col *= 0.82 + 0.30 * ndl * mix(0.35, 1.0, shadow);

        vec3 V = normalize(uCamPos - vWorldPos);
        float trans = pow(max(dot(-V, L) * 0.5 + 0.5, 0.0), 3.0);
        col += vColorW * trans * vHeightT * 0.16 * shadow;
        col += vec3(0.05, 0.05, 0.02) * smoothstep(0.80, 1.0, vHeightT) * shadow;
        col += uSkyAmbient * vHeightT * 0.06;

        float dist = distance(uCamPos, vWorldPos);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  // merge() deep-clones; re-point the texture and keep a live handle to the
  // merged uniform objects so per-frame updates actually reach the shader.
  mat.uniforms.uHeightMap.value = heightTex;
  const U = mat.uniforms;
  mesh.material = mat;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return {
    mesh,
    update(t, camPos, focus) {
      U.uTime.value = t;
      U.uCamPos.value.copy(camPos);
      U.uFocus.value.set(focus ? focus.x : camPos.x, focus ? focus.z : camPos.z);
    },
  };
}

// ---------------------------------------------------------------- flowers
// Small blossoms scattered through the meadow. They cost almost nothing and
// supply the warm colour accents that stop a green field reading as a
// monochrome carpet.
function createFlowers(scene) {
  const rng = makeRng(5150);
  const petal = new THREE.CircleGeometry(0.055, 6);
  petal.rotateX(-Math.PI / 2);
  const stem = new THREE.PlaneGeometry(0.012, 0.16);
  stem.translate(0, 0.08, 0);

  const COUNT = 5200;
  const heads = new THREE.InstancedMesh(petal, null, COUNT);
  const stems = new THREE.InstancedMesh(stem, null, COUNT);
  const colors = new Float32Array(COUNT * 3);
  const dummy = new THREE.Object3D();
  const palette = [
    [0.98, 0.94, 0.62], [0.99, 0.99, 0.96], [0.93, 0.66, 0.82],
    [0.72, 0.78, 0.98], [0.99, 0.78, 0.44],
  ];

  let n = 0, tries = 0;
  while (n < COUNT && tries < COUNT * 20) {
    tries++;
    const x = (rng() * 2 - 1) * ISLAND_RADIUS;
    const z = (rng() * 2 - 1) * ISLAND_RADIUS;
    const h = heightAt(x, z);
    if (h < 1.0 || h > 17) continue;
    if (slopeAt(x, z) > 0.32) continue;
    // Flowers grow in drifts, not evenly.
    if (valueNoise(x * 0.05 + 31, z * 0.05 + 31, 404) < 0.55) continue;

    const c = palette[Math.floor(rng() * palette.length)];
    const jitter = 0.9 + rng() * 0.2;
    colors.set([c[0] * jitter, c[1] * jitter, c[2] * jitter], n * 3);

    const s = 0.75 + rng() * 0.6;
    dummy.position.set(x, h + 0.15 * s, z);
    dummy.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    heads.setMatrixAt(n, dummy.matrix);

    dummy.position.set(x, h - 0.01, z);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    stems.setMatrixAt(n, dummy.matrix);
    n++;
  }
  heads.count = stems.count = n;
  heads.instanceMatrix.needsUpdate = stems.instanceMatrix.needsUpdate = true;
  petal.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors.slice(0, n * 3), 3));

  const headMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uFogColor: { value: PALETTE.fog.clone() }, uCamPos: { value: new THREE.Vector3() } },
    vertexShader: `
      attribute vec3 aColor; varying vec3 vC; varying vec3 vW;
      void main(){ vC = aColor;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);
        vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: `
      varying vec3 vC; varying vec3 vW; uniform vec3 uFogColor, uCamPos;
      void main(){
        vec3 col = vC;
        col = mix(col, uFogColor, smoothstep(55.0, 430.0, distance(uCamPos, vW)));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const stemMat = new THREE.MeshToonMaterial({ color: '#4b7a2c', side: THREE.DoubleSide });
  heads.material = headMat;
  stems.material = stemMat;
  heads.frustumCulled = stems.frustumCulled = false;
  scene.add(heads, stems);
  return { update(camPos) { headMat.uniforms.uCamPos.value.copy(camPos); } };
}

// ---------------------------------------------------------------- helpers
function paintVerts(geo, colorFn) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    colorFn(c, pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function blob(rng, r, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  // Non-indexed geometry: co-located vertices must jitter identically,
  // so derive the offset from the position hash, not the stream order.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h1 = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1;
    const h2 = Math.abs(Math.sin(x * 93.989 + y * 67.345 + z * 11.135) * 24634.6345) % 1;
    const h3 = Math.abs(Math.sin(x * 53.117 + y * 19.779 + z * 71.931) * 32458.1234) % 1;
    p.setXYZ(i,
      x * (0.82 + h1 * 0.36),
      y * (0.82 + h2 * 0.30),
      z * (0.82 + h3 * 0.36));
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- trees
function createTrees(scene) {
  const rng = makeRng(777001);
  const trunkGeos = [], canopyGeos = [];
  const treeSpots = [];

  function addTree(x, z, scale) {
    const h = heightAt(x, z);
    const trunkH = (2.2 + rng() * 1.3) * scale;
    const lean = (rng() - 0.5) * 0.16;

    // Trunk with a slight lean + flared base.
    const trunk = new THREE.CylinderGeometry(0.14 * scale, 0.30 * scale, trunkH, 7);
    trunk.translate(0, trunkH / 2, 0);
    trunk.rotateZ(lean);
    paintVerts(trunk, (c, vx, vy) => {
      const t = vy / trunkH;
      c.setRGB(0.34 - t * 0.05, 0.25 - t * 0.04, 0.18 - t * 0.03);
    });
    trunkGeos.push(trunk.applyMatrix4(new THREE.Matrix4().makeTranslation(x, h - 0.1, z)));

    // Root flare: a few wedges anchoring the trunk into the ground.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng();
      const root = new THREE.ConeGeometry(0.10 * scale, 0.42 * scale, 5);
      root.rotateX(Math.PI);
      root.translate(x + Math.cos(a) * 0.20 * scale, h + 0.10 * scale, z + Math.sin(a) * 0.20 * scale);
      paintVerts(root, (c) => c.setRGB(0.31, 0.23, 0.17));
      trunkGeos.push(root);
    }

    // Branches reaching into the canopy — kills the "lollipop" silhouette.
    const branchN = 3 + Math.floor(rng() * 3);
    const tips = [];
    for (let i = 0; i < branchN; i++) {
      const a = (i / branchN) * Math.PI * 2 + rng() * 0.7;
      const len = (0.9 + rng() * 0.7) * scale;
      const startY = h - 0.1 + trunkH * (0.55 + rng() * 0.3);
      const br = new THREE.CylinderGeometry(0.045 * scale, 0.085 * scale, len, 5);
      br.translate(0, len / 2, 0);
      const tilt = 0.7 + rng() * 0.4;
      br.rotateZ(Math.cos(a) * tilt);
      br.rotateX(-Math.sin(a) * tilt);
      br.translate(x + Math.sin(lean) * trunkH * 0.5, startY, z);
      paintVerts(br, (c) => c.setRGB(0.33, 0.24, 0.18));
      trunkGeos.push(br);
      tips.push([
        x + Math.cos(a) * len * 0.75 * tilt,
        startY + len * 0.7,
        z + Math.sin(a) * len * 0.75 * tilt,
      ]);
    }

    // Canopy: clusters at the branch tips + a crown, each cluster made of
    // several small blobs so the outline is lumpy like foliage.
    const tone0 = rng();
    const clusters = tips.concat([[x + Math.sin(lean) * trunkH * 0.6, h - 0.1 + trunkH + 0.55 * scale, z]]);
    for (const [tx, ty, tz] of clusters) {
      const lobes = 3 + Math.floor(rng() * 3);
      for (let j = 0; j < lobes; j++) {
        const r = (0.55 + rng() * 0.45) * scale;
        const b = blob(rng, r, 1);
        b.translate(
          tx + (rng() - 0.5) * 0.9 * scale,
          ty + (rng() - 0.5) * 0.6 * scale,
          tz + (rng() - 0.5) * 0.9 * scale
        );
        // Vertical gradient inside the canopy = built-in ambient occlusion.
        const tone = tone0 * 0.6 + rng() * 0.4;
        paintVerts(b, (c, vx, vy) => {
          const up = THREE.MathUtils.clamp((vy - (ty - r)) / (r * 2.2), 0, 1);
          const dark = [0.13, 0.30, 0.12], lit = [0.48, 0.72, 0.27];
          const warm = [0.60, 0.75, 0.30];
          const base = [
            dark[0] + (lit[0] - dark[0]) * up,
            dark[1] + (lit[1] - dark[1]) * up,
            dark[2] + (lit[2] - dark[2]) * up,
          ];
          c.setRGB(
            base[0] + (warm[0] - base[0]) * tone * 0.35,
            base[1] + (warm[1] - base[1]) * tone * 0.35,
            base[2] + (warm[2] - base[2]) * tone * 0.35
          );
        });
        canopyGeos.push(b);
      }
    }
  }

  let planted = 0, tries = 0;
  while (planted < 64 && tries < 6000) {
    tries++;
    const x = (rng() * 2 - 1) * (ISLAND_RADIUS - 15);
    const z = (rng() * 2 - 1) * (ISLAND_RADIUS - 15);
    const h = heightAt(x, z);
    if (h < 1.6 || h > 17) continue;
    if (slopeAt(x, z) > 0.34) continue;
    if (Math.hypot(x - 14, z + 20) < 26) continue; // keep the plaza clear
    addTree(x, z, 0.85 + rng() * 0.7);
    treeSpots.push([x, z, h]);
    planted++;
  }

  const trunkMat = new THREE.MeshToonMaterial({ vertexColors: true });
  const canopyMat = new THREE.MeshToonMaterial({ vertexColors: true });
  const trunks = new THREE.Mesh(mergeGeometries(trunkGeos), trunkMat);
  const canopies = new THREE.Mesh(mergeGeometries(canopyGeos), canopyMat);
  trunks.castShadow = canopies.castShadow = true;
  scene.add(trunks, canopies);

  // Contact blobs under each canopy — grounds trees into the meadow.
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const cx = c.getContext('2d');
  const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(10,20,12,0.40)');
  grad.addColorStop(1, 'rgba(10,20,12,0)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
  const blobTex = new THREE.CanvasTexture(c);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false });
  const blobGeos = treeSpots.map(([x, z, h]) => {
    const g = new THREE.CircleGeometry(2.1, 20);
    g.rotateX(-Math.PI / 2);
    g.translate(x, h + 0.045, z);
    return g;
  });
  const blobs = new THREE.Mesh(mergeGeometries(blobGeos), blobMat);
  blobs.renderOrder = 1;
  scene.add(blobs);
}

// ---------------------------------------------------------------- shrubs
// The mid-scale layer. Without something between ankle-high grass and
// full trees a landscape reads as empty no matter how good either is.
function createShrubs(scene) {
  const rng = makeRng(31337);
  const geos = [];
  let n = 0, tries = 0;
  while (n < 240 && tries < 9000) {
    tries++;
    const x = (rng() * 2 - 1) * (ISLAND_RADIUS - 10);
    const z = (rng() * 2 - 1) * (ISLAND_RADIUS - 10);
    const h = heightAt(x, z);
    if (h < 1.2 || h > 19) continue;
    if (slopeAt(x, z) > 0.40) continue;
    if (Math.hypot(x - 14, z + 20) < 12) continue;

    const scale = 0.55 + rng() * 0.75;
    const lobes = 3 + Math.floor(rng() * 3);
    const tone = rng();
    for (let i = 0; i < lobes; i++) {
      const r = (0.30 + rng() * 0.30) * scale;
      const b = blob(rng, r, 1);
      const a = rng() * Math.PI * 2;
      const rad = rng() * 0.45 * scale;
      const cy = h + r * 0.55 + rng() * 0.12 * scale;
      b.translate(x + Math.cos(a) * rad, cy, z + Math.sin(a) * rad);
      paintVerts(b, (c, vx, vy) => {
        const up = Math.max(0, Math.min(1, (vy - (cy - r)) / (r * 2)));
        const dark = [0.14, 0.28, 0.13], lit = [0.38, 0.60, 0.24];
        const warm = [0.55, 0.62, 0.24];
        c.setRGB(
          (dark[0] + (lit[0] - dark[0]) * up) * (1 - tone * 0.3) + warm[0] * tone * 0.3,
          (dark[1] + (lit[1] - dark[1]) * up) * (1 - tone * 0.3) + warm[1] * tone * 0.3,
          (dark[2] + (lit[2] - dark[2]) * up) * (1 - tone * 0.3) + warm[2] * tone * 0.3
        );
      });
      geos.push(b);
    }
    n++;
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos),
    new THREE.MeshToonMaterial({ vertexColors: true }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------------------------------------------------------------- rocks
function createRocks(scene) {
  const rng = makeRng(424242);
  const geos = [];
  let count = 0, tries = 0;
  while (count < 130 && tries < 9000) {
    tries++;
    const x = (rng() * 2 - 1) * (ISLAND_RADIUS - 8);
    const z = (rng() * 2 - 1) * (ISLAND_RADIUS - 8);
    const h = heightAt(x, z);
    if (h < 0.2) continue;
    if (Math.hypot(x - 14, z + 20) < 24) continue;
    const s = 0.5 + rng() * 1.8;
    const g = blob(rng, s, 1);
    const m = new THREE.Matrix4()
      .makeRotationY(rng() * Math.PI * 2)
      .setPosition(x, h - s * 0.25, z);
    g.applyMatrix4(m);
    paintVerts(g, (c) => {
      const t = 0.75 + rng() * 0.3;
      c.setRGB(0.47 * t, 0.44 * t, 0.40 * t);
    });
    geos.push(g);
    count++;
  }
  const mat = new THREE.MeshToonMaterial({ vertexColors: true });
  const rocks = new THREE.Mesh(mergeGeometries(geos), mat);
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);
}

export function createVegetation(scene, heightTex) {
  const grass = createGrass(scene, heightTex);
  const flowers = createFlowers(scene);
  createTrees(scene);
  createShrubs(scene);
  createRocks(scene);
  return {
    mesh: grass.mesh,
    update(t, camPos, focus) { grass.update(t, camPos, focus); flowers.update(camPos); },
  };
}
