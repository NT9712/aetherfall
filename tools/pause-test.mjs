// Pause menu behaviour: opens on pointer-lock loss and on Escape, freezes
// world simulation, resumes cleanly, and stays out of the finale's way.
import puppeteer from 'puppeteer';
import path from 'path';

const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
         '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 220, height: 124 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 180)));

await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1',
  { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => {
  window.__setAuto(false);
  window.__setQuality(0, 0); window.__setQuality(1, 0); window.__setQuality(2, 0);
});
await page.evaluate((k) => window.__pump(k), 2);

// Baseline: how far does W carry us in this many frames when not paused?
// Comparing against this beats hard-coding a distance, since travel depends on
// the acceleration ramp and the pump count.
const walk = async (frames = 10) => {
  const a = await page.evaluate(() => window.__playerState());
  await page.keyboard.down('KeyW');
  await page.evaluate((k) => window.__pump(k), frames);
  await page.keyboard.up('KeyW');
  const b = await page.evaluate(() => window.__playerState());
  return Math.hypot(b.x - a.x, b.z - a.z);
};
const baseline = await walk();

let pass = true;
const check = (label, ok, extra = '') => {
  pass = pass && ok;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
};
const isPaused = () => page.evaluate(() =>
  !document.getElementById('pause').classList.contains('hidden'));

// --- Escape opens it ---
await page.keyboard.press('Escape');
await page.evaluate((k) => window.__pump(k), 2);
check('Escape opens the pause menu', await isPaused());

// --- world is frozen while paused ---
const moved = await walk();
check('input is inert while paused', moved < 0.01, `drift ${moved.toFixed(4)}m`);

// --- progress readout ---
const label = await page.evaluate(() => document.getElementById('pause-progress').textContent);
check('progress is shown', /\d\s*\/\s*7/.test(label), `"${label.trim()}"`);

// --- resume ---
await page.evaluate(() => document.getElementById('btn-resume').click());
await page.evaluate((k) => window.__pump(k), 2);
check('Resume closes the menu', !(await isPaused()));

// --- movement works again after resume ---
const moved2 = await walk();
check('movement resumes at full speed', moved2 > baseline * 0.8,
  `${moved2.toFixed(2)}m vs baseline ${baseline.toFixed(2)}m`);

// --- Escape toggles closed too ---
await page.keyboard.press('Escape');
await page.evaluate((k) => window.__pump(k), 2);
const opened = await isPaused();
await page.keyboard.press('Escape');
await page.evaluate((k) => window.__pump(k), 2);
check('Escape toggles closed', opened && !(await isPaused()));

// --- graphics panel reachable from the menu ---
await page.keyboard.press('Escape');
await page.evaluate((k) => window.__pump(k), 2);
await page.evaluate(() => document.getElementById('btn-graphics').click());
const gfx = await page.evaluate(() =>
  !document.getElementById('settings').classList.contains('hidden'));
check('Graphics opens from pause', gfx);
await page.evaluate(() => document.getElementById('btn-resume').click());

// --- finale must not be hijacked by the pause menu ---
for (const [x, z] of [[22,-34],[-52,8],[64,30],[-98,58],[90,84],[-38,-112],[12,136]]) {
  await page.evaluate((x, z) => window.__teleport(x, z), x, z);
  await page.evaluate((k) => window.__pump(k), 2);
}
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate((k) => window.__pump(k), 2);
const finaleUp = await page.evaluate(() =>
  !document.getElementById('finale').classList.contains('hidden'));
check('finale shows', finaleUp);
check('pause does not cover the finale', !(await isPaused()));
await page.keyboard.press('Escape');
await page.evaluate((k) => window.__pump(k), 2);
check('Escape is ignored during the finale', !(await isPaused()));

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
await browser.close();
process.exit(pass ? 0 : 1);
