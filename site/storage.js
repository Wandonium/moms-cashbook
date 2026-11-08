import {initialState,nextState} from './core.js';
let db;
export async function openStore() {
  db=await new Promise((resolve,reject)=>{const r=indexedDB.open('moms-cashbook-practice-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('register');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Browser storage is unavailable. Use a normal browser window with site storage enabled.'));r.onblocked=()=>reject(Error('Close other Cashbook tabs and reload.'));});
  return readState();
}
export function readState() {
  return new Promise((resolve,reject)=>{const tx=db.transaction('register'),r=tx.objectStore('register').get('state');r.onsuccess=()=>resolve(r.result||initialState());r.onerror=()=>reject(r.error);});
}
export function savePayment(input,revision) {
  return mutate(current=>{if(current.revision!==revision)throw Error('Your cashbook changed in another tab. Reload and review the latest voucher number and office details.');return nextState(current,input);});
}
export function restoreState(restored) {
  return mutate(current=>{if(current.payments.length)throw Error('Restore into a browser with no saved vouchers, so existing records are kept safe.');return {...restored,revision:current.revision+1};});
}
function mutate(change) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('register','readwrite'),store=tx.objectStore('register'),r=store.get('state');let updated,issue;
    r.onsuccess=()=>{try{updated=change(r.result||initialState());store.put(updated,'state');}catch(e){issue=e;tx.abort();}};
    tx.oncomplete=()=>resolve(updated);
    tx.onabort=()=>reject(issue||tx.error||Error('Could not save. Check browser storage space and try again.'));
    tx.onerror=()=>{};
  });
}
