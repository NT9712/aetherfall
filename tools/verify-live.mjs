// End-to-end verification of the deployed production site.
import puppeteer from 'puppeteer';

const URL = 'https://aetherfall-seven.vercel.app';
const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 320, height: 180 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 120)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('fonts.g')) errors.push('CONSOLE: ' + t.slice(0, 140));
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 600000 });
await new Promise((r) => setTimeout(r, 4500));
const hasCanvas = await page.evaluate(() => !!document.querySelector('#app canvas'));
const title = await page.title();
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate((k) => window.__pump(k), 2);

for (const [x, z] of [[22, -34], [-52, 8], [64, 30], [-98, 58], [90, 84], [-38, -112], [12, 136]]) {
  await page.evaluate((x, z) => window.__teleport(x, z), x, z);
  await page.evaluate((k) => window.__pump(k), 2);
}
await new Promise((r) => setTimeout(r, 1300));

const out = await page.evaluate(() => ({
  shards: window.__shardCount,
  finale: !document.getElementById('finale').classList.contains('hidden'),
  frameError: window.__frameError || null,
}));
console.log(JSON.stringify({ liveURL: URL, title, hasCanvas, ...out, errors }, null, 2));
await browser.close();
