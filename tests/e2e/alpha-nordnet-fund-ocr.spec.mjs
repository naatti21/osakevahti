import {test,expect} from '@playwright/test';

const KEY='osakevahti.single.v1';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const nordnetDetail={
  text:'Nordnet Eurooppa Indeksi\nArvo Tuotto 21.10. NAV/Keskikurssi\n550 € +14,27% +0,95%\n182,86 EUR\n3,01 kpl 69 € 160,02 EUR',
  lines:[
    {text:'& Nordnet Eurooppa Indeksi',top:120,left:25},
    {text:'Arvo Tuotto 21.10. NAV/Keskikurssi',top:220,left:25},
    {text:'550 € +14,27% +0,95%',top:280,left:25},
    {text:'182,86 EUR',top:310,left:410},
    {text:'3,01 kpl 69 € 160,02 EUR',top:365,left:25}
  ]
};
const holding=(id,account)=>({
 id,name:'Nordnet Eurooppa Indeksi',symbol:'',quantity:2.5,buyPrice:160.02,
 currency:'EUR',account,accountType:'FUND',assetType:'fund'
});
async function setup(page,ocr,holdings){
 await page.addInitScript(({ocr,holdings})=>{
  localStorage.setItem('osakevahti.single.v1',JSON.stringify({
   baseCurrency:'EUR',apiKey:'',holdings,news:[],quoteUpdatedAt:null,
   riskBudgetPct:1.25,showDetails:false
  }));
  window.__OSAKEVAHTI_TEST_OCR__=async()=>ocr;
  window.confirm=()=>true;
 },{ocr,holdings});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
  if(url.pathname.endsWith('.js'))return route.abort();
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/index.html');
 await page.locator('[data-view="settingsView"]').click();
 await page.locator('#portfolioImportBox > summary').click();
}
test('Nordnet fund detail uses quantity review, suggests an existing position and never imports NAV as cost',async({page})=>{
 await setup(page,nordnetDetail,[holding('nordnet-europe','AOT'),{
   id:'separate-stock',name:'Microsoft',symbol:'MSFT',quantity:3,buyPrice:300,currency:'USD',account:'AOT',assetType:'stock'
 }]);
 await page.locator('#importImage').setInputFiles({name:'nordnet-detail.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#fundTrialRows .importReviewRow')).toHaveCount(1);
 await expect(page.locator('#fundTrialBox')).toHaveAttribute('open','');
 await expect(page.locator('#importReviewDlg')).not.toBeVisible();
 await expect(page.locator('#fundTrialRows')).toContainText('Nordnet Eurooppa Indeksi');
 await expect(page.locator('#fundQty0')).toHaveValue('3,01');
 await expect(page.locator('#fundTarget0')).toHaveValue('');
 await expect(page.locator('[data-fund-suggest="0"]')).toContainText('Käytä ehdotusta');
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await page.locator('[data-fund-suggest="0"]').click();
 await expect(page.locator('#fundTarget0')).toHaveValue('nordnet-europe');
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await page.locator('#fundTrialBackupCheck').check();
 await page.locator('#fundTrialSave').click();
 const result=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(result.find(h=>h.id==='nordnet-europe').quantity).toBe(3.01);
 expect(result.find(h=>h.id==='nordnet-europe').buyPrice).toBe(160.02);
 expect(result.find(h=>h.id==='separate-stock').quantity).toBe(3);
 expect(result).toHaveLength(2);
});
test('Two accounts with the same fund name remain ambiguous and cannot be selected automatically',async({page})=>{
 await setup(page,nordnetDetail,[holding('fund-a','OST'),holding('fund-b','AOT')]);
 await page.locator('#importImage').setInputFiles({name:'nordnet-ambiguous.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#fundTrialRows')).toContainText('Useampi salkun omistus');
 await expect(page.locator('[data-fund-suggest="0"]')).toHaveCount(0);
 await expect(page.locator('#fundTarget0')).toHaveValue('');
 await page.locator('#fundTrialBackupCheck').check();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 const result=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(result.map(h=>h.quantity)).toEqual([2.5,2.5]);
});
test('Unmatched fund does not fabricate a ticker or automatically create a holding',async({page})=>{
 const unknown={...nordnetDetail,text:nordnetDetail.text.replaceAll('Nordnet Eurooppa Indeksi','Unknown Saffron Index'),lines:nordnetDetail.lines.map(x=>({...x,text:x.text.replaceAll('Nordnet Eurooppa Indeksi','Unknown Saffron Index')}))};
 await setup(page,unknown,[holding('fund-a','AOT')]);
 await page.locator('#importImage').setInputFiles({name:'new-fund.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#fundQty0')).toHaveValue('3,01');
 await expect(page.locator('[data-fund-suggest="0"]')).toHaveCount(0);
 await expect(page.locator('#fundTarget0')).toHaveValue('');
 await expect(page.locator('#importReviewDlg')).not.toBeVisible();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
});
test('OCR and pasted table editors fill the mobile import card width',async({page})=>{
 await setup(page,nordnetDetail,[holding('fund-a','AOT')]);
 await page.locator('#importImage').setInputFiles({name:'nordnet-detail.png',mimeType:'image/png',buffer:png});
 await page.locator('#ocrTextDetails > summary').click();
 const boxes=await page.evaluate(()=>{
  const ocr=document.getElementById('imageOcrText').getBoundingClientRect();
  const text=document.getElementById('importText').getBoundingClientRect();
  const card=document.querySelector('#portfolioImportBox .detailsBody').getBoundingClientRect();
  return {ocr:ocr.width,text:text.width,card:card.width};
 });
 expect(boxes.ocr).toBeGreaterThan(boxes.card*.84);
 expect(boxes.text).toBeGreaterThan(boxes.card*.84);
});
