import {test,expect} from '@playwright/test';

const KEY='osakevahti.single.v1';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const fund={text:'Rahastot\non Storebrand Japan A EUR\n0,37 kpl\nNAV 182,86 EUR',
  lines:[{text:'Rahastot',top:10,left:25},
    {text:'on Storebrand Japan A EUR',top:100,left:25},
    {text:'0,37 kpl',top:140,left:300},
    {text:'NAV 182,86 EUR',top:180,left:300}]};
const baseHolding={id:'old',name:'Nordnet Eurooppa Indeksi',symbol:'',
 quantity:3.01,buyPrice:160.02,currency:'EUR',account:'Nordnet / Rahastotili',
 accountType:'FUND',broker:'Nordnet',accountLabel:'',assetType:'fund',
 accountDetailsConfirmed:true};
async function setup(page,{holdings=[baseHolding],ocr=fund,confirm=true}={}){
 await page.addInitScript(({holdings,ocr,confirm})=>{
  localStorage.setItem('osakevahti.single.v1',JSON.stringify({
   baseCurrency:'EUR',apiKey:'',holdings,news:[],quoteUpdatedAt:null,
   riskBudgetPct:1.25,showDetails:false
  }));
  window.__OSAKEVAHTI_TEST_OCR__=async()=>ocr;
  window.confirm=()=>confirm;
 },{holdings,ocr,confirm});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/index.html');
 await page.locator('[data-view="settingsView"]').click();
 await page.locator('#portfolioImportBox > summary').click();
 await page.locator('#importImage').setInputFiles({name:'fictional-fund.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#fundQty0')).toHaveValue('0,37');
}
async function chooseNew(page,{name='Storebrand Japan A EUR',broker='Nordnet',
  type='FUND',currency='EUR',gav='170,50',confirmed=true}={}){
 await page.locator('#fundTarget0').selectOption('__new__');
 await expect(page.locator('#fundNewBox0')).toBeVisible();
 await page.locator('#fundNewName0').fill(name);
 await page.locator('#fundNewBroker0').selectOption(broker);
 await page.locator('#fundNewType0').selectOption(type);
 await page.locator('#fundNewCurrency0').selectOption(currency);
 if(gav)await page.locator('#fundGav0').fill(gav);
 if(confirmed)await page.locator('#fundNewConfirmed0').check();
}
test('Unknown screenshot fund can be saved as new without inventing ticker or NAV acquisition price',async({page})=>{
 await setup(page);
 await expect(page.locator('#fundTarget0 option[value="__new__"]')).toHaveCount(1);
 await page.locator('#fundTarget0').selectOption('__new__');
 await expect(page.locator('#fundNewName0')).toHaveValue('Storebrand Japan A EUR');
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await page.locator('#fundNewBroker0').selectOption('Nordnet');
 await page.locator('#fundNewType0').selectOption('FUND');
 await page.locator('#fundNewCurrency0').selectOption('EUR');
 await page.locator('#fundNewConfirmed0').check();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await page.locator('#fundGav0').fill('170,50');
 await page.locator('#fundTrialBackupCheck').check();
 await expect(page.locator('#fundTrialSave')).toBeEnabled();
 await page.locator('#fundTrialSave').click();
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(saved).toHaveLength(2);
 expect(saved.find(h=>h.id==='old').quantity).toBe(3.01);
 const created=saved.find(h=>h.name==='Storebrand Japan A EUR');
 expect(created.quantity).toBe(.37);
 expect(created.buyPrice).toBe(170.5);
 expect(created.assetType).toBe('fund');
 expect(created.symbol).toBe('');
 expect(created.instrument.isin).toBe('');
 expect(created.instrument.identification).toBe('unverified');
 expect(created.accountType).toBe('FUND');
 expect(created.broker).toBe('Nordnet');
 await page.reload();
 const persisted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(persisted).toHaveLength(2);
 expect(persisted.find(h=>h.name==='Storebrand Japan A EUR').quantity).toBe(.37);
});
test('New fund requires explicit name, valid account, currency, GAV and backup confirmation',async({page})=>{
 await setup(page,{holdings:[]});
 await chooseNew(page,{gav:'',confirmed:false});
 await page.locator('#fundTrialBackupCheck').check();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await expect(page.locator('#fundTrialStatus')).toContainText('Uusi rahasto');
 await page.locator('#fundGav0').fill('123,45');
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await page.locator('#fundNewConfirmed0').check();
 await expect(page.locator('#fundTrialSave')).toBeEnabled();
 await page.locator('#fundNewName0').fill('Storebrand Japan B EUR');
 await expect(page.locator('#fundNewConfirmed0')).not.toBeChecked();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(saved).toHaveLength(0);
});
test('New fund blocks duplicate confirmed identity on same account',async({page})=>{
 const same={...baseHolding,id:'same',name:'Storebrand Japan A EUR',quantity:1,buyPrice:110};
 await setup(page,{holdings:[same]});
 await chooseNew(page);
 await page.locator('#fundTrialBackupCheck').check();
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
 await expect(page.locator('#fundTrialStatus')).toContainText('löytyy jo tältä tililtä');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(saved).toHaveLength(1);
 expect(saved[0].quantity).toBe(1);
});
test('New fund never accepts an OST as a destination',async({page})=>{
 await setup(page,{holdings:[]});
 await page.locator('#fundTarget0').selectOption('__new__');
 await expect(page.locator('#fundNewType0 option[value="OST"]')).toHaveCount(0);
 await expect(page.locator('#fundTrialSave')).toBeDisabled();
});
test('Cancelling the final confirmation does not write a fund',async({page})=>{
 await setup(page,{confirm:false});
 await chooseNew(page);
 await page.locator('#fundTrialBackupCheck').check();
 await expect(page.locator('#fundTrialSave')).toBeEnabled();
 await page.locator('#fundTrialSave').click();
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
 expect(saved).toHaveLength(1);
 expect(saved[0].id).toBe('old');
});
