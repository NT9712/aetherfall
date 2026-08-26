// The Traveler — stylized anime protagonist assembled from primitives.
//
// Design targets (stylized-AAA character checklist):
//   · ~6.5-head heroic-anime proportion, defined waist, layered silhouette
//   · face that reads at distance: large eyes w/ iris + specular, brows, mouth
//   · layered hair — cap, swept fringe with distinct locks, side sweeps, braid
//   · clothing built from separate panels (bodice, collar, sleeves, skirt,
//     leg wraps, boots with cuffs) so the silhouette breaks up
//   · ink outlines, toon ramp, warm bounce fill, rim light
//   · procedural anim: idle breath + weight shift, walk/run/sprint, jump,
//     glide, with counter-rotating torso, head stabilisation, cloth lag

import * as THREE from 'three';

function makeGradientMap() {
  // 4-step ramp with a lifted shadow — the classic anime shading read.
  const data = new Uint8Array([118, 176, 232, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const C = {
  skin:       '#ffdcc0',
  skinShade:  '#f0bd9c',
  hair:       '#f0d27a',
  hairShade:  '#d2ab52',
  hairLight:  '#fbe9a8',
  cloth:      '#f7f3e7',
  clothShade: '#d9d2be',
  accent:     '#3d6fc9',
  accentDeep: '#2b4f96',
  gold:       '#e9b845',
  boots:      '#5b4630',
  outline:    '#241b12',
};

export function createCharacter(scene) {
  const gradientMap = makeGradientMap();
  const mats = {};
  for (const [k, hex] of Object.entries(C)) {
    if (k === 'outline') continue;
    mats[k] = new THREE.MeshToonMaterial({ color: hex, gradientMap });
  }
  // Rim light on the character keeps it readable against foliage.
  for (const key of ['skin', 'cloth', 'hair', 'accent']) {
    mats[key].onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n varying vec3 vRimN; varying vec3 vRimV;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          float rim = pow(1.0 - clamp(dot(normalize(vRimN), normalize(vRimV)), 0.0, 1.0), 2.6);
          gl_FragColor.rgb += vec3(0.55, 0.68, 0.85) * rim * 0.35;`);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n varying vec3 vRimN; varying vec3 vRimV;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>
          vRimN = normalize(mat3(modelMatrix) * normal);
          vRimV = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);`);
    };
  }
  const outlineMat = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#fdfbf5' });
  const irisMat = new THREE.MeshBasicMaterial({ color: '#2f7fb8' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#241a14' });
  const browMat = new THREE.MeshBasicMaterial({ color: '#b8873c' });
  const mouthMat = new THREE.MeshBasicMaterial({ color: '#b5705f' });

  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);

  function part(geo, mat, parent, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    if (o.scale) m.scale.set(...o.scale);
    m.castShadow = !o.noShadow;
    parent.add(m);
    if (!o.noOutline) {
      const ol = new THREE.Mesh(geo, outlineMat);
      ol.scale.setScalar(o.outline || 1.055);
      ol.raycast = () => {};
      m.add(ol);
    }
    return m;
  }

  // ─── skeleton ────────────────────────────────────────────────────────
  const HIP_Y = 0.92;
  const hips = new THREE.Group(); hips.position.y = HIP_Y; model.add(hips);
  const torso = new THREE.Group(); torso.position.y = 0.10; hips.add(torso);
  const chest = new THREE.Group(); chest.position.y = 0.22; torso.add(chest);
  const neck = new THREE.Group(); neck.position.y = 0.30; chest.add(neck);
  const headGrp = new THREE.Group(); headGrp.position.y = 0.10; neck.add(headGrp);

  // ─── body ────────────────────────────────────────────────────────────
  // Pelvis + cinched waist + ribcage: gives an actual figure, not a tube.
  part(new THREE.CapsuleGeometry(0.115, 0.06, 4, 12), mats.clothShade, hips, 0, 0.01, 0,
    { scale: [1.15, 0.95, 0.92] });
  part(new THREE.CylinderGeometry(0.098, 0.112, 0.16, 14), mats.cloth, torso, 0, 0.06, 0,
    { scale: [1.12, 1, 0.9] });
  const ribs = part(new THREE.CapsuleGeometry(0.128, 0.14, 4, 14), mats.cloth, chest, 0, 0.04, 0);
  ribs.scale.set(1.16, 1, 0.86);

  // Collar + shoulder yoke.
  part(new THREE.CylinderGeometry(0.115, 0.135, 0.07, 14), mats.accent, chest, 0, 0.20, 0,
    { scale: [1.14, 1, 0.9], noShadow: true });
  part(new THREE.TorusGeometry(0.075, 0.022, 8, 16), mats.gold, chest, 0, 0.235, 0.02,
    { rx: Math.PI / 2, noShadow: true, noOutline: true });

  // Waist sash + hanging tassel.
  part(new THREE.CylinderGeometry(0.104, 0.104, 0.075, 14), mats.accentDeep, torso, 0, 0.0, 0,
    { scale: [1.14, 1, 0.93], noShadow: true });
  part(new THREE.SphereGeometry(0.032, 8, 8), mats.gold, torso, 0.085, -0.01, 0.06,
    { noShadow: true, noOutline: true });
  part(new THREE.BoxGeometry(0.03, 0.16, 0.012), mats.gold, torso, 0.085, -0.10, 0.06,
    { noShadow: true, noOutline: true });

  // Coat skirt: four panels so it reads as cloth, not a cone.
  const skirtPanels = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pivot = new THREE.Group();
    pivot.position.set(Math.sin(a) * 0.055, -0.02, Math.cos(a) * 0.045);
    pivot.rotation.y = a;
    hips.add(pivot);
    part(new THREE.BoxGeometry(0.15, 0.30, 0.035), i % 2 ? mats.cloth : mats.clothShade,
      pivot, 0, -0.15, 0.055, { rx: -0.12, noShadow: true });
    skirtPanels.push(pivot);
  }

  // ─── head ────────────────────────────────────────────────────────────
  const head = part(new THREE.SphereGeometry(0.145, 22, 18), mats.skin, headGrp, 0, 0.085, 0,
    { scale: [1, 1.08, 0.97] });
  // Jaw taper — a sphere alone reads as a ball.
  part(new THREE.SphereGeometry(0.10, 16, 12), mats.skin, headGrp, 0, 0.015, 0.012,
    { scale: [1.02, 0.85, 1.02], noShadow: true, noOutline: true });
  part(new THREE.CylinderGeometry(0.048, 0.055, 0.07, 10), mats.skin, neck, 0, 0.02, 0,
    { noShadow: true });

  // Eyes: white + iris + pupil + specular dot, angled slightly.
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * 0.058, 0.085, 0.118);
    e.rotation.z = s * 0.10;
    head.add(e);
    part(new THREE.SphereGeometry(0.030, 12, 12), eyeWhiteMat, e, 0, 0, 0,
      { scale: [1, 1.30, 0.42], noShadow: true, noOutline: true });
    part(new THREE.SphereGeometry(0.020, 12, 12), irisMat, e, 0, -0.004, 0.012,
      { scale: [1, 1.18, 0.4], noShadow: true, noOutline: true });
    part(new THREE.SphereGeometry(0.011, 10, 10), pupilMat, e, 0, -0.004, 0.019,
      { scale: [1, 1.15, 0.4], noShadow: true, noOutline: true });
    part(new THREE.SphereGeometry(0.006, 8, 8), eyeWhiteMat, e, -s * 0.008, 0.010, 0.023,
      { noShadow: true, noOutline: true });
    // Upper lash line — the strongest readability cue at distance.
    part(new THREE.BoxGeometry(0.062, 0.011, 0.010), pupilMat, e, 0, 0.028, 0.012,
      { rz: s * 0.16, noShadow: true, noOutline: true });
    eyes.push(e);
  }
  for (const s of [-1, 1]) {
    part(new THREE.BoxGeometry(0.05, 0.010, 0.008), browMat, head,
      s * 0.058, 0.128, 0.124, { rz: s * 0.22, noShadow: true, noOutline: true });
  }
  part(new THREE.SphereGeometry(0.012, 8, 8), mouthMat, head, 0, 0.012, 0.132,
    { scale: [1.5, 0.55, 0.4], noShadow: true, noOutline: true });
  // Blush.
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.022, 8, 8), mats.skinShade, head,
      s * 0.085, 0.045, 0.105, { scale: [1.2, 0.7, 0.3], noShadow: true, noOutline: true });
  }

  // ─── hair (layered) ──────────────────────────────────────────────────
  const hairGrp = new THREE.Group(); headGrp.add(hairGrp);
  // Cap.
  part(new THREE.SphereGeometry(0.158, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mats.hair, hairGrp, 0, 0.088, -0.004, { scale: [1.06, 1.05, 1.06] });
  // Back mass.
  part(new THREE.SphereGeometry(0.142, 16, 14), mats.hairShade, hairGrp, 0, 0.045, -0.055,
    { scale: [1.06, 1.12, 0.95] });
  // Fringe: distinct tapered locks across the brow (cones read as hair strands).
  const fringe = [
    [-0.098, 0.150, 0.072, 0.34, 0.030],
    [-0.052, 0.163, 0.100, 0.10, 0.034],
    [ 0.000, 0.166, 0.108, -0.05, 0.030],
    [ 0.050, 0.163, 0.100, -0.16, 0.033],
    [ 0.098, 0.150, 0.072, -0.36, 0.029],
  ];
  for (const [x, y, z, rz, r] of fringe) {
    part(new THREE.ConeGeometry(r, 0.115, 6), mats.hairLight, hairGrp, x, y, z,
      { rx: 0.62, rz, noShadow: true, outline: 1.07 });
  }
  // Side sweeps framing the cheeks.
  for (const s of [-1, 1]) {
    part(new THREE.ConeGeometry(0.036, 0.20, 6), mats.hair, hairGrp,
      s * 0.132, 0.045, 0.045, { rx: 0.18, rz: s * 0.12, noShadow: true });
  }
  // Braid down the back.
  const braid = [];
  let bp = hairGrp;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? -0.02 : -0.088, i === 0 ? -0.125 : 0);
    bp.add(seg);
    part(new THREE.SphereGeometry(0.046 - i * 0.0045, 10, 8),
      i % 2 ? mats.hairShade : mats.hair, seg, 0, 0, 0, { noShadow: i > 1 });
    braid.push(seg); bp = seg;
  }
  part(new THREE.TorusGeometry(0.026, 0.010, 6, 12), mats.accent, braid[5], 0, 0.02, 0,
    { rx: Math.PI / 2, noShadow: true, noOutline: true });

  // ─── limbs ───────────────────────────────────────────────────────────
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.155, 0.175, 0);
    chest.add(shoulder);
    // Puffed sleeve cap breaks the silhouette.
    part(new THREE.SphereGeometry(0.062, 12, 10), mats.cloth, shoulder, 0, -0.015, 0,
      { scale: [1, 0.9, 1], noShadow: true });
    part(new THREE.CapsuleGeometry(0.040, 0.15, 4, 10), mats.cloth, shoulder, 0, -0.115, 0);
    const elbow = new THREE.Group(); elbow.position.y = -0.205; shoulder.add(elbow);
    part(new THREE.CapsuleGeometry(0.034, 0.135, 4, 10), mats.skin, elbow, 0, -0.085, 0);
    // Glove cuff + hand.
    part(new THREE.CylinderGeometry(0.040, 0.036, 0.045, 10), mats.accent, elbow, 0, -0.155, 0,
      { noShadow: true });
    part(new THREE.SphereGeometry(0.040, 10, 10), mats.accentDeep, elbow, 0, -0.190, 0,
      { scale: [1, 1.15, 0.8], noShadow: true });
    return { shoulder, elbow };
  }
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.075, -0.055, 0);
    hips.add(hip);
    part(new THREE.CapsuleGeometry(0.058, 0.20, 4, 10), mats.skin, hip, 0, -0.145, 0);
    const knee = new THREE.Group(); knee.position.y = -0.285; hip.add(knee);
    part(new THREE.CapsuleGeometry(0.044, 0.185, 4, 10), mats.skin, knee, 0, -0.105, 0);
    // Boot: shaft, cuff, foot — three pieces so the leg has a terminus.
    part(new THREE.CylinderGeometry(0.052, 0.056, 0.16, 10), mats.boots, knee, 0, -0.175, 0);
    part(new THREE.CylinderGeometry(0.060, 0.060, 0.035, 10), mats.accent, knee, 0, -0.098, 0,
      { noShadow: true });
    part(new THREE.BoxGeometry(0.075, 0.05, 0.135), mats.boots, knee, 0, -0.268, 0.022,
      { noShadow: true });
    return { hip, knee };
  }
  const armL = arm(-1), armR = arm(1);
  const legL = leg(-1), legR = leg(1);

  // ─── scarf ───────────────────────────────────────────────────────────
  const scarfMat = new THREE.MeshToonMaterial({ color: C.accent, gradientMap });
  const scarf = [];
  let sp = chest;
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.22 : -0.105, i === 0 ? -0.075 : 0);
    sp.add(seg);
    if (i === 0) {
      part(new THREE.TorusGeometry(0.088, 0.030, 8, 16), scarfMat, seg, 0, 0, 0.02,
        { rx: Math.PI / 2, noShadow: true });
    } else {
      part(new THREE.BoxGeometry(0.105 - i * 0.008, 0.10, 0.024), scarfMat, seg, 0, 0, 0,
        { noShadow: true, noOutline: i > 5 });
    }
    scarf.push(seg); sp = seg;
  }

  // ─── glider ──────────────────────────────────────────────────────────
  const glider = new THREE.Group();
  glider.position.set(0, 0.30, -0.16);
  glider.visible = false;
  const wingGeo = new THREE.SphereGeometry(0.8, 16, 10, 0, Math.PI);
  wingGeo.scale(1, 0.34, 0.5);
  const wingMat = new THREE.MeshToonMaterial({ color: '#eaf1ff', gradientMap, side: THREE.DoubleSide });
  const wingTrim = new THREE.MeshToonMaterial({ color: C.accent, gradientMap, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.rotation.y = s === -1 ? 0 : Math.PI;
    w.rotation.z = s * 0.26;
    w.castShadow = true;
    glider.add(w);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 20, Math.PI), wingTrim);
    t.position.set(s * 0.38, -0.10, 0);
    t.rotation.set(Math.PI / 2, 0, s * 0.3);
    glider.add(t);
  }
  part(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 6), mats.boots, glider, 0, -0.12, 0,
    { rx: Math.PI / 2, noShadow: true, noOutline: true });
  model.add(glider);

  scene.add(root);

  // ─── animation ───────────────────────────────────────────────────────
  let phase = 0, blinkTimer = 2 + Math.random() * 3, blink = 0, idleT = 0;
  const lerp = (a, b, k) => a + (b - a) * k;

  function animate(dt, p) {
    const speed = p.speed01;
    idleT += dt;
    phase += dt * (5.0 + speed * 6.0) * (speed > 0.03 && p.grounded ? 1 : 0);
    const amp = speed * (p.sprinting ? 1.2 : 0.9);

    let tHipL = 0, tHipR = 0, tKneeL = 0, tKneeR = 0,
        tShoL = 0, tShoR = 0, tElb = -0.30,
        lean = 0, bob = 0, twist = 0, sideLean = 0;

    if (!p.grounded && p.gliding) {
      tHipL = tHipR = 0.42; tKneeL = tKneeR = 0.30;
      tShoL = tShoR = -2.5; tElb = -0.20; lean = 0.58;
    } else if (!p.grounded) {
      const rising = p.vy > 0;
      tHipL = rising ? 0.55 : 0.30; tHipR = rising ? -0.18 : 0.05;
      tKneeL = rising ? 0.95 : 0.45; tKneeR = 0.35;
      tShoL = -1.0; tShoR = 0.75; lean = rising ? -0.10 : 0.14;
    } else if (speed > 0.03) {
      tHipL = Math.sin(phase) * amp * 0.9;
      tHipR = Math.sin(phase + Math.PI) * amp * 0.9;
      tKneeL = Math.max(0, -Math.sin(phase)) * amp * 1.25;
      tKneeR = Math.max(0, -Math.sin(phase + Math.PI)) * amp * 1.25;
      tShoL = Math.sin(phase + Math.PI) * amp * 0.8;
      tShoR = Math.sin(phase) * amp * 0.8;
      tElb = -0.45 - amp * 0.65;
      lean = 0.06 + amp * 0.20;
      bob = Math.abs(Math.cos(phase)) * 0.045 * amp;
      twist = Math.sin(phase) * amp * 0.16;      // counter-rotating torso
      sideLean = Math.cos(phase) * amp * 0.05;
    } else {
      // Idle: breath + subtle weight shift.
      const br = Math.sin(idleT * 1.6);
      const sh = Math.sin(idleT * 0.5);
      bob = br * 0.008;
      tShoL = 0.04 + br * 0.03; tShoR = 0.04 - br * 0.03;
      tElb = -0.32;
      sideLean = sh * 0.035;
      twist = sh * 0.05;
    }

    const k = Math.min(1, dt * 13);
    legL.hip.rotation.x = lerp(legL.hip.rotation.x, tHipL, k);
    legR.hip.rotation.x = lerp(legR.hip.rotation.x, tHipR, k);
    legL.knee.rotation.x = lerp(legL.knee.rotation.x, tKneeL, k);
    legR.knee.rotation.x = lerp(legR.knee.rotation.x, tKneeR, k);
    armL.shoulder.rotation.x = lerp(armL.shoulder.rotation.x, tShoL, k);
    armR.shoulder.rotation.x = lerp(armR.shoulder.rotation.x, tShoR, k);
    armL.elbow.rotation.x = lerp(armL.elbow.rotation.x, tElb, k);
    armR.elbow.rotation.x = lerp(armR.elbow.rotation.x, tElb, k);
    armL.shoulder.rotation.z = lerp(armL.shoulder.rotation.z, p.gliding ? 0.05 : 0.13, k);
    armR.shoulder.rotation.z = lerp(armR.shoulder.rotation.z, p.gliding ? -0.05 : -0.13, k);

    model.rotation.x = lerp(model.rotation.x, lean, k);
    model.rotation.z = lerp(model.rotation.z, sideLean, k);
    hips.position.y = lerp(hips.position.y, HIP_Y + bob, k);
    chest.rotation.y = lerp(chest.rotation.y, twist, k);
    hips.rotation.y = lerp(hips.rotation.y, -twist * 0.5, k);
    // Head stabilises against torso motion (animation-quality tell).
    neck.rotation.y = lerp(neck.rotation.y, -twist * 0.7, k);
    neck.rotation.x = lerp(neck.rotation.x, -lean * 0.55, k);

    // Blink.
    blinkTimer -= dt;
    if (blinkTimer <= 0) { blink = 1; blinkTimer = 2.5 + Math.random() * 4; }
    if (blink > 0) {
      blink = Math.max(0, blink - dt * 7);
      const open = 1 - Math.sin(blink * Math.PI) * 0.92;
      for (const e of eyes) e.scale.y = open;
    }

    // Cloth: scarf streams, skirt panels lag and lift.
    const tn = idleT;
    scarf.forEach((seg, i) => {
      if (i === 0) return;
      const wave = Math.sin(tn * 6.5 - i * 0.85) * 0.13;
      const lift = speed * 0.5 + (p.gliding ? 0.9 : 0) + (!p.grounded ? 0.3 : 0);
      seg.rotation.x = 0.10 + wave * 0.5 - lift * 0.55;
      seg.rotation.z = Math.cos(tn * 4.4 - i * 1.05) * 0.09;
    });
    skirtPanels.forEach((pv, i) => {
      const sway = Math.sin(tn * 5.0 + i * 1.7) * 0.06;
      pv.rotation.x = lerp(pv.rotation.x, sway - speed * 0.30 - (p.gliding ? 0.35 : 0), k);
    });
    braid.forEach((seg, i) => {
      const sway = Math.sin(tn * 3.6 - i * 0.75) * 0.09 + speed * Math.sin(phase - i * 0.5) * 0.07;
      seg.rotation.x = 0.05 + sway * 0.4 - (speed * 0.5 + (p.gliding ? 0.6 : 0)) * 0.10 * i;
      seg.rotation.z = sway * 0.28;
    });
  }

  return {
    root, model, glider,
    setPosition(x, y, z) { root.position.set(x, y, z); },
    setYaw(y) { root.rotation.y = y; },
    setGliding(on) { glider.visible = on; },
    update(dt, p) { animate(dt, p); },
  };
}
