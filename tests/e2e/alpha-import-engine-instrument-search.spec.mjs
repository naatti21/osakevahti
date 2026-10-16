import {test,expect} from '@playwright/test';
const KEY='osakevahti.single.v1';
const WORKER='https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';
const NOKIA=[
 {symbol:'NOKIA.HE',longname:'Nokia Oyj',exchange:'HEL',full_exchange_name:'Helsinki',currency:'EUR',quote_type:'EQUITY',instrument_type:'EQUITY'},
 {symbol:'NOK',longname:'Nokia Oyj ADR',exchange:'NYQ',full_exchange_name:'New York',currency:'USD',quote_type:'EQUITY',instrument_type:'EQUITY'}
];
async function init(page){
 await page.route(WORKER,async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/resolve'){
     const q=url.searchParams.get('q')||'';
     const candidates=q.toLowerCase().includes('nokia')?NOKIA:q.toLowerCase().includes('aster')
       ? [{symbol:'ASTR',longname:'Aster Devices Corporation',currency:'USD',quote_type:'EQUITY',exchange:'NMS',full_exchange_name:'NasdaqGS'}]:[];
     return route.fulfill({contentType:'application/json',status:200,body:JSON.stringify({provider:'synthetic-stub',candidates})});
   }
   return route.fulfill({status:200,contentType:'application/json',body:'{"assets":{},"errors":{}}'});
 });
 await page.goto('/index.html');
 await expect(page.locator('#addBtn')).toBeVisible();
}
async function enterPortfolioInfo(page){
 await page.locator('#qty').fill('15');
 await page.locator('#buy').fill('5');
 await page.locator('#accountType').selectOption('AOT');
 await page.locator('#brokerSelect').selectOption('Nordnet');
}
async function lookup(page){
 await page.locator('#openInstrumentLookup').click();
 await page.locator('#instrumentSearchQuery').fill('Nokia');
 await page.locator('#instrumentSearchRun').click();
 await expect(page.locator('[data-alpha-instrument-candidate]')).toHaveCount(2);
 await expect(page.locator('#instrumentSearchResults')).toContainText('Helsinki');
 await expect(page.locator('#instrumentSearchResults')).toContainText('New York');
}
test('Alpha mobile: search alternatives; No returns same list with form preserved; Yes adds 15, never 30',async({page})=>{
 await init(page);
 await page.locator('#addBtn').click();
 await enterPortfolioInfo(page);
 await lookup(page);
 const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY);
 expect(before).toBe(0);
 await page.locator('[data-alpha-instrument-candidate="NOKIA.HE"]').click();
 await expect(page.locator('#alphaInstrumentSearch')).toBeHidden();
 let prompt='';
 page.once('dialog',async d=>{prompt=d.message();await d.dismiss()});
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#alphaInstrumentSearch')).toBeVisible();
 expect(prompt).toContain('15 kpl');
 expect(prompt).toContain('NOKIA.HE');
 expect(await page.locator('#qty').inputValue()).toBe('15');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
 await page.locator('[data-alpha-instrument-candidate="NOKIA.HE"]').click();
 page.once('dialog',d=>d.accept());
 await page.locator('#form button[type="submit"]').click();
 await expect(page.locator('#dlg')).toBeHidden();
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(saved).toHaveLength(1);
 expect(saved[0].symbol).toBe('NOKIA.HE');
 expect(saved[0].providerSymbol).toBe('NOKIA.HE');
 expect(saved[0].quantity).toBe(15);
 expect(saved[0].currency).toBe('EUR');
 expect(saved[0].instrument.identification).toBe('user-confirmed');
});
test('Alpha: updating selected listing means total 15 shares, not adding 15',async({page})=>{
 await init(page);
 await page.locator('#addBtn').click();
 await enterPortfolioInfo(page);
 await lookup(page);
 await page.locator('[data-alpha-instrument-candidate="NOKIA.HE"]').click();
 page.once('dialog',d=>d.accept());
 await page.locator('#form button[type="submit"]').click();
 const existing=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 await page.evaluate(id=>openDlg(id),existing.id);
 await page.locator('#qty').fill('9');
 await lookup(page);
 await page.locator('[data-alpha-instrument-candidate="NOKIA.HE"]').click();
 page.once('dialog',async d=>{expect(d.message()).toContain('kokonaismääräksi 9 kpl');await d.accept()});
 await page.locator('#form button[type="submit"]').click();
 const updated=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(updated).toHaveLength(1);
 expect(updated[0].id).toBe(existing.id);
 expect(updated[0].quantity).toBe(9);
});
test('Alpha: no instrument results never changes portfolio',async({page})=>{
 await init(page);
 await page.locator('#addBtn').click();
 await page.locator('#openInstrumentLookup').click();
 await page.locator('#instrumentSearchQuery').fill('NoSuchInstrument_904');
 await page.locator('#instrumentSearchRun').click();
 await expect(page.locator('#instrumentSearchStatus')).toContainText('ei löytynyt');
 await expect(page.locator('[data-alpha-instrument-candidate]')).toHaveCount(0);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
test('Alpha image: pinned research Engine evaluates actual OCR rows, no data saved on preview cancel',async({page})=>{
 await page.addInitScript(()=>{
   window.__OSAKEVAHTI_TEST_OCR__=async()=>({
     text:'Aster Devices Corporation\nTicker ASTR\n12 kpl\nGAV 35 USD',
     lines:[
       {text:'Aster Devices Corporation',top:10,left:15,confidence:96},
       {text:'Ticker ASTR',top:35,left:15,confidence:96},
       {text:'12 kpl',top:60,left:15,confidence:96},
       {text:'GAV 35 USD',top:85,left:15,confidence:96}
     ]
   });
 });
 await init(page);
 await page.locator('[data-view="settingsView"]').click();
 await page.locator('#portfolioImportBox summary').click();
 await page.locator('#importImage').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71])});
 await expect(page.locator('#importReviewDlg')).toBeVisible();
 await expect(page.locator('#importReviewList')).toContainText('Äppejä Import Engine');
 await expect(page.locator('#importReviewList')).toContainText('lähdearvot vaikuttavat yhtäpitäviltä');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
 await page.locator('#cancelImportReview').click();
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
