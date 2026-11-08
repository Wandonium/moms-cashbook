import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initialState,cents,decimal,validate,nextState,words,workbook,csv,restoreBackup,fillSheet} from '../site/core.js';
const sample={...initialState().defaults,payee_name:'Sample & Payee',item:'Electricity',particulars:'Sample <bill>',date:'2026-11-08',currency:'EUR',amount:'10.25'};
test('decimal half-up conversion, currency words and limits',()=>{
 assert.equal(cents('1.005'),101n);assert.equal(decimal(cents('0.005')),'0.01');
 assert.equal(validate(sample).kes,'1547.75');
 assert.equal(validate({...sample,currency:'USD'}).kes,'1322.25');
 assert.equal(validate({...sample,currency:'KES'}).kes,'10.25');
 assert.equal(validate({...sample,amount:'0.01',eur_rate:'1.50'}).kes,'0.02');
 assert.equal(words('10.25','USD'),'TEN US DOLLAR TWENTY FIVE CENT');
 assert.throws(()=>validate({...sample,allocation:'1'}),/exceeds/);
 for(const amount of ['NaN','Infinity','-1','0','9999999999'])assert.throws(()=>validate({...sample,amount}));
 assert.throws(()=>validate({...sample,date:'2026-02-30'}));
 assert.throws(()=>validate({...sample,currency:'GBP'}));
});
test('saved records, counters, duplicates and backup roundtrip',()=>{
 const saved=nextState(initialState(),sample,'sample-id');
 assert.equal(saved.defaults.expenditure,'1547.75');assert.equal(saved.defaults.dept_vch_no,'2');
 assert.equal(saved.payments[0].payee_name,sample.payee_name);
 assert.throws(()=>nextState(saved,sample),/already saved/);
 const restored=restoreBackup(JSON.parse(JSON.stringify({format:'cashbook-browser-v1',payments:saved.payments})));
 assert.equal(restored.payments[0].amount,'10.25');assert.deepEqual(restored.defaults,saved.defaults);
 assert.throws(()=>restoreBackup({format:'wrong',payments:[]}));
});
test('CSV escapes formulas and preserves commas/newlines',()=>{
 const output=csv([{...sample,payee_name:'=HYPERLINK("a")',particulars:'a,b\nc'}]);
 assert.ok(output.includes('"\'=HYPERLINK(""a"")"'));assert.ok(output.includes('"a,b\nc"'));
});
test('EUR/USD/KES workbooks preserve sanitized package parts and layout',async()=>{
 const parts=JSON.parse(await fs.readFile(new URL('../site/template.json',import.meta.url)));
 const sheet=Buffer.from(parts['xl/worksheets/sheet1.xml'],'base64').toString();
 for(const currency of ['EUR','USD','KES']){
  const v=validate({...sample,currency});
  const xml=fillSheet(sheet,v);
  assert.ok(xml.includes('SAMPLE &amp; PAYEE'));assert.ok(xml.includes('Sample &lt;bill&gt;'));
  assert.ok(xml.includes('<f>G45-G47</f>'));
  assert.equal((xml.match(/<mergeCell /g)||[]).length,(sheet.match(/<mergeCell /g)||[]).length);
  const blob=workbook(parts,v);
  await fs.writeFile(new URL(`./output-${currency}.xlsx`,import.meta.url),Buffer.from(await blob.arrayBuffer()));
 }
 for(const [name,b64] of Object.entries(parts))if(!name.endsWith('.png'))assert.doesNotMatch(Buffer.from(b64,'base64').toString(),/DOMINIC|MAOBE|\/Users\/|Foreign Service Allowance|FINANCIAL ATTACHE/i);
});
test('Pages artifact uses relative paths and makes no API calls',async()=>{
 const html=await fs.readFile(new URL('../site/index.html',import.meta.url),'utf8');
 const js=await fs.readFile(new URL('../site/app.js',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../site/style.css',import.meta.url),'utf8');
 assert.doesNotMatch(html+js+css,/\/api\/|\/static\/|https?:\/\//);
 assert.ok(html.includes('type="module"'));assert.ok(html.includes('id="backup"'));assert.ok(html.includes('id="restore"'));
 for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),`Missing UI element: ${id}`);
});
