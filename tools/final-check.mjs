import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 150)));
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404')) errors.push('CONSOLE: ' + t.slice(0, 200));
});
await page.goto('http://localhost:8787/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 4000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate((k) => window.__pump(k), 10);
// Gameplay logic re-verification after all fixes
for (const [x, z] of [[22,-34],[-52,8],[64,30],[-98,58],[90,84],[-38,-112],[12,136]]) {
  await page.evaluate((x, z) => window.__teleport(x, z), x, z);
  await page.evaluate((k) => window.__pump(k), 3);
}
const count = await page.evaluate(() => window.__shardCount);
const finale = await page.evaluate(() => !document.getElementById('finale').classList.contains('hidden'));
const frameErr = await page.evaluate(() => window.__frameError || null);
console.log(JSON.stringify({ shards: count, finaleShown: finale, frameError: frameErr, errors }, null, 2));
await browser.close();
