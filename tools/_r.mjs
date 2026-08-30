import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless:'new', protocolTimeout:900000,
  args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page = await browser.newPage();
await page.setViewport({width:300,height:170});
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror', e=>console.log('PAGEERR', e.message.slice(0,200)));
await page.goto('file://'+path.resolve('dist/aetherfall.html')+'?qa=1', {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,7000));
await page.evaluate(()=>document.getElementById('btn-begin').click());
await page.evaluate(()=>window.__setAuto(false));
await page.evaluate((k)=>window.__pump(k),2);
const r = await page.evaluate(() => {
  try {
    const c = document.querySelector('#app canvas');
    if (!c) throw new Error('no canvas');
    const g=document.createElement('canvas'); g.width=c.width; g.height=c.height;
    const ctx=g.getContext('2d'); ctx.drawImage(c,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data;
    return { w:c.width, h:c.height, len:d.length };
  } catch(e){ return { err: String(e) }; }
});
console.log(JSON.stringify(r));
await browser.close();
