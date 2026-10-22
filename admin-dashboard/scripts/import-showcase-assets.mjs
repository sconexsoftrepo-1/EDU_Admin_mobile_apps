import fs from 'node:fs/promises';import ts from 'typescript';import sharp from 'sharp';
const portfolio='/Users/sconex.ios.dev/Projects/Katta Chaitanya Portfolio/chaitanya-portfolio';
const source=ts.createSourceFile('portfolio.ts',await fs.readFile(portfolio+'/src/data/portfolioData.ts','utf8'),ts.ScriptTarget.Latest,true);
let data;function literal(n){if(ts.isAsExpression(n))return literal(n.expression);if(ts.isStringLiteral(n)||ts.isNumericLiteral(n))return ts.isNumericLiteral(n)?Number(n.text):n.text;if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(source).replace(/["']/g,''),literal(p.initializer)]));return undefined;}
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='portfolioData')data=literal(n.initializer);ts.forEachChild(n,visit)}visit(source);
await fs.writeFile('src/data/creator-projects.json',JSON.stringify(data.projects,null,2));
for(const pose of ['hero','mobile','cloud'])await sharp(portfolio+`/public/images/developer-${pose}-stylized.png`).resize({width:1200,withoutEnlargement:true}).webp({quality:88}).toFile(`public/assets/showcase/creator/developer-${pose}.webp`);
await sharp(portfolio+'/src/assets/chatbot-avatar.png').resize(384).webp({quality:86}).toFile('public/assets/showcase/creator/companion-fallback.webp');
console.log(`Imported ${data.projects.length} supplied projects and four existing character assets.`);
