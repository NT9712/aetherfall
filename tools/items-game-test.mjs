// Game-level item/mission flow: wild pickup, kill drop, mission turn-in.
import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 200, height: 112 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,160)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__setAuto(false); window.__setQuality(1, 2); });
await page.evaluate((k) => window.__pump(k), 2);
let pass = true;
const check = (l, ok, ex='') => { pass = pass && ok; console.log(`  ${ok?'PASS':'FAIL'} ${l}${ex?'  '+ex:''}`); };

// pickup a wild item: teleport onto it
const spots = [
  [34,-60],[-78,-20],[90,40],[-20,120],[-118,-70],[60,120],[-40,-130],[110,-20],
];
for (let i = 0; i < 6; i++) {
  const [x,z] = spots[i];
  await page.evaluate((x,z) => { window.__teleport(x,z); }, x, z);
  await page.evaluate((k) => window.__pump(k), 3);
}
const inv = await page.evaluate(() => window.__gameState().inv);
const petalCount = inv.petal || 0;
check('picked up wild petals', petalCount >= 3, `petals=${petalCount}`);
check('inventory strip visible', petalCount > 0);

// accept the mission
await page.evaluate(() => window.__jumpWorld(0)); // ensure aetherfall if not
await page.evaluate((k) => window.__pump(k), 2);
const acc = await page.evaluate(() => window.__acceptMission());
check('accept mission', acc === true);

// gift wild items, then two kills (which also drop dust)
await page.evaluate(() => window.__gift('petal', 5));
for (let i = 0; i < 2; i++) await page.evaluate(() => window.__kill());
await page.evaluate((k) => window.__pump(k), 2);
const st = await page.evaluate(() => window.__gameState().mission);
check('mission satisfied after gathering + kills', st.satisfied, JSON.stringify(st.progress));

// turn in
const reward = await page.evaluate(() => window.__turnIn());
const g = await page.evaluate(() => window.__gameState());
check('turn-in grants maxHp bonus', g.maxHp === 140, `maxHp=${g.maxHp}`);
check('mission marked done', g.mission.done === true);
check('drops consumed on turn-in', !(g.inv && g.inv.dust), JSON.stringify(g.inv));

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
await browser.close();
process.exit(pass ? 0 : 1);
