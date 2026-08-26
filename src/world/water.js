// Stylized water: turquoise depth ramp, animated procedural normals,
// shoreline foam driven by the baked heightmap, fresnel sky reflection,
// banded sun glitter. Vertex bobbing for gentle swell.

import * as THREE from 'three';
import { SHADER_COMMON, SUN_DIR, PALETTE } from './heightfield.js';

export function createWater(scene, heightTex) {
  const decode = heightTex.userData.decode;
  const geo = new THREE.PlaneGeometry(1500, 1500, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uHeightMap: { value: heightTex },
    uHMin: { value: decode.MIN_H },
    uHRange: { value: decode.RANGE },
    uSunDir: { value: SUN_DIR.clone() },
    uZenith: { value: PALETTE.zenith.clone() },
    uHorizon: { value: PALETTE.horizon.clone() },
    uFogColor: { value: PALETTE.fog.clone() },
    uFogNear: { value: 55 },
    uFogFar: { value: 430 },
    uCamPos: { value: new THREE.Vector3() },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      uniform float uTime;
      ${SHADER_COMMON}
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // Gentle swell: two crossing sine fields.
        float swell =
          sin(wp.x * 0.055 + uTime * 0.9) * 0.10 +
          sin((wp.z * 0.041 - wp.x * 0.023) + uTime * 0.63) * 0.13;
        wp.y += swell;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      uniform float uTime, uHMin, uHRange, uFogNear, uFogFar;
      uniform sampler2D uHeightMap;
      uniform vec3 uSunDir, uZenith, uHorizon, uFogColor, uCamPos;
      ${SHADER_COMMON}

      // Animated ripple normal from finite differences of layered noise.
      // Structure mirrors the originally-verified version (inline time terms).
      vec3 rippleNormal(vec2 p){
        float e = 0.35;
        float t = uTime;
        float hx = ( vnoise(p * 0.9 + vec2(t*0.35, t*0.22))
                   + vnoise(p * 2.3 - vec2(t*0.27, t*0.41)) * 0.5 )
                - ( vnoise((p + vec2(e,0.0)) * 0.9 + vec2(t*0.35, t*0.22))
                   + vnoise((p + vec2(e,0.0)) * 2.3 - vec2(t*0.27, t*0.41)) * 0.5 );
        float hz = ( vnoise(p * 0.9 + vec2(t*0.35, t*0.22))
                   + vnoise(p * 2.3 - vec2(t*0.27, t*0.41)) * 0.5 )
                - ( vnoise((p + vec2(0.0,e)) * 0.9 + vec2(t*0.35, t*0.22))
                   + vnoise((p + vec2(0.0,e)) * 2.3 - vec2(t*0.27, t*0.41)) * 0.5 );
        return normalize(vec3(-hx * 1.4, 1.0, -hz * 1.4));
      }

      void main(){
        vec3 V = normalize(uCamPos - vWorldPos);
        float dist = distance(uCamPos, vWorldPos);
        vec2 p = vWorldPos.xz;

        // Flatten ripples with distance to avoid far-field shimmer.
        float rippleFade = exp(-dist * 0.006);
        vec3 N = normalize(mix(vec3(0,1,0), rippleNormal(p), 0.35 + 0.65 * rippleFade));
        if (dot(N, V) < 0.0) N = -N;

        float terrH = sampleTerrain(uHeightMap, p, uHMin, uHRange);
        float depth = max(vWorldPos.y - terrH, 0.0);

        // Genshin-style turquoise ramp — saturated, never gray.
        vec3 shallowC = vec3(0.30, 0.82, 0.78);
        vec3 midC     = vec3(0.14, 0.66, 0.74);
        vec3 deepC    = vec3(0.06, 0.42, 0.64);
        vec3 base = mix(shallowC, midC, smoothstep(0.15, 1.8, depth));
        base = mix(base, deepC, smoothstep(1.8, 7.0, depth));

        // Sunlight scattering in shallow water over sand.
        base += vec3(0.10, 0.14, 0.10) * (1.0 - smoothstep(0.0, 2.2, depth)) *
                (0.7 + 0.3 * vnoise(p * 0.5 + uTime * 0.2));

        // Fresnel reflection of the sky dome.
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 R = reflect(-V, N);
        vec3 skyRef = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
        vec3 col = mix(base, skyRef, 0.18 + 0.55 * fresnel);

        // Banded sun glitter — clamped so single-pixel HDR spikes can't
        // bloom into colored fireflies (standard AAA firefly suppression).
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, H), 0.0), 160.0);
        float sparkle = step(0.88, vnoise(p * 6.0 + uTime * 1.7)) * 0.35;
        vec3 glint = vec3(1.0, 0.95, 0.8) * (spec * 1.4 + spec * sparkle);
        col += min(glint, vec3(1.15));

        // Shoreline foam: two soft rings + animated lace near the contact line.
        float f1 = 1.0 - smoothstep(0.0, 1.15, depth);
        float lace = vnoise(p * 2.6 + vec2(uTime * 0.22, -uTime * 0.17));
        float foam = smoothstep(0.62, 0.9, f1 * (0.55 + 0.65 * lace));
        foam += (1.0 - smoothstep(0.02, 0.16, depth)) * (0.6 + 0.4 * sin(uTime * 1.4 + lace * 9.0));
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.85);

        // Alpha: see the sandy shallows, opaque in the deep.
        float alpha = mix(0.9, 0.97, smoothstep(0.0, 2.6, depth));
        alpha = max(alpha, foam * 0.95);

        // Fog.
        float fogF = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, fogF);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  scene.add(mesh);
  return {
    mesh,
    update(t, camPos) {
      uniforms.uTime.value = t;
      uniforms.uCamPos.value.copy(camPos);
    },
  };
}
