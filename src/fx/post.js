// Post pipeline: bloom for emissives/beacons + final color grade pass
// (subtle vignette, saturation lift, soft contrast S-curve), then OutputPass
// handles tone mapping + sRGB.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.20 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uVignette, uSaturation;
    void main(){
      vec4 col4 = texture2D(tDiffuse, vUv);
      vec3 col = col4.rgb;

      // Saturation lift toward the vivid stylized look.
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);

      // Gentle S-curve for contrast without crushing shadows.
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.25);

      // Soft vignette.
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette * 2.0;
      col *= clamp(vig, 0.0, 1.0);

      gl_FragColor = vec4(col, col4.a);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);

  composer.addPass(new RenderPass(scene, camera));
  // Higher threshold: only genuinely emissive things (shards, sun, glints)
  // should bloom — a low threshold hazes the entire image.
  const bloom = new UnrealBloomPass(size, 0.34, 0.6, 0.95);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  return {
    composer,
    bloom,
    render() { composer.render(); },
  };
}
