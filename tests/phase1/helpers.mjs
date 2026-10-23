import {expect} from '@playwright/test';
import {KEY,NOW,legacyFund,ocrFund} from './fixtures.mjs';
export async function setup(page,{holdings=[legacyFund],quotes={},httpStatus=200,ocr=ocrFund()}={}){
 await page.clock.setFixedTime(new Date(NOW));
 await page.addInitScript(({key,holdings,ocr})=>{
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({baseCurrency:'EUR',apiKey:'',holdings,news:[],quoteUpdatedAt:null,riskBudgetPct:1.25,showDetails:false}));
  // Deterministic OCR-boundary double, explicitly NOT a pixel/OCR accuracy test.
  window.__OSAKEVAHTI_TEST_OCR__=async()=>ocr;
 },{key:KEY,holdings,ocr});
 page.on('dialog',d=>d.accept());
 const intercepted=[];
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(['localhost','127.0.0.1'].includes(u.hostname))return route.continue();
  intercepted.push(u.hostname+u.pathname);
  let body={};let status=200;
  if(u.pathname.endsWith('/market-data.json')){status=httpStatus;body={generated_at:NOW,quotes:{},fund_quotes:quotes,fund_errors:{}};}
  else if(u.pathname.endsWith('/resolve'))body={provider:'Synthetic resolver',candidates:[]};
  else if(u.hostname.includes('workers.dev'))body={generated_at:NOW,assets:{},health:{failed:0}};
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/index.html');
 // Let the real startup refresh settle before taking the financial baseline.
 // Do not disable application refresh or compare its pending telemetry race.
 await page.waitForFunction(()=>!state.holdings.length||state.holdings.every(h=>h.quoteHealth?.checkedAt===Date.now()));
 await expect(page.locator('#refreshBtn')).toBeEnabled();return intercepted;
}
export const stored=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).holdings,KEY);
export async function settings(page){await page.locator('[data-view="settingsView"]').click();}
export async function importImage(page,name='Cedar Aurora Japan A EUR',quantity='0,37'){
 await settings(page);const box=page.locator('#portfolioImportBox');if(!await box.evaluate(e=>e.open))await box.locator('summary').first().click();
 const buffer=Buffer.from(await page.evaluate(({name,quantity})=>{const c=document.createElement('canvas');c.width=900;c.height=400;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,900,400);x.fillStyle='black';x.font='30px Arial';['Rahastot',name,quantity+' kpl','NAV 143,75 EUR'].forEach((s,i)=>x.fillText(s,40,60+i*80));return c.toDataURL().split(',')[1];},{name,quantity}),'base64');
 await page.locator('#importImage').setInputFiles({name:'synthetic-phase1.png',mimeType:'image/png',buffer});await expect(page.locator('#fundQty0')).toHaveValue(quantity);return buffer;
}
export async function chooseNew(page,name){
 await page.locator('#fundTarget0').selectOption('__new__');await page.locator('#fundNewName0').fill(name);await page.locator('#fundNewBroker0').selectOption('Nordnet');await page.locator('#fundNewType0').selectOption('FUND');await page.locator('#fundNewLabel0').fill('Test B');await page.locator('#fundNewCurrency0').selectOption('EUR');await page.locator('#fundGav0').fill('101,25');await page.locator('#fundNewConfirmed0').check();
}
export async function commitFund(page){await page.locator('#fundTrialBackupCheck').check();await expect(page.locator('#fundTrialSave')).toBeEnabled();await page.locator('#fundTrialSave').click();}
export async function refresh(page){await page.evaluate(()=>refreshMarket(false));}
export const quote=(overrides={})=>({price:155.25,currency:'EUR',nav_date:'2026-10-23',timestamp:Date.parse(NOW),provider:'Synthetic NAV provider',...overrides});
