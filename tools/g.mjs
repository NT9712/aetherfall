import puppeteer from 'puppeteer';
import path from 'path';
const browser = await puppeteer.launch({ headless:'new', protocolTimeout:900000,
  args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page = await browser.newPage();
await page.setViewport({width:300,height:170});
page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);
page.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,160)));
await page.goto('file://'+path.resolve('dist/aetherfall.html')+'?qa=1',{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,7000));
await page.evaluate(()=>document.getElementById('btn-begin').click());
await page.evaluate(()=>{window.__setAuto(false);});
const region = (fx,fy,tx,ty)=>page.evaluate(([x0,y0,x1,y1])=>{
  const c=document.querySelector('#app canvas'); const W=c.width,H=c.height;
  const g=document.createElement('canvas'); g.width=W; g.height=H;
  g.getContext('2d').drawImage(c,0,0);
  const d=g.getContext('2d').getImageData(0,0,W,H).data;
  const xa=Math.floor(x0*W),xb=Math.floor(x1*W),ya=Math.floor(y0*H),yb=Math.floor(y1*H);
  let mean=0,vs=0,n=0; const lum=[]; for(let r=0;r<H;r++){lum.push(new Float32Array(W));}
  for(let r=0;r<H;r++)for(let p=0;p<W;p++){const i=(r*W+p)*4; lum[r][p]=(d[i]*0.2126+d[i+1]*0.7152+d[i+2]*0.0722)/255;}
  for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++){mean+=lum[y][x];n++;}
  mean/=n;
  for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++){const v=lum[y][x];vs+=(v-mean)*(v-mean);}
  return {mean:+mean.toFixed(4), std:+Math.sqrt(vs/n).toFixed(4)};
},[fx,fy,tx,ty]);
const pose=async(yaw,pitch,zoom)=>{await page.evaluate(([y,p,z])=>{window.__teleport(14,-20);window.__look(y,p);window.__zoom(z);},[yaw,pitch,zoom]); await page.evaluate(k=>window.__pump(k),3);};

// Use the real effects ladder to toggle shadows (recompiles materials).
await pose(Math.PI,0.10,2.9);
await page.evaluate(()=>window.__setQuality(2,3)); await page.evaluate(k=>window.__pump(k),3);
const s1=await region(0.55,0.78,1,1);          // shadows ON (High effects)
await page.evaluate(()=>window.__setQuality(2,0)); await page.evaluate(k=>window.__pump(k),3);
const s0=await region(0.55,0.78,1,1);          // shadows OFF (Potato effects)
const darken=((1-s1.mean/s0.mean)*100);
console.log(`stele-zone  High(on) ${s1.mean}/${s1.std}  Potato(off) ${s0.mean}/${s0.std}  shadowDarken ${darken.toFixed(1)}%`);
await page.evaluate(()=>window.__setQuality(2,3)); await page.evaluate(k=>window.__pump(k),3);
const on2=await region(0.55,0.78,1,1);
console.log(`back-to-High ${on2.mean}/${on2.std}  (restore delta ${on2.mean.toFixed(2)} vs ${s1.mean.toFixed(2)})`);

await pose(Math.PI,0.16,2.6);
const lit=await region(0.2,0.6,0.55,0.9);
console.log(`near-ground lit (High)  mean ${lit.mean} std ${lit.std}`);
await browser.close();
