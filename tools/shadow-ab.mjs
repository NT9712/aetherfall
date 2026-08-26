import fs from 'fs';
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 225 });
page.setDefaultTimeout(600000);
await page.goto('http://localhost:8787/dist/index.html?qa=1&v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 6000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__teleport(14, -20); window.__look(Math.PI, 0.10); window.__zoom(2.9); window.__hideGrass(); });
await page.evaluate((k) => window.__pump(k), 4);
let d = await page.evaluate(() => window.__capture(2));
fs.writeFileSync('review/ab-shadows-on.png', Buffer.from(d.split(',')[1], 'base64'));
await page.evaluate(() => window.__toggleShadows(false));
await page.evaluate((k) => window.__pump(k), 4);
d = await page.evaluate(() => window.__capture(2));
fs.writeFileSync('review/ab-shadows-off.png', Buffer.from(d.split(',')[1], 'base64'));
console.log('A/B captured');
await browser.close();
