// Prove the culler rejects geometry: compare sectors/grass chunks drawn
// while looking in different directions, and check triangle counts.
import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 320, height: 180 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate((k) => window.__pump(k), 2);

async function sample(label, yaw, pitch, occlusion = true) {
  await page.evaluate(({ yaw, pitch, occ }) => {
    window.__teleport(14, -20);
    window.__look(yaw, pitch);
    window.__setOcclusion(occ);
  }, { yaw, pitch, occ: occlusion });
  await page.evaluate((k) => window.__pump(k), 2);
  const r = await page.evaluate(() => window.__cullStats());
  console.log(`${label.padEnd(26)} sectors ${String(r.drawn).padStart(3)}/${r.total}` +
    `  grass ${String(r.grassDrawn).padStart(2)}/${r.grassChunks}` +
    `  tris ${(r.triangles/1000).toFixed(0)}k` +
    `  [far ${r.byDistance}, view ${r.byFrustum}, hidden ${r.byOcclusion}]`);
  return r;
}
// Baseline with culling entirely off, then with it on.
await page.evaluate(() => window.__setCulling(false));
const off = await sample('CULLING OFF (baseline)', Math.PI, 0.3);
await page.evaluate(() => window.__setCulling(true));
const a = await sample('looking north', Math.PI, 0.3);
const b = await sample('looking south', 0, 0.3);
const c = await sample('occlusion disabled', Math.PI, 0.3, false);
console.log('\nsectors skipped:   ' + Math.round((1 - a.drawn / a.total) * 100) + '%');
console.log('triangles saved:   ' + (((off.triangles - a.triangles) / off.triangles) * 100).toFixed(1) +
  '%  (' + (off.triangles/1000).toFixed(0) + 'k -> ' + (a.triangles/1000).toFixed(0) + 'k)');
console.log('draw calls:        ' + off.calls + ' -> ' + a.calls);
console.log('occlusion alone:   ' + (c.drawn - a.drawn) + ' extra sectors when disabled');
await browser.close();
