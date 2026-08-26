// VISUAL CRITIC — an unforgiving automated art director.
//
// Renders the game from a set of vantages and scores each frame against
// thresholds calibrated to AAA stylized-open-world reference frames.
// It does not care about effort. It only reports what the eye would see.

import fs from 'fs';
import { PNG } from 'pngjs';

const T = {
  flatRatio:      { max: 0.32, label: 'untextured/flat area' },
  edgeDensity:    { min: 0.055, label: 'silhouette + detail density' },
  contrast:       { min: 0.135, label: 'luminance contrast' },
  satMean:        { min: 0.22, max: 0.60, label: 'colour saturation' },
  satVariety:     { min: 0.10, label: 'hue variety (not monochrome)' },
  clippedHi:      { max: 0.030, label: 'blown highlights' },
  crushedLo:      { max: 0.040, label: 'crushed blacks' },
  midtoneSpread:  { min: 0.45, label: 'tonal range usage' },
  depthCue:       { min: 0.030, label: 'atmospheric depth (top/bottom delta)' },
};

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let s = 0, h = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

export function analyse(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data } = png;
  const lum = new Float32Array(W * H);
  const sat = new Float32Array(W * H);
  const hueHist = new Array(24).fill(0);
  let satSum = 0, lumSum = 0;

  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const [h, s, l] = rgb2hsl(r, g, b);
    lum[i] = l; sat[i] = s;
    lumSum += l; satSum += s;
    if (s > 0.12) hueHist[Math.min(23, Math.floor(h * 24))]++;
  }
  const n = W * H;
  const lumMean = lumSum / n;
  const satMean = satSum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) varSum += (lum[i] - lumMean) ** 2;
  const contrast = Math.sqrt(varSum / n);

  // Local detail: Sobel edge density + flat-region ratio via local variance.
  let edges = 0, flat = 0, cells = 0;
  const S = 4; // cell size for flatness
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1]
                 + lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1];
      const gy = -lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1]
                 + lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1];
      if (Math.hypot(gx, gy) > 0.09) edges++;
    }
  }
  for (let y = 0; y + S < H; y += S) {
    for (let x = 0; x + S < W; x += S) {
      let mn = 1, mx = 0;
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const v = lum[(y + dy) * W + (x + dx)];
          if (v < mn) mn = v; if (v > mx) mx = v;
        }
      }
      cells++;
      if (mx - mn < 0.018) flat++;
    }
  }

  // Tonal distribution.
  let clippedHi = 0, crushedLo = 0;
  const bins = new Array(16).fill(0);
  for (let i = 0; i < n; i++) {
    if (lum[i] > 0.97) clippedHi++;
    if (lum[i] < 0.035) crushedLo++;
    bins[Math.min(15, Math.floor(lum[i] * 16))]++;
  }
  const usedBins = bins.filter((b) => b / n > 0.005).length;

  // Atmospheric depth: ground just under the horizon should read hazier than
  // ground in the foreground. A fixed screen band is wrong — in a
  // downward-tilted shot it samples foreground twice — so find the horizon
  // per column (first non-sky pixel) and measure relative to that.
  const isSky = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return b > g && b > r && lum[i] > 0.42;      // blue-dominant and bright
  };
  const horizons = [];
  for (let x = 0; x < W; x += 2) {
    let h0 = -1;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (!isSky(i)) { h0 = y; break; }
    }
    if (h0 > 0) horizons.push(h0);
  }
  horizons.sort((a, b) => a - b);
  const horizon = horizons.length ? horizons[Math.floor(horizons.length / 2)] : Math.floor(H * 0.3);

  let farL = 0, farN = 0, nearL = 0, nearN = 0;
  const farEnd = Math.min(H, horizon + Math.floor(H * 0.14));
  for (let y = horizon; y < farEnd; y++)
    for (let x = 0; x < W; x++) { farL += lum[y * W + x]; farN++; }
  for (let y = Math.floor(H * 0.80); y < H; y++)
    for (let x = 0; x < W; x++) { nearL += lum[y * W + x]; nearN++; }
  const depthCue = farN && nearN ? Math.abs(farL / farN - nearL / nearN) : 0;

  const hueTotal = hueHist.reduce((a, b) => a + b, 0) || 1;
  const satVariety = hueHist.filter((h) => h / hueTotal > 0.02).length / 24;

  return {
    flatRatio: flat / cells,
    edgeDensity: edges / n,
    contrast,
    satMean,
    satVariety,
    clippedHi: clippedHi / n,
    crushedLo: crushedLo / n,
    midtoneSpread: usedBins / 16,
    depthCue,
    lumMean,
  };
}

export function critique(name, m) {
  const fails = [];
  for (const [key, rule] of Object.entries(T)) {
    const v = m[key];
    if (rule.min !== undefined && v < rule.min)
      fails.push(`${rule.label}: ${v.toFixed(3)} < ${rule.min} (too low)`);
    if (rule.max !== undefined && v > rule.max)
      fails.push(`${rule.label}: ${v.toFixed(3)} > ${rule.max} (too high)`);
  }
  return { name, pass: fails.length === 0, fails, metrics: m };
}

if (process.argv[2]) {
  const files = process.argv.slice(2);
  let allPass = true;
  for (const f of files) {
    const r = critique(f.split('/').pop(), analyse(f));
    allPass = allPass && r.pass;
    console.log(`\n${r.pass ? 'PASS' : 'REJECT'}  ${r.name}`);
    for (const x of r.fails) console.log(`   ✗ ${x}`);
    const m = r.metrics;
    console.log(`   flat=${m.flatRatio.toFixed(3)} edge=${m.edgeDensity.toFixed(3)} ` +
                `contrast=${m.contrast.toFixed(3)} sat=${m.satMean.toFixed(3)} ` +
                `hues=${m.satVariety.toFixed(2)} depth=${m.depthCue.toFixed(3)}`);
  }
  console.log(`\n=== ${allPass ? 'ALL PASS' : 'REJECTED'} ===`);
  process.exit(allPass ? 0 : 1);
}
