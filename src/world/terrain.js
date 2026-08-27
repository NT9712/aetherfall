// Terrain: CPU-displaced island mesh built on MeshToonMaterial so it
// receives real shadow maps, with cel-banded light and procedural
// material blending (sand → meadow → cliff strata → snowcap) injected
// via onBeforeCompile. World-space detail stays crisp at any angle.

import * as THREE from 'three';
import { heightAt, WORLD_EXTENT, SHADER_COMMON } from './heightfield.js';

function makeGradientMap(steps = 4) {
  const data = new Uint8Array(steps);
  // Genshin-ish ramp: lifted shadows, tight highlight roll-off.
  const vals = [0.30, 0.58, 0.84, 1.0];
  for (let i = 0; i < steps; i++) data[i] = Math.round(vals[i] * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const terrainColors = [
  new THREE.Color('#4d8220'), new THREE.Color('#8ab34a'), new THREE.Color('#64943b'),
  new THREE.Color('#6b543b'), new THREE.Color('#e7d395'), new THREE.Color('#7b7162'),
  new THREE.Color('#544e45'), new THREE.Color('#eef5f8'), new THREE.Color('#247a80'),
  new THREE.Color('#a8b347'), new THREE.Color('#3c7849'), new THREE.Color('#ffffff'),
  new THREE.Color('#ffffff'),
];

export function createTerrain(scene) {
  const segs = 220;
  const geo = new THREE.PlaneGeometry(WORLD_EXTENT, WORLD_EXTENT, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({
    gradientMap: makeGradientMap(),
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {});

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      `)
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        uniform vec3 uTer[13];
        ${SHADER_COMMON}
        // Multi-octave fbm for surface detail.
        float fbm3(vec2 p){
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
          return s;
        }
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        {
          // Detail normal perturbation — breaks up flat shading across the
          // whole terrain without any texture maps.
          vec2 dp = vWorldPos.xz;
          float e = 0.35;
          float hC = fbm3(dp * 0.6);
          float hX = fbm3((dp + vec2(e, 0.0)) * 0.6);
          float hZ = fbm3((dp + vec2(0.0, e)) * 0.6);
          // Gentle: strong perturbation tips normals into the dark toon band
          // and both crushes overall luminance and kills shadow contrast.
          vec3 detN = normalize(vec3(-(hX - hC) * 1.1, 1.0, -(hZ - hC) * 1.1));
          float blend = 0.30 * (1.0 - smoothstep(45.0, 160.0, vViewPosition.z ));
          normal = normalize(mix(normal, normalize(normal + detN * 0.45), clamp(blend, 0.0, 0.30)));
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        {
          vec3 N = normalize(vWorldNormal);
          float h = vWorldPos.y;
          float steep = 1.0 - clamp(N.y, 0.0, 1.0);

          float macro  = vnoise(vWorldPos.xz * 0.055);
          float meso   = fbm3(vWorldPos.xz * 0.16);
          float detail = vnoise(vWorldPos.xz * 0.31);
          float fine   = fbm3(vWorldPos.xz * 1.1);

          vec3 grassA = uTer[0], grassB = uTer[1], grassC = uTer[2];
          vec3 grass = mix(grassA, grassB, smoothstep(0.28, 0.80, macro));
          grass = mix(grass, grassC, meso * 0.55);
          grass = mix(grass, uTer[9], smoothstep(0.66, 0.95, macro) * 0.30);
          grass = mix(grass, uTer[10], smoothstep(0.78, 0.98, 1.0 - macro) * 0.18);
          grass *= 0.86 + 0.28 * fine;

          // Worn dirt showing through on gentle rises and trails.
          vec3 dirt = uTer[3] * (0.85 + 0.3 * fine);
          float dirtM = smoothstep(0.62, 0.86, fbm3(vWorldPos.xz * 0.045 + 11.0)) *
                        (1.0 - smoothstep(0.35, 0.6, steep)) * 0.75;

          vec3 sand = uTer[4] * (0.90 + 0.20 * detail);
          float sandM = (1.0 - smoothstep(0.9, 2.0, h)) * (1.0 - smoothstep(0.55, 0.75, steep));
          sandM = max(sandM, 1.0 - smoothstep(-1.5, 0.4, h));

          vec3 rockA = uTer[5], rockB = uTer[6];
          float strata = sin(h * 1.7 + macro * 4.0) * 0.5 + 0.5;
          vec3 rock = mix(rockA, rockB, strata) * (0.82 + 0.34 * fine);
          float rockM = smoothstep(0.34, 0.55, steep + detail * 0.10);

          vec3 snow = uTer[7] * (0.92 + 0.12 * fine);
          float snowM = smoothstep(21.0, 24.5, h + detail * 1.2) *
                        (1.0 - smoothstep(0.62, 0.8, steep));

          vec3 albedo = grass;
          albedo = mix(albedo, dirt, dirtM);
          albedo = mix(albedo, sand, clamp(sandM, 0.0, 1.0));
          albedo = mix(albedo, rock, rockM);
          albedo = mix(albedo, snow, snowM);

          // Ground-cover texture: mid-frequency clumping stays visible at all
          // ranges, fine speckle fades with distance to avoid shimmer. This is
          // what keeps terrain beyond the grass field from reading as paint.
          float grassy = (1.0 - clamp(sandM, 0.0, 1.0)) * (1.0 - rockM) * (1.0 - snowM);
          float midTuft = fbm3(vWorldPos.xz * 0.85);
          float fineTuft = vnoise(vWorldPos.xz * 3.1);
          float fineFade = 1.0 - smoothstep(22.0, 70.0, vViewPosition.z);
          float tuft = (midTuft - 0.5) * 0.30 + (fineTuft - 0.5) * 0.26 * fineFade;
          albedo *= 1.0 + tuft * grassy;
          // Slight hue shift in the clumps so it isn't just brightness noise.
          albedo.g += tuft * 0.05 * grassy;

          vec3 wetTint = uTer[8];
          albedo = mix(albedo, wetTint, (1.0 - smoothstep(-2.0, 0.05, h)) * 0.7);

          // Cavity AO: creases and steep folds darken, ridges catch light.
          float cavity = 1.0 - smoothstep(0.35, 0.75, meso) * 0.15;
          float slopeAO = 1.0 - steep * 0.12;
          albedo *= cavity * slopeAO;

          diffuseColor.rgb *= albedo;
        }
      `);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return {
    mesh,
    update() {},
    // Recolor from a world palette (an array of 11 rgb triples).
    applyPalette(c) {
      const idx = { grassA:0, grassB:1, grassC:2, dirt:3, sand:4, rockA:5, rockB:6, snow:7, wet:8, warm:9, cool:10 };
      for (const [k, i] of Object.entries(idx)) {
        if (!c[k]) continue;
        const v = c[k];
        terrainColors[i].setRGB(v[0], v[1], v[2]);
      }
      // Push to the injected shader by bumping needsUpdate on the material.
      mat.needsUpdate = true;
    },
    colors: terrainColors,
  };
}
