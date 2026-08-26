// Art review render pass, tuned for a CPU-starved box:
// one browser reused for all vantages, small viewport, in-page pixel capture,
// very generous timeouts. Writes review/<name>.png.
import fs from 'fs';
import puppeteer from 'puppeteer';

const ALL = [
  { name: 'hero',     tp: [14, -20],  look: [Math.PI, 0.10], zoom: 2.9 },
  { name: 'meadow',   tp: [14, -20],  look: [Math.PI, 0.30] },
  { name: 'forest',   tp: [-52, 8],   look: [2.2, 0.28] },
  { name: 'highland', tp: [-40, 40],  look: [1.0, 0.26] },
  { name: 'summit',   tp: [-60, 68],  look: [2.6, 0.22] },
  { name: 'cliffs',   tp: [88, 92],   look: [0.6, 0.30] },
];
const pick = (process.env.SHOTS || '').split(',').filter(Boolean);
const SHOTS = pick.length ? ALL.filter((s) => pick.includes(s.name)) : ALL;

const W = Number(process.env.W || 400);
const H = Number(process.env.H || 225);
const URL = process.env.URL || 'http://localhost:8787/dist/index.html?qa=1';

fs.mkdirSync('review', { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.setDefaultTimeout(600000);
page.setDefaultNavigationTimeout(600000);

console.log('loading...');
await page.goto(URL + '&v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 6000));
await page.evaluate(() => document.getElementById('btn-begin').click());
// Deterministic art review: pin quality, no adaptive drift between shots.
await page.evaluate(() => { window.__setAuto(false); [0,1,2].forEach(i => window.__setQuality(i, 3)); });
await page.evaluate((k) => window.__pump(k), 2);
console.log('world ready');

for (const s of SHOTS) {
  try {
    await page.evaluate(({ tp, look, zoom }) => {
      window.__teleport(tp[0], tp[1]);
      window.__look(look[0], look[1]);
      if (zoom) window.__zoom(zoom); else window.__zoom(6.5);
    }, s);
    await page.evaluate((k) => window.__pump(k), 4);
    const dataUrl = await page.evaluate(() => window.__capture(2));
    fs.writeFileSync(`review/${s.name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('captured:', s.name);
  } catch (e) {
    console.log('failed:', s.name, String(e.message || e).slice(0, 80));
    break;
  }
}
await browser.close();
console.log('review render complete');
