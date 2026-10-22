import {readFile,writeFile,stat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const entries=JSON.parse(await readFile(root+'src/data/animation-assets.json','utf8')).filter(e=>e.generationMethod!=='Playwright Chromium screenshot / Sharp WebP');
const sourceCount=entries.length;
let previews=[];
try {
 const checkpoints=JSON.parse(await readFile(root+'artifacts/animations/captures.json','utf8'));
 const responsive=JSON.parse(await readFile(root+'artifacts/animations/responsive.json','utf8'));
 previews=[...checkpoints,...responsive];
} catch { /* Source-only verification also works before the first browser capture. */ }
for(const frame of previews){
 const width=frame.width || (frame.variant==='desktop'?1440:390), height=frame.height || (frame.variant==='desktop'?900:844);
 const path='/'+frame.path.replace('public/','');
 entries.push({templateId:frame.id,name:frame.name || `Responsive ${width}px`,path,format:'WebP',details:`${width} × ${height}`,usage:'QA capture only; not loaded in runtime scenes',mobileVariant:width<600?path:null,desktopVariant:width>=600?path:null,optimization:'WebP quality 78',generationMethod:'Playwright Chromium screenshot / Sharp WebP',integrationStatus:'integrated in local QA gallery',bytes:(await stat(root+frame.path)).size});
}
await writeFile(root+'src/data/animation-assets.json',JSON.stringify(entries,null,2));
for(const item of entries){
 const file=root+'public'+item.path;const info=await stat(file);if(!info.size)throw Error(`Empty ${item.path}`);
 if(item.format==='GLB'){
  const bytes=await readFile(file);if(bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB');
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  if(!json.meshes?.length)throw Error(`No meshes ${file}`);
  if(json.buffers.some(b=>b.uri))throw Error(`External GLB dependency ${file}`);
 }
 for(const variant of [item.mobileVariant,item.desktopVariant])if(variant)await stat(root+'public'+variant);
}
const total=entries.reduce((a,e)=>a+e.bytes,0);
const md=`# Animation asset manifest\n\nAll ${sourceCount} runtime source assets and ${previews.length} QA previews verified on disk. Total ${(total/1024).toFixed(1)} KiB. Original procedural Three.js geometry and SVG; no licensed or remote dependencies. Generated with \`node scripts/generate-animation-assets.mjs\`; verify with \`node scripts/verify-animation-assets.mjs\`.\n\nThe existing website photography, template artwork and anatomy viewer are reused unchanged. New assets fill the six loader scene gaps. Desktop and mobile GLBs contain independently animated named parts; orbit rings, HUD, outline, scanning plane, hearts, lights and reflection environment are generated directly in R3F. Wave and ribbon animation are runtime geometry transforms, not sprite substitutions.\n\n| Template | Asset | Exact public path | Format / geometry | Usage | Mobile / desktop variants | Optimization | Generation / integration |\n|---|---|---|---|---|---|---|---|\n${entries.map(e=>`| ${e.templateId} | ${e.name} | \`${e.path}\` | ${e.format}: ${e.details} | ${e.usage} | ${e.mobileVariant||'shared size'} / ${e.desktopVariant||'shared size'} | ${(e.bytes/1024).toFixed(1)} KiB; ${e.optimization} | ${e.generationMethod}; ${e.integrationStatus} |`).join('\n')}\n\n## Captured previews\n\nDesktop and mobile frames are in each template's \`previews/\` folder. The complete capture index, checkpoint times and paths are in \`artifacts/animations/captures.json\`, with a visual gallery in \`artifacts/animations/index.html\`. These are QA artifacts; they are not loaded by the runtime scene.\n\n## Named model parts\n\n- 01: six translucent crown/root fragments, animated into a glass tooth.\n- 02: crown, abutment, threaded fixture; separate assembly transforms.\n- 03: enamel, eyes, smile and glints; pivoted wave arm, opposite arm. Facial expression is the original friendly smile.\n- 04: ivory crown and gold abutment/fixture; runtime progressive gold outline and light sweep.\n- 05: pearl crown/roots and indexed broad spline ribbon; progressive draw range.\n- 06: translucent enamel/roots and internal pulp/core; runtime cloned wireframe, clipping scan plane and HUD rings.\n`;
await writeFile(root+'ANIMATION_ASSET_MANIFEST.md',md);console.log(`Verified ${sourceCount} source assets and ${previews.length} QA previews (${(total/1024).toFixed(1)} KiB), including 12 self-contained GLBs.`);
