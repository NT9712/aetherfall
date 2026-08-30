import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 300, height: 170 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,160)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__setAuto(false); window.__setQuality(1,1); });

const region = async (f) => page.evaluate((f) => {
  const c = document.querySelector('#app canvas');
  const g=document.createElement('canvas'); g.width=c.width; g.height=c.height;
  g.getContext('2d').drawImage(c,0,0);
  const d=g.getContext('2d').getImageData(0,0,c.width,c.height).data;
  const lum=new Float32Array(c.width*c.height);
  for(let i=0;i<d.length;i+=4) lum[i/4]=(d[i]*0.2126+d[i+1]*0.7152+d[i+2]*0.0722)/255;
  const [x0,y0,x1,y1]=f;
  let mean=0,varS=0,n=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ mean+=lum[y*c.width+x]; n++; }
  mean/=n;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const v=lum[y*c.width+x]; varS+=(v-mean)*(v-mean); }
  return { mean:+mean.toFixed(4), std:+Math.sqrt(varS/n).toFixed(4) };
}, f);
const pose = async (tp, yaw, pitch, zoom) => {
  await page.evaluate((t,y,p,z) => { window.__teleport(t[0],t[1]); window.__look(y,p); window.__zoom(z); }, tp, yaw, pitch, zoom);
  await page.evaluate((k) => window.__pump(k), 3);
};

// clean meadow, no structures in frame: wide ground band
await pose([-52,8], 2.2, 0.3, 6.5);
const onS = await region([0.1,0.55,0.9,1]);
await page.evaluate(() => window.__toggleShadows(false));
await page.evaluate((k) => window.__pump(k), 3);
const offS = await region([0.1,0.55,0.9,1]);
await page.evaluate(() => window.__toggleShadows(true));
await page.evaluate((k) => window.__pump(k), 3);
console.log(`clean-meadow  shadowOn ${onS.mean}/${onS.std}  shadowOff ${offS.mean}/${offS.std}  darken ${((1-onS.mean/offS.mean)*100).toFixed(1)}%`);

// stele shadow zone (the earlier 48% location): near spawn looking down at stele
await pose([14,-20], Math.PI, 0.10, 2.9);
const sz = await region([0.55,0.78,1,1]);
await page.evaluate(() => window.__toggleShadows(false));
await page.evaluate((k) => window.__pump(k), 3);
const szOff = await region([0.55,0.78,1,1]);
await page.evaluate(() => window.__toggleShadows(true));
console.log(`stele-shadow-zone  on ${sz.mean}/${sz.std}  off ${szOff.mean}/${szOff.std}  darken ${((1-sz.mean/szOff.mean)*100).toFixed(1)}%`);

// acne check: high-frequency variance in a lit ground patch (std should be modest, not ~0.1+)
const patch = await region([0.25,0.7,0.5,0.85]);
console.log(`lit-ground-patch std ${patch.std} (acne if very high)`);
await browser.close();
