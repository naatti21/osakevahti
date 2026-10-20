import { test, expect } from '@playwright/test';

const LOCAL_KEY='osakevahti.single.v1';
const initial=()=>({
 baseCurrency:'EUR',apiKey:'',holdings:[
  {id:'fund-a',name:'Fictional Meadow Fund',symbol:'MEADOW',quantity:12.3456,buyPrice:43.21,currency:'EUR',account:'Fund A',assetType:'fund'},
  {id:'fund-b',name:'Fictional Birch Fund',symbol:'BIRCH',quantity:8.25,buyPrice:18.4,currency:'EUR',account:'Fund B',assetType:'fund'}
 ],news:[],quoteUpdatedAt:null,riskBudgetPct:1.25,showDetails:false
});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');

async function openTrial(page,ocr){
 await page.addInitScript(({state,ocr})=>{
  localStorage.setItem('osakevahti.single.v1',JSON.stringify(state));
  window.__OSAKEVAHTI_TEST_OCR__=async()=>ocr;
  window.confirm=()=>true;
 },{state:initial(),ocr});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===new URL('http://127.0.0.1:4173').origin||url.hostname==='localhost'||url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname.endsWith('.js'))return route.abort();
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/index.html');
 await page.locator('[data-view="settingsView"]').click();
 await page.locator('#portfolioImportBox > summary').click();
 await page.locator('#fundTrialBox > summary').click();
}
test('Alpha fund trial replaces selected total only after explicit backup and approval',async({page})=>{
 await openTrial(page,{text:'Fictional Meadow Fund\n22,5 kpl\nNAV 50,1234 EUR',lines:[
  {text:'Fictional Meadow Fund',top:100,left:20},
  {text:'22,5 kpl',top:145,left:400},
  {text:'NAV 50,1234 EUR',top:180,left:400}
 ]});
 await page.locator('#fundTrialFile').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#fundQty0')).toHaveValue('22,5');
 await page.locator('#fundTarget0').selectOption('fund-a');
 await expect(page.locator('#fundTrialDiff0')).toContainText('12.3456 → 22,5 kpl');
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await page.locator('#fundTrialBackupCheck').check();
 await page.locator('#fundTrialSave').click();
 const holdings=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,LOCAL_KEY);
 expect(holdings.find(h=>h.id==='fund-a').quantity).toBe(22.5);
 expect(holdings.find(h=>h.id==='fund-a').buyPrice).toBe(43.21); // NAV never becomes GAV
 expect(holdings.find(h=>h.id==='fund-b').quantity).toBe(8.25);
 await page.reload();
 const persisted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,LOCAL_KEY);
 expect(persisted.find(h=>h.id==='fund-a').quantity).toBe(22.5);
});
test('Alpha fund trial does not silently match or overwrite when two OCR rows target same holding',async({page})=>{
 await openTrial(page,{text:'Fund A\n2,5 kpl\nFund B\n3,25 kpl',lines:[
  {text:'Fund A'}, {text:'2,5 kpl'}, {text:'Fund B'}, {text:'3,25 kpl'}
 ]});
 await page.locator('#fundTrialFile').setInputFiles({name:'fictional-2.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#fundQty1')).toHaveValue('3,25');
 await page.locator('#fundTarget0').selectOption('fund-a');
 await page.locator('#fundTarget1').selectOption('fund-a');
 await page.locator('#fundTrialBackupCheck').check();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 const holdings=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,LOCAL_KEY);
 expect(holdings.find(h=>h.id==='fund-a').quantity).toBe(12.3456);
});
test('Alpha fund trial can explicitly update GAV but cancel keeps holdings unchanged',async({page})=>{
 await openTrial(page,{text:'Fictional Birch Fund\n9,75 kpl',lines:[{text:'Fictional Birch Fund'},{text:'9,75 kpl'}]});
 await page.locator('#fundTrialFile').setInputFiles({name:'fictional-3.png',mimeType:'image/png',buffer:png});
 await page.locator('#fundTarget0').selectOption('fund-b');
 await page.locator('#fundGav0').fill('19,42');
 await expect(page.locator('#fundTrialDiff0')).toContainText('18.4 → 19,42');
 await page.locator('#fundTrialClear').click();
 await expect(page.locator('#fundTrialRows .importReviewRow')).toHaveCount(0);
 const holdings=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,LOCAL_KEY);
 expect(holdings.find(h=>h.id==='fund-b').quantity).toBe(8.25);
 expect(holdings.find(h=>h.id==='fund-b').buyPrice).toBe(18.4);
});
