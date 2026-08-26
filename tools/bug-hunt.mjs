// Bug hunt: measure real movement displacement per key at several camera
// yaws, and verify shadows survive culling and quality changes.
import puppeteer from 'puppeteer';
import path from 'path';

const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 320, height: 180 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1',
  { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate((k) => window.__pump(k), 2);

// ---------------------------------------------------------------- movement
console.log('MOVEMENT — displacement per key (world dx,dz) and facing\n');
const dirs = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D' };
for (const yaw of [0, Math.PI / 2, Math.PI]) {
  const line = [];
  for (const key of Object.keys(dirs)) {
    await page.evaluate((y) => { window.__teleport(14, -20); window.__look(y, 0.3); }, yaw);
    await page.evaluate((k) => window.__pump(k), 2);
    const before = await page.evaluate(() => window.__playerState());
    await page.keyboard.down(key);
    await page.evaluate((k) => window.__pump(k), 20);
    await page.keyboard.up(key);
    const after = await page.evaluate(() => window.__playerState());
    const dx = after.x - before.x, dz = after.z - before.z;
    const len = Math.hypot(dx, dz) || 1;
    line.push(`${dirs[key]}:(${(dx / len).toFixed(2)},${(dz / len).toFixed(2)}) d=${len.toFixed(2)}`);
  }
  console.log(`  yaw ${(yaw * 180 / Math.PI).toFixed(0).padStart(3)}°  ${line.join('  ')}`);
}

// Expected, with forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw):
for (const yaw of [0, Math.PI / 2, Math.PI]) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  console.log(`  expect ${(yaw * 180 / Math.PI).toFixed(0).padStart(3)}°  ` +
    `W:(${(-s).toFixed(2)},${(-c).toFixed(2)})  A:(${(-c).toFixed(2)},${(s).toFixed(2)})  ` +
    `S:(${(s).toFixed(2)},${(c).toFixed(2)})  D:(${(c).toFixed(2)},${(-s).toFixed(2)})`);
}

// ---------------------------------------------------------------- shadows
console.log('\nSHADOWS — mean luminance of the shadow landing zone');
const zone = async () => page.evaluate(() => {
  const c = document.querySelector('#app canvas');
  const g = document.createElement('canvas');
  g.width = c.width; g.height = c.height;
  const ctx = g.getContext('2d');
  ctx.drawImage(c, 0, 0);
  const x0 = Math.floor(c.width * 0.55), x1 = Math.floor(c.width * 0.95);
  const y0 = Math.floor(c.height * 0.80), y1 = c.height;
  const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { s += (d[i] * 0.2126 + d[i+1] * 0.7152 + d[i+2] * 0.0722) / 255; n++; }
  return +(s / n).toFixed(4);
});

const setup = async () => {
  await page.evaluate(() => { window.__teleport(14, -20); window.__look(Math.PI, 0.10); window.__zoom(2.9); });
  await page.evaluate((k) => window.__pump(k), 4);
};
await setup();
const withShadow = await zone();
await page.evaluate(() => window.__toggleShadows(false));
await page.evaluate((k) => window.__pump(k), 4);
const without = await zone();
await page.evaluate(() => window.__toggleShadows(true));
await page.evaluate((k) => window.__pump(k), 4);
const back = await zone();
console.log(`  shadows on ${withShadow}   off ${without}   back on ${back}`);
console.log(`  darkening: ${(((1 - withShadow / without) * 100) || 0).toFixed(0)}%  ` +
            `restore delta: ${Math.abs(back - withShadow).toFixed(4)}`);

// Quality-driven shadow toggling (what the adaptive controller does).
for (const lvl of [4, 2, 0, 3]) {
  await page.evaluate((l) => window.__setQuality(2, l), lvl);
  await page.evaluate((k) => window.__pump(k), 4);
  console.log(`  effects level ${lvl}: zone ${await zone()}`);
}

// Culling vs shadow casters: does hiding sectors remove shadows from view?
await page.evaluate(() => window.__setQuality(2, 3));
await page.evaluate((k) => window.__pump(k), 3);
const cullOn = await zone();
await page.evaluate(() => window.__setCulling(false));
await page.evaluate((k) => window.__pump(k), 3);
const cullOff = await zone();
console.log(`\n  culling on ${cullOn}  off ${cullOff}  delta ${Math.abs(cullOn - cullOff).toFixed(4)}` +
  (Math.abs(cullOn - cullOff) > 0.02 ? '   <-- CULLING CHANGES SHADOWS' : ''));

await browser.close();
