import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({headless:true});const captures=[];
for(const [width,height] of [[320,740],[375,812],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[1920,1080]]){
 const page=await browser.newPage({viewport:{width,height}});
 for(const id of ['01','02','03','04','05','06'].filter(id=>!process.env.CAPTURE_TEMPLATE || id===process.env.CAPTURE_TEMPLATE)){
  await page.goto('http://localhost:3000/');await page.evaluate(()=>sessionStorage.clear());await page.goto(`http://localhost:3000/templates/${id}`);
  await page.locator('.animation-overlay').waitFor();await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.seek(2.3));await page.locator('.animation-scene.scene-ready').waitFor({timeout:4000});await page.waitForTimeout(90);
  const path=`public/assets/animations/template-${id}/previews/responsive-${width}.webp`;await sharp(await page.screenshot()).webp({quality:78}).toFile(root+path);captures.push({id,width,height,path});
  await page.evaluate(()=>window.__DENTAL_ANIMATION_QA__?.skip());
 }
 await page.close();console.log(`Captured ${process.env.CAPTURE_TEMPLATE ? "one theme" : "six themes"} at ${width}×${height}`);
}
if(process.env.CAPTURE_TEMPLATE){ const {readFile}=await import('node:fs/promises'); const old=JSON.parse(await readFile(root+'artifacts/animations/responsive.json','utf8'));const paths=new Set(captures.map(c=>c.path));captures.push(...old.filter(c=>!paths.has(c.path)));captures.sort((a,b)=>a.width-b.width || a.id.localeCompare(b.id)); }
await mkdir(root+'artifacts/animations',{recursive:true});await writeFile(root+'artifacts/animations/responsive.json',JSON.stringify(captures,null,2));
await writeFile(root+'artifacts/animations/responsive.html',`<!doctype html><meta charset="utf-8"><title>Responsive animation frames</title><style>body{background:#10182a;color:white;font:16px system-ui;margin:24px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%}</style><h1>Responsive animation checkpoints</h1><p>Additional widths supplement the 390px and 1440px full sequence gallery.</p>${[320,375,390,430,768,1024,1440,1920].map(w=>`<h2>${w}px</h2><section>${captures.filter(c=>c.width===w).map(c=>`<article><p>Template ${c.id} · ${c.width}×${c.height}</p><img loading="lazy" src="../../${c.path}"></article>`).join('')}</section>`).join('')}`);
for(const width of [390,1440]){
 const cols=3, tw=width===390?234:360,th=width===390?506:225;
 await sharp({create:{width:tw*cols,height:th*2,channels:3,background:'#182030'}}).composite(await Promise.all(captures.filter(c=>c.width===width).map(async(c,i)=>({input:await sharp(root+c.path).resize(tw,th).toBuffer(),left:(i%cols)*tw,top:Math.floor(i/cols)*th})))).webp({quality:85}).toFile(root+`artifacts/animations/${width===390?'mobile':'desktop'}-overview.webp`);
}
await browser.close();
