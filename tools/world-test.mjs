import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 220, height: 124 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,160)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => window.__setAuto(false));
await page.evaluate((k) => window.__pump(k), 2);
let pass = true;
const check = (l, ok, ex='') => { pass = pass && ok; console.log(`  ${ok?'PASS':'FAIL'} ${l} ${ex}`); };

const A = await page.evaluate(() => window.__worldInfo());
check('starts in aetherfall', A.id === 'aetherfall', `(${A.name})`);
check('aetherfall has 7 shards', A.shardLen === 7);

// switch to Embercrown
await page.evaluate(() => window.__jumpWorld(1));
await page.evaluate((k) => window.__pump(k), 3);
const B = await page.evaluate(() => window.__worldInfo());
check('switched to embercrown', B.id === 'embercrown', `(${B.name})`);
check('shard count reset', B.shardCount === 0);
check('embercrown journey is shorter', B.shardLen === 6, `(${B.shardLen})`);
check('stones rebuilt', B.stones === 4, `(${B.stones})`);
check('world palette applied (fog changed)', A.fog !== B.fog, `${A.fog} -> ${B.fog}`);
check('sky recoloured', A.sky !== B.sky, `${A.sky} -> ${B.sky}`);
check('player moved to new spawn', (B.player[0] !== A.player[0] || B.player[1] !== A.player[1]));

// switch to Ashen Vale
await page.evaluate(() => window.__jumpWorld(2));
await page.evaluate((k) => window.__pump(k), 3);
const C = await page.evaluate(() => window.__worldInfo());
check('switched to ashenvale', C.id === 'ashenvale', `(${C.name})`);
check('ashenvale shards', C.shardLen === 5, `(${C.shardLen})`);
check('fog differs again', B.fog !== C.fog, `${B.fog} -> ${C.fog}`);

// wrap-around back to aetherfall
await page.evaluate(() => window.__jumpWorld(3));
await page.evaluate((k) => window.__pump(k), 3);
const D = await page.evaluate(() => window.__worldInfo());
check('wraps around to aetherfall', D.id === 'aetherfall', `(i=3 -> ${D.name})`);

// goal text updated
const goal = await page.evaluate(() => document.getElementById('tracker-title').textContent);
check('quest tracker shows world goal', /En|crown|vale|quench|wake/i.test(goal), `"${goal}"`);

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
await browser.close();
process.exit(pass ? 0 : 1);
