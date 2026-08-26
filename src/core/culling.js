// Chunked visibility culling, in the spirit of Minecraft's chunk system.
//
// The world is partitioned into fixed sectors. Every frame each sector is
// tested in increasing order of cost and rejected as early as possible:
//
//   1. distance      — beyond the render-distance ring
//   2. frustum       — outside the camera's view volume
//   3. occlusion     — line of sight to the sector is blocked by terrain
//
// Only sectors that survive all three are submitted for drawing. Because the
// scene's static props are merged per sector, rejecting a sector removes its
// whole batch in one `visible = false`, so the GPU never sees those polygons.

import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';

export const SECTOR_SIZE = 34;

export function sectorKey(ix, iz) { return `${ix},${iz}`; }
export function sectorIndex(x, z) {
  return [Math.floor(x / SECTOR_SIZE), Math.floor(z / SECTOR_SIZE)];
}

export class CullingManager {
  constructor() {
    this.sectors = new Map();      // key -> { ix, iz, center, radius, meshes[] }
    this.cullDistance = 230;
    this.enabled = true;
    this.occlusionEnabled = true;
    this._frustum = new THREE.Frustum();
    this._mat = new THREE.Matrix4();
    this._sphere = new THREE.Sphere();
    this.stats = { total: 0, drawn: 0, byDistance: 0, byFrustum: 0, byOcclusion: 0 };
  }

  // Register a mesh as belonging to the sector containing (x, z).
  add(mesh, x, z, radiusHint = SECTOR_SIZE) {
    const [ix, iz] = sectorIndex(x, z);
    const key = sectorKey(ix, iz);
    let s = this.sectors.get(key);
    if (!s) {
      const cx = (ix + 0.5) * SECTOR_SIZE;
      const cz = (iz + 0.5) * SECTOR_SIZE;
      s = {
        ix, iz,
        center: new THREE.Vector3(cx, heightAt(cx, cz) + 4, cz),
        radius: SECTOR_SIZE * 0.75,
        meshes: [],
      };
      this.sectors.set(key, s);
    }
    s.radius = Math.max(s.radius, radiusHint);
    s.meshes.push(mesh);
    // Three's own per-object frustum test is redundant once we cull sectors,
    // and its bounding spheres are wrong for shader-displaced geometry.
    mesh.frustumCulled = false;
    return s;
  }

  // Terrain occlusion: march the segment from eye to sector centre and look
  // for ground standing above the line. This is the cheap analogue of
  // Minecraft's "can this chunk be seen from here" visibility test.
  _occluded(eye, target) {
    const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
    const dist = Math.hypot(dx, dz);
    if (dist < SECTOR_SIZE) return false;
    const steps = Math.min(14, Math.max(5, Math.floor(dist / 22)));
    let blocked = 0;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = eye.x + dx * t;
      const sz = eye.z + dz * t;
      const rayY = eye.y + dy * t;
      // Margin scales with distance so distant sectors aren't over-culled by
      // heightmap noise.
      const margin = 1.5 + t * 4.0;
      if (heightAt(sx, sz) > rayY + margin) {
        if (++blocked >= 2) return true;   // two hits = a real ridge
      }
    }
    return false;
  }

  update(camera, eye) {
    if (!this.enabled) return;
    this._mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._mat);

    const st = this.stats;
    st.total = st.drawn = st.byDistance = st.byFrustum = st.byOcclusion = 0;
    const cullSq = this.cullDistance * this.cullDistance;

    for (const s of this.sectors.values()) {
      st.total++;
      let visible = true;

      const ddx = s.center.x - eye.x, ddz = s.center.z - eye.z;
      if (ddx * ddx + ddz * ddz > cullSq) { visible = false; st.byDistance++; }

      if (visible) {
        this._sphere.center.copy(s.center);
        this._sphere.radius = s.radius;
        if (!this._frustum.intersectsSphere(this._sphere)) { visible = false; st.byFrustum++; }
      }

      if (visible && this.occlusionEnabled && this._occluded(eye, s.center)) {
        visible = false; st.byOcclusion++;
      }

      if (visible) st.drawn++;
      for (const m of s.meshes) m.visible = visible;
    }
  }
}
