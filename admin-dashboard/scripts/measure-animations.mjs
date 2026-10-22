import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const ids=['01','02','03','04','05','06'];const measurements=[];
const browser=await chromium.launch({headless:true});
for(const [width,height] of [[1440,900],[390,844]]){
 const page=await browser.newPage({viewport:{width,height}});
 const collect=async mode=>{
  await page.waitForFunction(()=>document.querySelector('.animation-content')?.getAttribute('aria-busy')==='false',{},{timeout:10000});
  const metric=await page.evaluate(()=>window.__DENTAL_ANIMATION_METRICS__?.at(-1));
  if(!metric || metric.mode!==mode)throw Error(`Missing ${mode} measurement`);measurements.push(metric);
 };
 for(const id of ids){
  await page.goto('http://localhost:3000/');await page.evaluate(()=>sessionStorage.clear());await page.goto(`http://localhost:3000/templates/${id}`);await page.locator('.animation-overlay').waitFor();await collect('initial');
  await page.reload();await page.locator('.animation-overlay').waitFor();await collect('refresh');
  const next=ids[(ids.indexOf(id)+1)%6];await page.waitForTimeout(650);await page.evaluate(id=>window.__DENTAL_ANIMATION_QA__?.switchTo(id),next);await page.locator('.animation-overlay').waitFor();await page.waitForURL(`**/templates/${next}`);await collect('switch');
  console.log(`${width}px template ${id}: all modes measured`);
 }
 await page.close();
}
await browser.close();await writeFile(root+'artifacts/animations/performance.json',JSON.stringify({environment:'Chromium headless; local development server; desktop 1440×900 and mobile 390×844 emulation, not physical-device measurements',renderer:'ANGLE / Vulkan SwiftShader Device (LLVM 10.0.0), software rendering',measurements},null,2));
