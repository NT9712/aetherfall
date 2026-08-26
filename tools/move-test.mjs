import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 256, height: 144 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__setAuto(false); window.__setQuality(1, 0); window.__setQuality(2, 0); });
await page.evaluate((k) => window.__pump(k), 2);

const keys = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D' };
for (const yaw of [0, Math.PI / 2]) {
  const out = [];
  for (const key of Object.keys(keys)) {
    await page.evaluate((y) => { window.__teleport(14, -20); window.__look(y, 0.3); }, yaw);
    await page.evaluate((k) => window.__pump(k), 3);
    const a = await page.evaluate(() => window.__playerState());
    await page.keyboard.down(key);
    await page.evaluate((k) => window.__pump(k), 12);
    await page.keyboard.up(key);
    const b = await page.evaluate(() => window.__playerState());
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    out.push(`${keys[key]}:(${(dx/len).toFixed(2)},${(dz/len).toFixed(2)})|${len.toFixed(1)}m`);
  }
  const s = Math.sin(yaw), c = Math.cos(yaw);
  console.log(`yaw ${(yaw*180/Math.PI).toFixed(0)}°  got    ${out.join(' ')}`);
  console.log(`         expect W:(${(-s).toFixed(2)},${(-c).toFixed(2)}) A:(${(-c).toFixed(2)},${s.toFixed(2)}) S:(${s.toFixed(2)},${c.toFixed(2)}) D:(${c.toFixed(2)},${(-s).toFixed(2)})`);
}
await browser.close();
