import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 240, height: 135 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__setAuto(false); window.__hideGrass(); });

// Mean luminance of the zone where the stele's shadow lands.
const zone = () => page.evaluate(() => {
  const c = document.querySelector('#app canvas');
  const g = document.createElement('canvas');
  g.width = c.width; g.height = c.height;
  g.getContext('2d').drawImage(c, 0, 0);
  const x0 = Math.floor(c.width*0.52), y0 = Math.floor(c.height*0.78);
  const d = g.getContext('2d').getImageData(x0, y0, c.width-x0, c.height-y0).data;
  let s=0,n=0; for (let i=0;i<d.length;i+=4){s+=(d[i]*0.2126+d[i+1]*0.7152+d[i+2]*0.0722)/255;n++;}
  return +(s/n).toFixed(4);
});
const pose = async () => {
  await page.evaluate(() => { window.__teleport(14,-20); window.__look(Math.PI, 0.10); window.__zoom(2.9); });
  await page.evaluate((k) => window.__pump(k), 3);
};

await pose();
const base = await zone();
await page.evaluate(() => window.__toggleShadows(false));
await page.evaluate((k) => window.__pump(k), 4);
const noShadow = await zone();
console.log(`baseline: shadows ${base}  no-shadows ${noShadow}  darkening ${((1-base/noShadow)*100).toFixed(0)}%`);

// Walk the effects slider: level 0 disables shadows, others enable them.
await page.evaluate(() => window.__toggleShadows(true));
const seen = [];
for (const lvl of [3, 0, 3]) {
  await page.evaluate((l) => window.__setQuality(2, l), lvl);
  await pose();
  const z = await zone();
  seen.push({ lvl, z });
  console.log(`  effects ${lvl} (shadows ${lvl === 0 ? 'off' : 'on'}): ${z}`);
}
const onVals = seen.filter(s => s.lvl > 0).map(s => s.z);
const offVals = seen.filter(s => s.lvl === 0).map(s => s.z);
const spread = Math.max(...onVals) - Math.min(...onVals);
console.log(`\nshadow-on consistency spread: ${spread.toFixed(4)} ${spread < 0.04 ? '(stable)' : '(UNSTABLE)'}`);
console.log(`shadow-off is brighter: ${offVals.every(o => o > Math.max(...onVals)) ? 'yes' : 'NO'}`);
await browser.close();
