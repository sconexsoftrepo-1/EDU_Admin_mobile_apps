import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const contract=JSON.parse(await fs.readFile(`${root}/client-data/import-contract.json`,'utf8'));
const wb=Workbook.create();
const instructions=wb.worksheets.add('Instructions');
const navy='#18344B', gold='#FFF0C2';
const notes=[
 ['EduNexa College','Client data collection'],
 ['Start here','Complete the entity sheets. Row 1 contains fixed import headers. Enter records from row 2.'],
 ['Required fields','Gold column headers are mandatory for every populated record. See Field Guide for definitions.'],
 ['Permanent codes','Use unique codes such as STU-0001, PAR-0001 and EMP-0001. Reuse the exact code in related sheets.'],
 ['People','Enter every teacher and staff member in Employees, then add their Teachers or Staff profile.'],
 ['Parents and siblings','Enter a parent once in Parents. Add one Student Parents row per child and parent relationship.'],
 ['Enrollment','Link Students to Sections in Enrollments. Sections link to Batches and Semesters.'],
 ['Dates and times','Use real Excel dates displayed YYYY-MM-DD. Enter times as HH:MM and timestamps in ISO 8601 format.'],
 ['Phone and identifiers','Keep as text. Preserve leading zeros, country prefixes, postal codes and admission numbers.'],
 ['Yes or No','Use dropdown Yes/No for boolean columns. Do not type 1/0 or true/false.'],
 ['Amounts','Enter numbers in major currency units, e.g. 1500.00 INR. Zero is allowed; negatives are not.'],
 ['Optional information','Leave unavailable optional fields blank. Do not enter N/A or dashes into date or numeric columns.'],
 ['Preparing the file','Do not rename sheets or headers, merge input cells, insert title rows or enter formulas.'],
 ['More records','200 entry rows are prepared per sheet. Add more rows below them and preserve the same column formats.'],
 ['Examples','The Examples sheet contains fictional relationship examples only. Do not copy them as real client records.'],
 ['Import sequence','Use the data-sheet order in this workbook. Earlier master records are referenced by later sheets.'],
 ['Accounts','Do not enter passwords, access tokens or bank credentials. User accounts will be invited by the portal.'],
 ['Import availability','The XLSX importer will be implemented in the future Python backend. This workbook collects the required data.'],
 ['Review','The future portal must validate and preview the upload before saving. Fix reported errors before committing.'],
 ['Sharing','Return the completed file through the agreed private client transfer channel.']
];
instructions.getRange(`A1:B${notes.length}`).values=notes;
instructions.getRange(`A1:B${notes.length}`).format.font={name:'Arial',size:11,color:'#18344B'};
instructions.getRange(`A1:B${notes.length}`).format.rowHeight=46;
instructions.getRange(`A1:B${notes.length}`).format.wrapText=true;
instructions.getRange('A:A').format.columnWidth=25;
instructions.getRange('B:B').format.columnWidth=105;
instructions.getRange('A1:B1').format={fill:navy,font:{bold:true,color:'#FFFFFF',size:14},rowHeight:34};
instructions.showGridLines=false;
function col(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
const guide=[];
for (const spec of contract.sheets){
 const sheet=wb.worksheets.add(spec.sheet), end=col(spec.fields.length-1);
 sheet.showGridLines=false;
 sheet.getRange(`A1:${end}1`).values=[spec.fields.map(f=>f.name)];
 sheet.getRange(`A1:${end}201`).format.font={name:'Arial',size:10,color:'#18344B'};
 sheet.getRange(`A1:${end}201`).format.columnWidth=25;
 sheet.getRange(`A2:${end}201`).format.rowHeight=22;
 sheet.tables.add(`A1:${end}201`,true,`Input_${spec.table}`);
 sheet.getRange(`A1:${end}1`).format={fill:navy,font:{name:'Arial',bold:true,color:'#FFFFFF',size:10},rowHeight:46,wrapText:true};
 sheet.freezePanes.freezeRows(1);
 for(let i=0;i<spec.fields.length;i++){
   const f=spec.fields[i], c=col(i), r=sheet.getRange(`${c}2:${c}201`);
   if(f.required)sheet.getRange(`${c}1`).format={fill:gold,font:{bold:true,color:navy}};
   if(['text','code','email','phone','timestamp','time'].includes(f.type))r.setNumberFormat('@');
   if(f.type==='date')r.setNumberFormat('yyyy-mm-dd');
   if(['decimal','money'].includes(f.type))r.setNumberFormat('#,##0.00');
   if(['int','positive_int','weekday'].includes(f.type))r.setNumberFormat('0');
   let allowed=f.choices;
   if(f.type==='bool')allowed=['Yes','No'];
   if(allowed.length)r.dataValidation={rule:{type:'list',values:allowed}};
   if(f.type==='positive_int')r.dataValidation={rule:{type:'whole',operator:'greaterThan',formula1:0}};
   if(f.type==='weekday')r.dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:7}};
   if(['decimal','money','int'].includes(f.type))r.dataValidation={rule:{type:f.type==='int'?'whole':'decimal',operator:'greaterThanOrEqual',formula1:0}};
   let meaning=f.name.replaceAll('_',' ');
   if(f.name==='code')meaning='Unique permanent code for this record';
   if(f.reference)meaning=`Exact code from ${contract.sheets.find(s=>s.table===f.reference)?.sheet??f.reference}`;
   if(f.type==='money')meaning+=' (major currency units, not paise)';
   const format=f.type==='date'?'YYYY-MM-DD':f.type==='timestamp'?'ISO 8601 with timezone':f.type==='time'?'HH:MM':f.type==='bool'?'Yes or No':f.type;
   guide.push([spec.sheet,f.name,f.required?'Yes':'No',format,f.reference?`${f.reference}.code`:'',allowed.join(', '),meaning]);
 }
}
const gs=wb.worksheets.add('Field Guide');
gs.getRange('A1:G1').values=[['Sheet','Column header','Required','Type / format','References','Allowed values','Meaning']];
gs.getRange(`A2:G${guide.length+1}`).values=guide;
gs.getRange(`A1:G${guide.length+1}`).format.font={name:'Arial',size:10,color:navy};
gs.getRange(`A1:G${guide.length+1}`).format.rowHeight=48;
gs.getRange(`A1:G${guide.length+1}`).format.wrapText=true;
gs.getRange('A:F').format.columnWidth=26;gs.getRange('G:G').format.columnWidth=58;
gs.getRange('F:F').format.columnWidth=52;
gs.getRange('A1:G1').format={fill:navy,font:{color:'#FFFFFF',bold:true}};
gs.freezePanes.freezeRows(1);gs.showGridLines=false;
gs.tables.add(`A1:G${guide.length+1}`,true,'FieldDefinitions');
const ex=wb.worksheets.add('Examples');
const examples=[
 ['Sheet','Record code','Relationship column','Example linked code','Explanation'],
 ['Campuses','CAMP-01','institution_code','INST-01','Campus belongs to institution INST-01'],
 ['Employees','EMP-0001','department_code','DEPT-CS','Teacher employee. Set employee_type to teacher.'],
 ['Teachers','TCH-0001','employee_code','EMP-0001','Teacher profile links to the employee record.'],
 ['Employees','EMP-0002','department_code','DEPT-ADMIN','Staff employee. Set employee_type to staff.'],
 ['Staff','STAFF-0001','employee_code','EMP-0002','Non-teaching staff profile links to the employee record.'],
 ['Students','STU-0001','campus_code','CAMP-01','First child, fictional example.'],
 ['Students','STU-0002','campus_code','CAMP-01','Sibling, fictional example.'],
 ['Parents','PAR-0001','','','One parent record, reused for both children.'],
 ['Student Parents','LINK-0001','student_code','STU-0001','Set parent_code PAR-0001 and relationship mother.'],
 ['Student Parents','LINK-0002','student_code','STU-0002','Set parent_code PAR-0001 and relationship mother.'],
 ['Enrollments','ENR-0001','student_code','STU-0001','Set section_code SEC-CS-01 and roll_number 001.'],
 ['Teaching Assignments','OFFER-0001','teacher_code','TCH-0001','Also set subject_code and section_code.'],
 ['Salary Components','SAL-0001','employee_code','EMP-0001','Set component_type earning and amount 35000.00.']
];
ex.getRange(`A1:E${examples.length}`).values=examples;
ex.getRange(`A1:E${examples.length}`).format.font={name:'Arial',size:10,color:navy};
ex.getRange(`A1:E${examples.length}`).format.rowHeight=42;
ex.getRange(`A1:E${examples.length}`).format.wrapText=true;
ex.getRange('A:D').format.columnWidth=26;ex.getRange('E:E').format.columnWidth=70;
ex.getRange('A1:E1').format={fill:navy,font:{bold:true,color:'#FFFFFF'}};
ex.showGridLines=false;
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Students!A1:F3',include:'values',tableMaxRows:3,tableMaxCols:6})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10}})).ndjson);
await fs.mkdir('/private/tmp/edunexa-previews',{recursive:true});
for(const name of ['Instructions',...contract.sheets.map(s=>s.sheet),'Field Guide','Examples']){
 const range=name==='Instructions'?'A1:B5':name==='Examples'?'A1:E4':name==='Field Guide'?'A1:G4':'A1:F4';
 const blob=await wb.render({sheetName:name,range,scale:1,format:'png'});
 await fs.writeFile(`/private/tmp/edunexa-previews/${name}.png`,new Uint8Array(await blob.arrayBuffer()));
}
const xlsx=await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(`${root}/client-data/EduNexa_Client_Data.xlsx`);
console.log(JSON.stringify({sheets:contract.sheets.length+3,fieldDefinitions:guide.length,output:'EduNexa_Client_Data.xlsx'}));
