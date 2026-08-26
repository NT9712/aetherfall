import puppeteer from 'puppeteer';
import path from 'path';
const file = 'file://' + path.resolve('dist/aetherfall.html');
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 320, height: 180 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0,140)));
page.on('console', m => { const t=m.text(); if (m.type()==='error' && !t.includes('fonts.g')) errors.push('CONSOLE: '+t.slice(0,160)); });
await page.goto(file, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 8000));
const hasCanvas = await page.evaluate(() => !!document.querySelector('#app canvas'));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate((k) => window.__pump(k), 2);
for (const [x,z] of [[22,-34],[-52,8],[64,30],[-98,58],[90,84],[-38,-112],[12,136]]) {
  await page.evaluate((x,z) => window.__teleport(x,z), x, z);
  await page.evaluate((k) => window.__pump(k), 2);
}
await new Promise(r => setTimeout(r, 1500));
const out = await page.evaluate(() => ({ shards: window.__shardCount,
  finale: !document.getElementById('finale').classList.contains('hidden'),
  frameError: window.__frameError || null }));
console.log(JSON.stringify({ hasCanvas, ...out, errors }, null, 1));
await browser.close();
