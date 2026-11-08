import {validate,workbook,csv,restoreBackup} from './core.js';
import {openStore,savePayment,readState,restoreState} from './storage.js';
let template;
const $ = id => document.getElementById(id);
const form = $('payment-form');
let state, reviewed, saving = false;
function error(message) { $('error').textContent = message; $('error').hidden = !message; if(message) $('error').scrollIntoView({behavior:'smooth',block:'center'}); }
function download(blob,filename) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function downloadPayment(payment) { download(workbook(template,payment),payment.filename); }
function money(value,currency) { return new Intl.NumberFormat('en',{style:'currency',currency}).format(Number(value)); }
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function show(which) {
  for(const id of ['entry','review','success']) $(id).hidden = id !== which;
  $('step1').classList.toggle('active',which === 'entry'); $('step2').classList.toggle('active',which !== 'entry');
  if(which !== 'entry') $(which).focus();
  error('');
}
function fillDefaults() {
  form.reset();
  for(const [key,value] of Object.entries(state.defaults)) if(form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
  form.elements.date.value = localDate();
  $('office').open = !state.defaults.configured;
  $('office-status').textContent = state.defaults.configured ? 'Saved · change if needed' : 'Set up once';
  $('setup-note').textContent = state.defaults.configured ? 'These office details were saved with your last voucher. Check the account, financial year and rates when they change.' : 'Sample office details are filled in for practice. Check the allocation, expenditure, financial year and exchange rates before saving.';
}
function pair(list,label,value) { const row=document.createElement('div'), dt=document.createElement('dt'), dd=document.createElement('dd'); dt.textContent=label; dd.textContent=value; row.append(dt,dd); list.append(row); }
function review(data) {
  $('review-details').replaceChildren(); $('review-office').replaceChildren();
  for(const [label,value] of [['Payee',data.payee_name],['Payment for',data.item],['Description',data.particulars],['Amount',money(data.amount,data.currency)],['Payment date',new Date(data.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})],['Voucher number',data.dept_vch_no.padStart(3,'0')],['Amount in KES',money(data.kes,'KES')],['Balance after payment',money(data.balance,'KES')]]) pair($('review-details'),label,value);
  for(const [label,key] of [['Cashbook number','cashbook_vch_no'],['Account','accnt_no'],['Item number','item_no'],['Vote','vote'],['Head / subhead','head/subhead'],['Station','station'],['Financial year','financial year'],['Allocation in KES','allocation'],['Prior expenditure in KES','expenditure'],['1 EUR in KES','eur_rate'],['1 USD in KES','usd_rate']]) pair($('review-office'),label,data[key]);
  $('confirmed').checked=false; show('review');
}
function history() {
  $('history').replaceChildren(); $('payees').replaceChildren();
  if(!state.payments.length) { const p=document.createElement('p');p.className='empty';p.textContent='Your first voucher will appear here.';$('history').append(p); }
  for(const item of state.payments) {
    const row=document.createElement('div');row.className='history-row';
    const text=document.createElement('div'), p=document.createElement('p'), small=document.createElement('small'), link=document.createElement('a');
    p.textContent=item.payee_name; small.textContent=`${item.date} · ${item.item} · ${money(item.amount,item.currency)} · No. ${item.dept_vch_no.padStart(3,'0')}`;
    link.href='#';link.onclick=event=>{event.preventDefault();try{downloadPayment(item);}catch(e){error(e.message);}};link.textContent='Download ↓';link.setAttribute('aria-label',`Download voucher ${item.dept_vch_no} for ${item.payee_name}`);
    text.append(p,small);row.append(text,link);$('history').append(row);
  }
  for(const name of new Set(state.payments.map(p=>p.payee_name))) { const o=document.createElement('option');o.value=name;$('payees').append(o); }
}
form.addEventListener('submit',async event=>{
  event.preventDefault(); error('');const button=form.querySelector('button[type=submit]');button.disabled=true;
  try { reviewed=validate(Object.fromEntries(new FormData(form)));if(state.payments.some(p=>p.dept_vch_no===reviewed.dept_vch_no))throw Error('That voucher number is already saved. Check Office details.');review(reviewed); } catch(e) { error(e.message); } finally { button.disabled=false; }
});
form.addEventListener('invalid',()=>{$('office').open=true;},true);
$('back').onclick=()=>show('entry');
$('save').onclick=async()=>{
  if(saving)return;
  if(!$('confirmed').checked){error('Please tick the box to confirm that you have checked the details.');$('confirmed').focus();return;}
  saving=true;$('save').disabled=true;$('save').textContent='Preparing your voucher…';
  try {
    const blob=workbook(template,reviewed);
    state=await savePayment(reviewed,state.revision);
    const payment=state.payments[0];
    $('download').onclick=event=>{event.preventDefault();downloadPayment(payment);};$('success-name').textContent=`Voucher ${reviewed.dept_vch_no.padStart(3,'0')} for ${reviewed.payee_name}.`;
    history();show('success');
    // Start the download; the same link remains available if the browser asks for permission.
    download(blob,payment.filename);
  } catch(e) {error(e.message);} finally {saving=false;$('save').disabled=false;$('save').textContent='Save & download voucher';}
};
$('another').onclick=()=>{fillDefaults();show('entry');$('payee').focus();};
form.querySelector('button[type=submit]').disabled=true;
$('backup').onclick=async()=>{try{
  const current=await readState();
  download(new Blob([JSON.stringify({format:'cashbook-browser-v1',payments:current.payments},null,2)],{type:'application/json'}),'Cashbook-backup-'+localDate()+'.json');
}catch(e){error(e.message);}};
$('export-csv').onclick=async event=>{event.preventDefault();try{download(new Blob([csv((await readState()).payments)],{type:'text/csv;charset=utf-8'}),'Cashbook.csv');}catch(e){error(e.message);}};
$('restore').onchange=async event=>{try{
  const file=event.target.files[0];if(!file)return;
  if(file.size>20000000)throw Error('This backup is too large.');
  const restored=restoreBackup(JSON.parse(await file.text()));
  state=await restoreState(restored);fillDefaults();history();
  $('storage-status').textContent='Backup restored: '+state.payments.length+' saved vouchers.';
}catch(e){error(e.message);}finally{event.target.value='';}};
Promise.all([openStore(),fetch('./template.json').then(r=>{if(!r.ok)throw Error('Could not load the voucher template.');return r.json();})]).then(async ([data,parts])=>{
  state=data;template=parts;fillDefaults();history();
  form.querySelector('button[type=submit]').disabled=false;
  if(navigator.storage?.persist){try{const kept=await navigator.storage.persist();$('storage-status').textContent=kept?'Browser storage protection is enabled. Keep a backup too.':'Keep regular backups. Browser storage can be cleared by your browser or device.';}catch{}}
}).catch(e=>error('Could not load your cashbook. '+e.message));
