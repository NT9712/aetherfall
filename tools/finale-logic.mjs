// Pure logic verification: collect all 7 shards, confirm finale triggers.
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 270 });
await page.goto('http://localhost:8787/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 3500));
await page.evaluate(() => document.getElementById('btn-begin').click());
for (const [x, z] of [[22,-34],[-52,8],[64,30],[-98,58],[90,84],[-38,-112],[12,136]]) {
  await page.evaluate((x, z) => window.__teleport(x, z), x, z);
  await page.evaluate((k) => window.__pump(k), 3);
  console.log(x, z, '-> count:', await page.evaluate(() => window.__shardCount));
}
await new Promise(r => setTimeout(r, 1200));
const finaleVisible = await page.evaluate(() => !document.getElementById('finale').classList.contains('hidden'));
console.log(JSON.stringify({ finaleVisible }));
await browser.close();
