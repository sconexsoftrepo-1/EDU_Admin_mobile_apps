import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const out=`${root}/client-data/initial-data-entry`;
const previews='/private/tmp/edunexa-professional-previews';
const manifest=JSON.parse(await fs.readFile(`${out}/import-contract-v2.json`,'utf8'));
await fs.mkdir(previews,{recursive:true});
const charcoal='#303030', ink='#252525', grey='#EFEFEF', white='#FFFFFF';
const first=manifest.first_data_row,last=first+manifest.prepared_rows-1;
const col=(i)=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
const cell=(s,k,r)=>`${col(s.fields.findIndex(f=>f.key===k))}${r}`;
function base(s,r){s.showGridLines=false;s.getRange(r).format.font={name:'Arial',size:11,color:ink};s.getRange(r).format.verticalAlignment='center';}
function header(s,r){s.getRange(r).format={fill:charcoal,font:{name:'Arial',size:11,bold:true,color:white},wrapText:true,rowHeight:46,horizontalAlignment:'center',verticalAlignment:'center'};s.getRange(r).format.borders={insideVertical:{style:'thin',color:white}};}
const inventory=[];
for(const book of manifest.files){
 if(process.argv.length>2&&!process.argv.slice(2).includes(book.file.slice(0,2)))continue;
 const wb=Workbook.create();
 for(const spec of book.sheets)wb.worksheets.add(spec.name);
 const guide=wb.worksheets.add('Guide'),defs=[];
 for(const spec of book.sheets){
  const sh=wb.worksheets.getItem(spec.name),end=col(spec.fields.length-1);
  base(sh,`A1:${end}${last}`);
  sh.getRange(`A1:${end}${last}`).format.columnWidth=24;
  sh.getRange(`A1:${end}${last}`).format.fill=white;
  sh.getRange('A1').format.rowHeight=12;
  sh.getRange('A2').values=[[spec.name]];sh.getRange('A2').format={font:{name:'Arial',size:16,bold:true,color:ink},rowHeight:30};
  sh.getRange('A3').values=[[spec.row_rule]];sh.getRange('A3').format.rowHeight=25;
  sh.getRange('A4').values=[['Required fields are marked *. Enter data from row 7. See Guide for definitions and examples.']];
  sh.getRange('A4').format={font:{name:'Arial',size:11,color:'#626262'},rowHeight:25};
  let prev='';
  for(let i=0;i<spec.fields.length;i++){
   const f=spec.fields[i],c=col(i),r=sh.getRange(`${c}${first}:${c}${last}`);
   if(f.group!==prev){sh.getRange(`${c}5`).values=[[f.group]];prev=f.group;}
   sh.getRange(`${c}5`).format={fill:grey,font:{name:'Arial',size:10,bold:true,color:'#555555'},rowHeight:24};
   const width=f.key.includes('email')?32:/notes|description|criteria/.test(f.key)?40:f.key.includes('address')?34:Math.min(32,Math.max(22,Math.ceil(f.label.length*.75)));
   sh.getRange(`${c}1:${c}${last}`).format.columnWidth=width;
   if(['text','code','email','phone','time'].includes(f.type))r.setNumberFormat('@');
   if(f.type==='date')r.setNumberFormat('yyyy-mm-dd');
   if(['money','calculated_money','decimal'].includes(f.type))r.setNumberFormat('#,##0.00;[Red](#,##0.00);0.00');
   if(f.type==='percent')r.setNumberFormat('0.00"%"');
   if(['positive_int','int','year'].includes(f.type))r.setNumberFormat('0');
   if(f.type==='bool')r.dataValidation={rule:{type:'list',values:['Yes','No']}};
   if(f.choices.length)r.dataValidation={rule:{type:'list',values:f.choices}};
   if(['decimal','money','int'].includes(f.type))r.dataValidation={rule:{type:f.type==='int'?'whole':'decimal',operator:'greaterThanOrEqual',formula1:0}};
   if(f.type==='positive_int')r.dataValidation={rule:{type:'whole',operator:'greaterThan',formula1:0}};
   if(f.type==='percent')r.dataValidation={rule:{type:'decimal',operator:'between',formula1:0,formula2:100}};
   if(f.type==='year')r.dataValidation={rule:{type:'whole',operator:'between',formula1:1900,formula2:2200}};
   defs.push([spec.name,f.label+(f.required?' *':''),f.required?'Required':f.type.startsWith('calculated')?'Calculated':'Optional',f.type==='percent'?'0 to 100, whole percent':f.type==='date'?'YYYY-MM-DD':f.type==='bool'?'Yes or No':f.type,f.description,f.example.trim(),f.choices.join(', ')||f.reference||'']);
  }
  sh.getRange(`A6:${end}6`).values=[spec.fields.map(f=>f.label+(f.required?' *':''))];
  const tab=sh.tables.add(`A6:${end}${last}`,true,`Data_${book.file.slice(0,2)}_${spec.name.replaceAll(' ','_')}`);tab.style='TableStyleLight1';
  sh.getRange(`A${first}:${end}${last}`).format.fill=white;
  sh.getRange(`A${first}:${end}${last}`).format.rowHeight=25;
  sh.getRange(`A${first}:${end}${last}`).format.borders={insideHorizontal:{style:'hair',color:'#E9E9E9'}};
  header(sh,`A6:${end}6`);sh.freezePanes.freezeRows(6);sh.freezePanes.freezeColumns(2);
  for(const f of spec.fields.filter(f=>f.type==='calculated_money')){const c=col(spec.fields.indexOf(f));sh.getRange(`${c}${first}:${c}${last}`).format.fill=grey;}
 }
 if(book.file.startsWith('09_')){
  const cs=book.sheets.find(s=>s.name==='Charges'),ps=book.sheets.find(s=>s.name==='Payments'),als=book.sheets.find(s=>s.name==='Allocations');
  const charges=wb.worksheets.getItem('Charges'),allocations=wb.worksheets.getItem('Allocations'),payments=wb.worksheets.getItem('Payments');
  const range=(s,name,k)=>`${name}!$${col(s.fields.findIndex(f=>f.key===k))}$${first}:$${col(s.fields.findIndex(f=>f.key===k))}$${last}`;
  const pr=k=>range(ps,'Payments',k),ar=k=>range(als,'Allocations',k);
  for(let row=first;row<=last;row++){
   const c=k=>cell(cs,k,row),a=k=>cell(als,k,row);
   const gross=`ROUND(${c('base_amount')}-SUM(${c('discount_amount')})+SUM(${c('fine_amount')})+SUM(${c('tax_amount')}),2)`;
   const adjustments=[c('discount_amount'),c('fine_amount'),c('tax_amount')].join(',');
   charges.getRange(c('gross_before_scholarship')).formulas=[[`=IF(${c('charge_code')}="","",IF(ISNUMBER(${c('base_amount')}),IF(COUNT(${adjustments})=COUNTA(${adjustments}),${gross},"Review amounts"),IF(ISBLANK(${c('base_amount')}),"","Review amounts")))`]];
   charges.getRange(c('net_payable')).formulas=[[`=IF(ISNUMBER(${c('gross_before_scholarship')}),IF(OR(ISBLANK(${c('scholarship_applied')}),ISNUMBER(${c('scholarship_applied')})),ROUND(${c('gross_before_scholarship')}-SUM(${c('scholarship_applied')}),2),"Review amounts"),${c('gross_before_scholarship')})`]];
   allocations.getRange(a('settled_amount')).formulas=[[`=IF(${a('allocation_code')}="","",IF(OR(${a('payment_code')}="",${a('charge_code')}="",NOT(ISNUMBER(${a('allocated_amount')}))),"Review allocation",IF(COUNTIF(${pr('payment_code')},${a('payment_code')})<>1,"Review allocation",IF(COUNTIFS(${pr('payment_code')},${a('payment_code')},${pr('status')},"settled")=1,${a('allocated_amount')},IF(OR(COUNTIFS(${pr('payment_code')},${a('payment_code')},${pr('status')},"pending")=1,COUNTIFS(${pr('payment_code')},${a('payment_code')},${pr('status')},"failed")=1),0,"Review allocation")))))`]];
   charges.getRange(c('paid_allocated')).formulas=[[`=IF(ISNUMBER(${c('net_payable')}),IF(COUNTIFS(${ar('charge_code')},${c('charge_code')},${ar('settled_amount')},"Review allocation")>0,"Review allocation",SUMIF(${ar('charge_code')},${c('charge_code')},${ar('settled_amount')})),${c('net_payable')})`]];
   charges.getRange(c('outstanding')).formulas=[[`=IF(ISNUMBER(${c('net_payable')}),IF(ISNUMBER(${c('paid_allocated')}),ROUND(${c('net_payable')}-${c('paid_allocated')},2),${c('paid_allocated')}),${c('net_payable')})`]];
  }
  for(const key of ['net_payable','outstanding'])charges.getRange(`${cell(cs,key,first)}:${cell(cs,key,last)}`).conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{font:{color:'#9A2929',bold:true}}});
  const put=(s,sh,record)=>{for(const [k,v]of Object.entries(record))sh.getRange(cell(s,k,first)).values=[[v]];};
  const expect=(s,sh,k,want)=>{const got=sh.getRange(cell(s,k,first)).values[0][0];if(got!==want)throw Error(`${k}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);};
  put(cs,charges,{charge_code:'QA-CHG',base_amount:25000,discount_amount:1000,scholarship_applied:5000,fine_amount:0,tax_amount:0});
  put(ps,payments,{payment_code:'QA-PAY',amount:10000,status:'settled'});put(als,allocations,{allocation_code:'QA-ALLOC',payment_code:'QA-PAY',charge_code:'QA-CHG',allocated_amount:10000});wb.recalculate();
  expect(cs,charges,'gross_before_scholarship',24000);expect(cs,charges,'net_payable',19000);expect(cs,charges,'paid_allocated',10000);expect(cs,charges,'outstanding',9000);
  put(ps,payments,{status:'pending'});wb.recalculate();expect(cs,charges,'outstanding',19000);
  put(ps,payments,{payment_code:'MISSING'});wb.recalculate();expect(cs,charges,'outstanding','Review allocation');
  put(cs,charges,{base_amount:0,discount_amount:null,scholarship_applied:null});put(als,allocations,{allocation_code:null});wb.recalculate();expect(cs,charges,'net_payable',0);expect(cs,charges,'outstanding',0);
  put(cs,charges,{base_amount:null});wb.recalculate();expect(cs,charges,'outstanding','');
  for(const [s,sh]of [[cs,charges],[ps,payments],[als,allocations]])for(const f of s.fields.filter(f=>!f.type.startsWith('calculated')))sh.getRange(cell(s,f.key,first)).clear({applyTo:'contents'});
  console.log('Finance recalculation checks passed.');
 }
 const notes=[['Purpose',book.purpose],['Entry layout','Headers are in row 6. Enter records from row 7. The first two columns and six header rows stay visible while scrolling.'],['Required fields','An asterisk marks required fields. Additional conditional requirements are explained in the definitions below.'],['Codes','Use permanent unique codes. Reuse exact codes across files. Mobile numbers, postal codes and identifiers are text.'],['Dates and values','Use Excel dates shown YYYY-MM-DD. Enter monetary amounts in major currency units. Use dropdown choices where provided.'],['Blank fields','Leave unknown optional fields empty. Enter a numeric zero only when the confirmed value is zero.'],['More rows','200 entry rows are prepared. Extend the Excel table for more records to retain formats and formulas. Grey calculated columns are not manual inputs.'],...book.notes.map((v,i)=>[`Specific instruction ${i+1}`,v]),['Examples','The fictional examples below explain fields only. All data-entry tabs are blank.'],['Import','Collection templates for the future Python service. Validation and reviewed import must be implemented before production use.']];
 base(guide,`A1:G${notes.length+defs.length+9}`);guide.getRange('A1:G1').format.rowHeight=12;
 guide.getRange('A2').values=[[book.title]];guide.getRange('A2').format={font:{name:'Arial',size:16,bold:true,color:ink},rowHeight:32};
 for(let i=0;i<notes.length;i++){const r=i+4;guide.getRange(`A${r}`).values=[[notes[i][0]]];guide.getRange(`A${r}`).format.font={bold:true,name:'Arial',size:11,color:ink};guide.getRange(`B${r}`).values=[[notes[i][1]]];guide.getRange(`A${r}:G${r}`).format.rowHeight=27;}
 const gh=notes.length+6;
 guide.getRange(`A${gh}:G${gh}`).values=[['Data tab','Field','Requirement','Format','Definition or entry rule','Fictional example','Allowed choices or reference']];
 guide.getRange(`A${gh+1}:G${gh+defs.length}`).values=defs;
 guide.getRange(`A${gh+1}:G${gh+defs.length}`).format={font:{name:'Arial',size:11,color:ink},rowHeight:60,wrapText:true,verticalAlignment:'center'};
 guide.getRange('A:A').format.columnWidth=24;guide.getRange('B:B').format.columnWidth=35;guide.getRange('C:C').format.columnWidth=16;guide.getRange('D:D').format.columnWidth=24;guide.getRange('E:E').format.columnWidth=74;guide.getRange('F:F').format.columnWidth=40;guide.getRange('G:G').format.columnWidth=62;
 header(guide,`A${gh}:G${gh}`);guide.freezePanes.freezeRows(3);
 wb.recalculate();
 const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#N/A|#CALC!',options:{useRegex:true,maxResults:10},maxChars:1000});
 if(errors.ndjson.includes('"kind":"match"'))throw Error(errors.ndjson);
 const prefix=book.file.slice(0,2);
 for(const s of book.sheets){
  const blob=await wb.render({sheetName:s.name,range:'A1:F10',scale:1.3,format:'png'});await fs.writeFile(`${previews}/${prefix}-${s.name}.png`,new Uint8Array(await blob.arrayBuffer()));
  for(let from=6;from<s.fields.length;from+=6){const p=await wb.render({sheetName:s.name,range:`${col(from)}5:${col(Math.min(from+5,s.fields.length-1))}9`,scale:1,format:'png'});await fs.writeFile(`${previews}/${prefix}-${s.name}-cols-${from+1}.png`,new Uint8Array(await p.arrayBuffer()));}
 }
 for(const [n,r]of [['Guide',`A1:G${Math.min(gh-1,18)}`],['Definitions',`A${gh}:G${gh+5}`]]){const p=await wb.render({sheetName:'Guide',range:r,scale:1,format:'png'});await fs.writeFile(`${previews}/${prefix}-${n}.png`,new Uint8Array(await p.arrayBuffer()));}
 const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(`${out}/${book.file}`);
 inventory.push({file:book.file,dataTabs:book.sheets.length,fields:defs.length});console.log(JSON.stringify(inventory.at(-1)));
}
await fs.writeFile(`${out}/workbook-inventory.json`,JSON.stringify(manifest.files.map(b=>({file:b.file,dataTabs:b.sheets.length,fields:b.sheets.reduce((n,s)=>n+s.fields.length,0)})),null,2)+'\n');
console.log(`Completed ${inventory.length} professional collection files.`);
