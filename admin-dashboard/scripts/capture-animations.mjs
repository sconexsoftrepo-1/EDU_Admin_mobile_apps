import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const ids=['01','02','03','04','05','06'];
const out=root+'artifacts/animations';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const captures=[],measurements=[];
async function shot(page,id,variant,name){const path=`public/assets/animations/template-${id}/previews/${variant}-${name}.webp`;await sharp(await page.screenshot()).webp({quality:78}).toFile(root+path);captures.push({id,variant,name,path});}
for(const [variant,width,height] of [['desktop',1440,900],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height}});
 for(const id of ids.filter(id=>!process.env.CAPTURE_TEMPLATE || id===process.env.CAPTURE_TEMPLATE)){
  await page.goto('http://localhost:3000/');await page.evaluate(()=>sessionStorage.clear());
  await page.goto(`http://localhost:3000/templates/${id}`);await page.locator('.animation-overlay').waitFor({state:'visible'});await page.locator('.animation-overlay').waitFor({state:'detached',timeout:10000});
  measurements.push(await page.evaluate(()=>window.__DENTAL_ANIMATION_METRICS__?.at(-1)));
  await page.goto('http://localhost:3000/');await page.evaluate(()=>sessionStorage.clear());await page.goto(`http://localhost:3000/templates/${id}`);
  await page.locator('.animation-overlay').waitFor();await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.seek(.3));
  await page.locator('.animation-scene.scene-ready').waitFor({timeout:4000});
  for(const time of [.3,.8,1.4,2,2.5]){await page.evaluate(t=>window.__DENTAL_ANIMATION_QA__?.seek(t),time);await page.waitForTimeout(65);await shot(page,id,variant,`initial-${String(time).replace('.','_')}`);}
  await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.skip());await page.waitForTimeout(650);await shot(page,id,variant,'initial-final');
  await page.reload();await page.locator('.animation-overlay').waitFor();
  for(const [name,time] of [['opening',.15],['middle',.65],['end',1.18]]){await page.evaluate(t=>window.__DENTAL_ANIMATION_QA__?.seek(t),time);await page.waitForTimeout(65);await shot(page,id,variant,`refresh-${name}`);}
  await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.skip());
  const next=ids[(ids.indexOf(id)+1)%6];await page.waitForTimeout(650);await shot(page,next,variant,`switch-source-${id}`);
  await page.evaluate(next=>window.__DENTAL_ANIMATION_QA__?.switchTo(next),next);
  await page.locator('.animation-overlay').waitFor();await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.seek(.32));await page.waitForURL(`**/templates/${next}`);await page.waitForTimeout(150);await shot(page,next,variant,`switch-cover-${id}`);
  await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.play());await page.locator('.animation-overlay').waitFor({state:'detached',timeout:10000});await page.waitForTimeout(650);await shot(page,next,variant,`switch-destination-${id}`);
  console.log(`${variant} ${id} captured`);
 }
 await page.close();
}
if(process.env.CAPTURE_TEMPLATE){ const {readFile}=await import('node:fs/promises'); const old=JSON.parse(await readFile(out+'/captures.json','utf8')); const paths=new Set(captures.map(c=>c.path));captures.push(...old.filter(c=>!paths.has(c.path))); measurements.push(...JSON.parse(await readFile(out+'/performance.json','utf8')).measurements.filter(m=>m.templateId!==process.env.CAPTURE_TEMPLATE)); }
await writeFile(out+'/captures.json',JSON.stringify(captures,null,2));if(!process.env.CAPTURE_TEMPLATE) await writeFile(out+'/performance.json',JSON.stringify({environment:'Chromium headless; local development server; desktop 1440×900 and mobile 390×844 emulation, not physical-device measurements',measurements},null,2));
for(const variant of ['mobile','desktop']){
 const frames=captures.filter(c=>c.variant===variant&&c.name==='initial-2').sort((a,b)=>a.id.localeCompare(b.id));
 const thumbWidth=variant==='mobile'?234:360,thumbHeight=variant==='mobile'?506:225;
 const cols=3,rows=2;await sharp({create:{width:thumbWidth*cols,height:thumbHeight*rows,channels:3,background:'#182030'}}).composite(await Promise.all(frames.map(async(c,i)=>({input:await sharp(root+c.path).resize(thumbWidth,thumbHeight).toBuffer(),left:(i%cols)*thumbWidth,top:Math.floor(i/cols)*thumbHeight})))).webp({quality:85}).toFile(out+`/${variant}-overview.webp`);
}
const html=`<!doctype html><meta charset="utf-8"><title>Dentalverse animation QA</title><style>body{background:#0d1423;color:#edf4ff;font:16px system-ui;margin:32px}h2{margin-top:40px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}img{width:100%;border-radius:12px}small{display:block;margin:8px 0;color:#abb9d5}a{color:#a5d9ff}</style><h1>Animation QA frames</h1><p>Timeline-controlled checkpoints. Full sequences run automatically in the application. <a href="performance.json">Natural-run performance</a></p>${ids.map(id=>`<h2>Template ${id}</h2><section>${captures.filter(c=>c.id===id).map(c=>`<article><small>${c.variant} · ${c.name}</small><img loading="lazy" src="../../${c.path}"></article>`).join('')}</section>`).join('')}`;
await writeFile(out+'/index.html',html);await browser.close();
