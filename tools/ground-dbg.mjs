// Diagnose ground/shadow: sample ground luminance with shadows toggled, and
// measure shadow-zone noise (acne) vs lit ground across qualities.
import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 280, height: 158 });
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,180)));
await page.goto('file://' + path.resolve('dist/aetherfall.html') + '?qa=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 7000));
await page.evaluate(() => document.getElementById('btn-begin').click());
await page.evaluate(() => { window.__setAuto(false); window.__setQuality(1,1); });
// metrics over a ground region
const stats = () => page.evaluate(() => {
  const c = document.querySelector('#app canvas');
  const g = document.createElement('canvas'); g.width=c.width; g.height=c.height;
  const ctx=g.getContext('2d'); ctx.drawImage(c,0,0);
  const d = ctx.getImageData(0,0,c.width,c.height).data;
  const x0=Math.floor(c.width*0.12), x1=Math.floor(c.width*0.6);
  const y0=Math.floor(c.height*0.6), y1=c.height;
  let mean=0, n=0, vsum=0;
  const lum=new Float32Array(c.width*c.height);
  for(let i=0;i<d.length;i+=4){ const p=(i/4); lum[p]=(d[i]*0.2126+d[i+1]*0.7152+d[i+2]*0.0722)/255; }
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const v=lum[y*c.width+x]; mean+=v; n++; }
  mean/=n;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const v=lum[y*c.width+x]; vsum+=(v-mean)*(v-mean); }
  return { mean: +mean.toFixed(4), std: +Math.sqrt(vsum/n).toFixed(5), n };
});
const pose = async (yaw) => {
  await page.evaluate((y) => { window.__teleport(14,-20); window.__look(y, 0.12); window.__zoom(3.4); }, yaw);
  await page.evaluate((k) => window.__pump(k), 3);
};
// sun-lit ground (toward sun) and ground under nothing much
await pose(0);
const lit = await stats();
await page.evaluate(() => window.__toggleShadows(false));
await page.evaluate((k) => window.__pump(k), 3);
const noly = await stats();
await page.evaluate(() => window.__toggleShadows(true));
await page.evaluate((k) => window.__pump(k), 3);
const back = await stats();
console.log('ground ON', JSON.stringify({mean:lit.mean,std:lit.std}), ' OFF', JSON.stringify({mean:noly.mean}), ' back', JSON.stringify({mean:back.mean}));
console.log(`shadow darkening: ${(((1 - lit.mean/noly.mean)*100)||0).toFixed(1)}%  ground std(on): ${lit.std} (high=noise/acne)`);
// quality sweep forcing shadow recompiles + map resizes
for (const lvl of [4, 0, 4]) {
  await page.evaluate((l) => window.__setQuality(2, l), lvl);
  await pose(0);
  const s = await stats();
  console.log(`effects level ${lvl}: ground mean ${s.mean} std ${s.std}`);
}
await browser.close();
