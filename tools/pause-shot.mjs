import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 620, height: 350 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__setAuto(false); window.__setQuality(1, 2); window.__setQuality(2, 2); });
await page.evaluate(() => { window.__teleport(14, -20); window.__look(Math.PI, 0.22); });
await page.evaluate((k) => window.__pump(k), 4);
await page.keyboard.press('Escape');
await page.evaluate((k) => window.__pump(k), 2);
await page.screenshot({ path: 'review/pause-menu.png' });
console.log('ok');
await browser.close();
