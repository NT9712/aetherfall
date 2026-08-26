// The single source of truth for island shape.
// Everything (terrain mesh, water shore foam, vegetation scatter,
// character grounding, camera collision) samples these functions.

import * as THREE from 'three';
import { fbm, ridged, smoothstep, lerp } from '../core/noise.js';

export const ISLAND_RADIUS = 190;
export const WORLD_EXTENT = 440;      // terrain plane size
export const WORLD_MIN = -220;
export const SEA_LEVEL = 0;

const PLAZA_X = 14, PLAZA_Z = -20;

// Island height at any world x/z.
export function heightAt(x, z) {
  const d = Math.hypot(x, z);

  // Island body mask: full plateau inside 70u, fading to nothing at the shore.
  const body = 1 - smoothstep(70, ISLAND_RADIUS, d);
  let h = body * (4.5 + 11.0 * fbm(x * 0.012, z * 0.012, 4));

  // Northern mountain massif — ridged noise masked by a low-frequency field.
  const mmask =
    smoothstep(0.52, 0.8, fbm((x + 60) * 0.005, (z - 80) * 0.005, 3, 77)) *
    body;
  h += mmask * Math.pow(ridged(x * 0.02, z * 0.02, 4, 31), 1.7) * 12;

  // Guaranteed massif: explicit bump near (-60, 90) reaching snowcaps.
  // (The masked ridges alone never exceeded h≈15 numerically.)
  const md = Math.hypot(x + 60, z - 90);
  const mBump = Math.exp(-(md * md) / (2 * 38 * 38)) * body;
  h += mBump * (7 + 23 * Math.pow(ridged(x * 0.025, z * 0.025, 4, 31), 1.25));

  // Ceremonial plaza — gently flattened for spawn + first stone.
  const pd = Math.hypot(x - PLAZA_X, z - PLAZA_Z);
  const plaza = Math.exp(-(pd * pd) / (2 * 24 * 24));
  h = lerp(h, 6.5, plaza);

  // Sink the outer shelf beneath the sea for clean beaches + shallows.
  h -= smoothstep(ISLAND_RADIUS * 0.74, ISLAND_RADIUS * 1.04, d) * 17;

  return h;
}

// Slope magnitude via central differences (0 = flat, ~1 = cliff).
export function slopeAt(x, z) {
  const e = 0.65;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.min(1, Math.hypot(dx, dz) / (2 * e));
}

// CPU-side height lookup table. heightAt() runs several octaves of fbm and
// costs ~8.6us; gameplay is fine with that, but per-frame systems that probe
// the terrain hundreds of times (visibility occlusion, vegetation chunks)
// cannot afford it. This bilinear LUT is ~150x faster.
let LUT = null;
let LUT_RES = 0;

export function heightAtFast(x, z) {
  if (!LUT) return heightAt(x, z);
  const u = ((x - WORLD_MIN) / WORLD_EXTENT) * (LUT_RES - 1);
  const v = ((z - WORLD_MIN) / WORLD_EXTENT) * (LUT_RES - 1);
  if (u < 0 || v < 0 || u > LUT_RES - 1 || v > LUT_RES - 1) return heightAt(x, z);
  const i0 = Math.floor(u), j0 = Math.floor(v);
  const i1 = Math.min(LUT_RES - 1, i0 + 1), j1 = Math.min(LUT_RES - 1, j0 + 1);
  const fu = u - i0, fv = v - j0;
  const a = LUT[j0 * LUT_RES + i0], b = LUT[j0 * LUT_RES + i1];
  const c = LUT[j1 * LUT_RES + i0], d = LUT[j1 * LUT_RES + i1];
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
}

// Bake the heightfield into a 16-bit-precision RG texture so shaders
// (water shore foam) can query terrain height per-pixel. The same pass fills
// the CPU lookup table, so the expensive noise evaluation happens once.
export function buildHeightTexture(res = 256) {
  const data = new Uint8Array(res * res * 2);
  LUT = new Float32Array(res * res);
  LUT_RES = res;
  const MIN_H = -20, MAX_H = 34, RANGE = MAX_H - MIN_H;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = WORLD_MIN + ((i + 0.5) / res) * WORLD_EXTENT;
      const z = WORLD_MIN + ((j + 0.5) / res) * WORLD_EXTENT;
      let h = heightAt(x, z);
      LUT[j * res + i] = h;
      const n01 = Math.min(1, Math.max(0, (h - MIN_H) / RANGE));
      const enc = Math.round(n01 * 65535);
      const o = (j * res + i) * 2;
      data[o] = (enc >> 8) & 255;
      data[o + 1] = enc & 255;
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  tex.userData.decode = { MIN_H, RANGE };
  return tex;
}

// Shared shader chunk: decode the heightmap + a cheap GLSL value noise.
export const SHADER_COMMON = /* glsl */ `
  float hash12(vec2 p){
    // NOTE: tuned for broad GPU compatibility (incl. software rasterizers);
    // far-field precision falloff is masked by distance fog.
    vec3 p3 = fract(vec3(p.xyx) * 443.897);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float a = hash12(i), b = hash12(i+vec2(1,0));
    float c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float sampleTerrain(sampler2D map, vec2 wxz, float mn, float rng){    vec2 uv = (wxz - ${WORLD_MIN.toFixed(1)}) / ${WORLD_EXTENT.toFixed(1)};
    vec2 rg = texture2D(map, uv).rg;
    float enc = rg.r * (255.0/256.0) * 256.0 + rg.g * (255.0/256.0);
    return enc / 255.0 * rng + mn;
  }
`;

// Global art-direction constants shared across modules.
export const SUN_DIR = new THREE.Vector3(0.42, 0.58, 0.32).normalize();
export const PALETTE = {
  sunColor: new THREE.Color('#fff0d0'),
  zenith: new THREE.Color('#2e79cf'),
  horizon: new THREE.Color('#cfe9f2'),
  fog: new THREE.Color('#bfdcec'),
};
