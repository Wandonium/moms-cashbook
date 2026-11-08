// All amounts are integer hundredths. Multiplication uses BigInt to avoid float rounding.
export const OFFICE = ['allocation','expenditure','item_no','accnt_no','vote','head/subhead','station','financial year','usd_rate','eur_rate'];
export function initialState() {
  return {revision:0,payments:[],defaults:{allocation:'1000000.00',expenditure:'0.00',item_no:'SAMPLE',accnt_no:'SAMPLE',vote:'PRACTICE', 'head/subhead':'SAMPLE',station:'SAMPLE','financial year':'2026/2027',usd_rate:'129.00',eur_rate:'151.00',dept_vch_no:'1',cashbook_vch_no:'1',configured:true}};
}
export function cents(value) {
  const m=String(value).trim().replaceAll(',','').match(/^(\d{1,12})(?:\.(\d{1,12}))?$/);
  if(!m) throw Error('Enter a valid nonnegative amount.');
  const fraction=(m[2]||'').padEnd(3,'0');
  return BigInt(m[1])*100n+BigInt(fraction.slice(0,2))+(fraction[2]>='5'?1n:0n);
}
export function decimal(n) { return `${n<0n?'-':''}${(n<0n?-n:n)/100n}.${String((n<0n?-n:n)%100n).padStart(2,'0')}`; }
export function words(amount,currency) {
  const ones=['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
  const tens=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
  function w(n) {if(n<20)return ones[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+w(n%10):'');for(const [d,label] of [[1e12,'TRILLION'],[1e9,'BILLION'],[1e6,'MILLION'],[1000,'THOUSAND'],[100,'HUNDRED']])if(n>=d)return w(Math.floor(n/d))+' '+label+(n%d?' '+w(n%d):'');}
  const n=cents(amount),unit={EUR:'EURO',USD:'US DOLLAR',KES:'KENYA SHILLING'}[currency];
  return [n/100n?w(Number(n/100n))+' '+unit:'',n%100n?w(Number(n%100n))+' CENT':''].filter(Boolean).join(' ')||'ZERO '+unit;
}
export function validate(input) {
  if(!input||typeof input!=='object')throw Error('Please enter payment details.');
  const v={};
  const limits={payee_name:60,particulars:220,item:30,item_no:25,accnt_no:50,vote:40,'head/subhead':30,station:15,'financial year':20};
  for(const key of ['payee_name','particulars','item','date','amount','currency','dept_vch_no','cashbook_vch_no',...OFFICE]) {
    const s=String(input[key]??'').trim();
    if(!s)throw Error('Please fill in '+key.replaceAll('_',' ')+'.');
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f\uD800-\uDFFF]/u.test(s))throw Error('Please remove unusual characters from '+key+'.');
    if(limits[key]&&s.length>limits[key])throw Error('Please shorten '+key.replaceAll('_',' ')+' to '+limits[key]+' characters.');
    v[key]=s;
  }
  if(!['EUR','USD','KES'].includes(v.currency))throw Error('Choose EUR, USD or KES.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!Number.isFinite(Date.parse(v.date+'T12:00:00Z'))||new Date(v.date+'T12:00:00Z').toISOString().slice(0,10)!==v.date)throw Error('Please choose a valid payment date.');
  for(const key of ['amount','allocation','expenditure','usd_rate','eur_rate']) {
    const n=cents(v[key]);
    if(n>99999999999n||(['amount','usd_rate','eur_rate'].includes(key)&&n<=0n))throw Error('Please check '+key.replaceAll('_',' ')+'.');
    v[key]=decimal(n);
  }
  for(const key of ['dept_vch_no','cashbook_vch_no']) {
    if(!/^[0-9]{1,6}$/.test(v[key])||Number(v[key])<1)throw Error('Voucher numbers must be positive whole numbers (up to six digits).');
    v[key]=String(Number(v[key]));
  }
  const rate=v.currency==='KES'?100n:cents(v[v.currency.toLowerCase()+'_rate']);
  const kes=(cents(v.amount)*rate+50n)/100n;
  const balance=cents(v.allocation)-cents(v.expenditure)-kes;
  if(balance<0n)throw Error('This payment exceeds the remaining allocation. Please check the office details.');
  return {...v,kes:decimal(kes),balance:decimal(balance),words:words(v.amount,v.currency)};
}
export function nextState(state,input,id=crypto.randomUUID()) {
  const v=validate(input);
  if(state.payments.some(p=>p.dept_vch_no===v.dept_vch_no))throw Error('That department voucher number is already saved. Refresh and check Office details.');
  const defaults=Object.fromEntries(OFFICE.map(k=>[k,v[k]]));
  Object.assign(defaults,{expenditure:decimal(cents(v.expenditure)+cents(v.kes)),dept_vch_no:String(Number(v.dept_vch_no)+1),cashbook_vch_no:String(Number(v.cashbook_vch_no)+1),configured:true});
  const slug=v.payee_name.replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'PAYEE';
  const payment={...v,id,filename:`TEST_Voucher_${v.dept_vch_no.padStart(3,'0')}_${slug}_${v.date}.xlsx`};
  return {revision:state.revision+1,defaults,payments:[payment,...state.payments]};
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function fillSheet(xml,v) {
  const date=new Date(v.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).toUpperCase();
  const dept=v.dept_vch_no.padStart(3,'0');
  const texts={F13:v.payee_name.toUpperCase(),C16:v.particulars,D25:v.words,I19:`Rate : 1 USD= KES ${v.usd_rate}`,I20:`Rate : 1 EUR= KES ${v.eur_rate}`,E41:v.item_no,C47:`Less: This Entry - Vch.No. ......'${dept}`,C52:`Date: …………..${date}…………………`,J42:`Date: …………${date}`,J55:`Date:……${date}`,F62:dept,I62:v.cashbook_vch_no,K62:date,D64:v.accnt_no.split('-').map(s=>s.trim()).join(' - '),D66:'',L66:'',L15:v.currency==='EUR'?'EURO':v.currency,K24:v.currency==='EUR'?'EURO':v.currency,C25:v.currency==='EUR'?'EURO':v.currency,C58:v.vote,F58:v['head/subhead'],K58:v.item,G62:v.station,C62:v['financial year']};
  const nums={L19:v.amount,G41:v.allocation,G43:v.expenditure};
  const rate=v.currency==='KES'?'1.00':v[v.currency.toLowerCase()+'_rate'];
  const formulas={L24:['SUM(L19:L23)',v.amount],G45:['G41-G43',decimal(cents(v.allocation)-cents(v.expenditure))],L64:[`ROUND(L24*${rate},2)`,v.kes],G47:['L64',v.kes],G49:['G45-G47',v.balance]};
  const needed=new Set([...Object.keys(texts),...Object.keys(nums),...Object.keys(formulas)]);
  const out=xml.replace(/<c\b([^>]*?\br="([A-Z]+\d+)"[^>]*?)(?:\/>|>.*?<\/c>)/gs,(whole,attrs,ref)=>{
    if(!needed.has(ref))return whole;needed.delete(ref);attrs=attrs.replace(/\s+t="[^"]*"/g,'');
    if(ref in texts)return `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${esc(texts[ref])}</t></is></c>`;
    if(ref in nums)return `<c${attrs}><v>${nums[ref]}</v></c>`;
    return `<c${attrs}><f>${esc(formulas[ref][0])}</f><v>${formulas[ref][1]}</v></c>`;
  });
  if(needed.size)throw Error('Voucher template is missing fields: '+[...needed].join(', '));
  return out;
}
// Standard ZIP STORE writer: original XML, images and styles need no third-party library.
const encoder=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
export function zip(entries) {
  const local=[],central=[];let offset=0,centralSize=0;
  for(const [name,data] of entries) {
    const path=encoder.encode(name),sum=crc(data),h=new Uint8Array(30+path.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);d.setUint16(12,33,true);d.setUint32(14,sum,true);d.setUint32(18,data.length,true);d.setUint32(22,data.length,true);d.setUint16(26,path.length,true);h.set(path,30);
    const c=new Uint8Array(46+path.length),v=new DataView(c.buffer);
    v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,sum,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,path.length,true);v.setUint32(42,offset,true);c.set(path,46);
    local.push(h,data);central.push(c);offset+=h.length+data.length;centralSize+=c.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function workbook(parts,input) {
  const v=validate(input);
  return zip(Object.entries(parts).map(([name,b64])=>[name,name==='xl/worksheets/sheet1.xml'?encoder.encode(fillSheet(new TextDecoder().decode(Uint8Array.from(atob(b64),c=>c.charCodeAt(0))),v)):Uint8Array.from(atob(b64),c=>c.charCodeAt(0))]));
}
export function csv(payments) {
  const columns=['date','dept_vch_no','cashbook_vch_no','payee_name','particulars','item','currency','amount','kes','allocation','expenditure','balance',...OFFICE.filter(k=>!['allocation','expenditure'].includes(k))];
  const quote=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
  return '\ufeff'+[columns,...payments.slice().reverse().map(p=>columns.map(k=>p[k]))].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function restoreBackup(data) {
  if(data?.format!=='cashbook-browser-v1'||!Array.isArray(data.payments)||data.payments.length>10000)throw Error('This is not a supported Cashbook backup.');
  let s=initialState();
  for(const p of data.payments.slice().reverse())s=nextState(s,p);
  return s;
}
