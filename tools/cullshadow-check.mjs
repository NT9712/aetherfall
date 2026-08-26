import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 240, height: 135 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => window.__setAuto(false));
for (const yaw of [0, Math.PI/2, Math.PI]) {
  await page.evaluate((y) => { window.__teleport(14,-20); window.__look(y, 0.25); }, yaw);
  await page.evaluate((k) => window.__pump(k), 3);
  const s = await page.evaluate(() => window.__cullStats());
  console.log(`yaw ${String(Math.round(yaw*180/Math.PI)).padStart(3)}°  drawn ${String(s.drawn).padStart(2)}/${s.total}` +
    `  keptForShadows ${s.keptForShadows}  frustum-rejected ${s.byFrustum}  occluded ${s.byOcclusion}`);
}
await browser.close();
