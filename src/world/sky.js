// Sky dome with procedural layered clouds.
//
// Replaces the old billboard-sprite clouds: a single dome draw with an fbm
// cloud field gives far more detail, correct silver-lining toward the sun,
// and none of the alpha overdraw that huge sprites incur.

import * as THREE from 'three';
import { SUN_DIR, PALETTE } from './heightfield.js';

export function createSky(scene) {
  const geo = new THREE.SphereGeometry(900, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uZenith: { value: PALETTE.zenith.clone().offsetHSL(0.02, 0.18, -0.04) },
      uHorizon: { value: PALETTE.horizon.clone() },
      uSunDir: { value: SUN_DIR.clone() },
      uSunTint: { value: new THREE.Color('#fff3cf') },
      uCloudLit: { value: new THREE.Color('#fffdf6') },
      uCloudShade: { value: new THREE.Color('#9fb2cc') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      uniform vec3 uZenith, uHorizon, uSunTint, uSunDir, uCloudLit, uCloudShade;

      float hash(vec2 p){
        vec3 p3 = fract(vec3(p.xyx) * 443.897);
        p3 += dot(p3, p3.yzx + 19.19);
        return fract((p3.x + p3.y) * p3.z);
      }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.02 + 1.7; a *= 0.5; }
        return s;
      }

      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.05, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(max(h, 0.0), 0.62));

        float sunAmt = max(dot(d, uSunDir), 0.0);
        col += uSunTint * pow(sunAmt, 8.0) * 0.32;

        // ---- cloud layers -------------------------------------------------
        // Project the view direction onto a cloud plane; two layers at
        // different scales and speeds give parallax and depth.
        if (d.y > 0.008) {
          vec2 uv = d.xz / (d.y + 0.12);
          float coverEdge = smoothstep(0.010, 0.16, d.y);   // fade at horizon

          vec2 p1 = uv * 1.15 + vec2(uTime * 0.0065, uTime * 0.0034);
          float f1 = fbm(p1);
          f1 = fbm(p1 + vec2(f1 * 0.6));                    // domain warp
          float c1 = smoothstep(0.50, 0.80, f1);

          vec2 p2 = uv * 2.6 - vec2(uTime * 0.011, uTime * 0.006);
          float f2 = fbm(p2);
          float c2 = smoothstep(0.56, 0.86, f2) * 0.55;

          float cloud = clamp(c1 + c2 * (1.0 - c1), 0.0, 1.0) * coverEdge;

          // Shade by density gradient toward the sun => silver lining.
          vec2 sunUV = normalize(uSunDir.xz) * 0.16;
          float toward = fbm(p1 + sunUV);
          float lighting = clamp((f1 - toward) * 3.4 + 0.55, 0.0, 1.0);
          vec3 cloudCol = mix(uCloudShade, uCloudLit, lighting);
          cloudCol += uSunTint * pow(sunAmt, 6.0) * 0.5 * lighting;

          // Wispy detail at the fringes keeps edges from looking cut out.
          float wisp = smoothstep(0.42, 0.62, f1) * (1.0 - c1) * 0.35 * coverEdge;
          col = mix(col, cloudCol, cloud * 0.94);
          col = mix(col, mix(cloudCol, col, 0.4), wisp);
        }

        // Sun disc above the clouds.
        col += uSunTint * smoothstep(0.9987, 0.9993, sunAmt) * 3.0;
        col += vec3(1.0, 0.9, 0.7) * pow(sunAmt, 90.0) * 0.5;

        // Horizon haze.
        col = mix(col, uHorizon * 1.04, smoothstep(0.16, 0.0, abs(d.y)) * 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1;
  scene.add(dome);
  dome.tick = (t) => { mat.uniforms.uTime.value = t; };
  return dome;
}

// Kept for API compatibility: cloud sprites are gone (the dome renders them),
// so this returns a no-op handle.
export function createClouds() {
  const g = new THREE.Group();
  g.tick = () => {};
  return g;
}
