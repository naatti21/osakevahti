import {test, expect} from '@playwright/test';

const WORKER = 'https://osakevahti-market-ed59.teemu-natunen84.workers.dev/**';
const KEY = 'osakevahti.single.v1';
const base = {
  baseCurrency:'EUR',apiKey:'',holdings:[],news:[],quoteUpdatedAt:null,
  riskBudgetPct:1.25,showDetails:false
};

async function start(page, ocr, resolver) {
  await page.addInitScript(({ocr,base,KEY})=>{
    localStorage.setItem(KEY,JSON.stringify(base));
    window.__OSAKEVAHTI_TEST_OCR__=async()=>ocr;
  },{ocr,base,KEY});
  await page.route(WORKER, async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/resolve'){
      const q=url.searchParams.get('q')||'';
      return route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({provider:'Synthetic relevance fixture',query:q,candidates:resolver(q)})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:'{"assets":{},"errors":{}}'});
  });
  await page.goto('/index.html');
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('#portfolioImportBox > summary').click();
  await page.locator('#importImage').setInputFiles({
    name:'synthetic-portfolio.png',mimeType:'image/png',
    buffer:Buffer.from([137,80,78,71])
  });
}

const unrelated=[
  {symbol:'AMD',longname:'Advanced Micro Devices, Inc.',currency:'USD',quote_type:'EQUITY',exchange:'NMS',full_exchange_name:'NasdaqGS'},
  {symbol:'AAPL',longname:'Apple Inc.',currency:'USD',quote_type:'EQUITY',exchange:'NMS',full_exchange_name:'NasdaqGS'},
  {symbol:'AMZN',longname:'Amazon.com, Inc.',currency:'USD',quote_type:'EQUITY',exchange:'NMS',full_exchange_name:'NasdaqGS'}
];

function ocr(lines) {
  return {text:lines.join('\n'),lines:lines.map((text,i)=>({text,confidence:97,top:i*25,left:10}))};
}

test('Alpha OCR: Nordea cannot suggest AMD, Apple or Amazon; UI commands are not holdings',async({page})=>{
  await start(page,ocr([
    'Näytä Lähteet','enemmän',
    'Nordea Bank Abp a','91 kpl','GAV 10.50 EUR'
  ]), q=>q.toLowerCase().includes('nordea')?[
    ...unrelated,{symbol:'NDA-FI.HE',longname:'Nordea Bank Abp',currency:'EUR',quote_type:'EQUITY',exchange:'HEL',full_exchange_name:'Helsinki'}
  ]:unrelated);
  const dlg=page.locator('#importReviewDlg');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.importReviewRow')).toHaveCount(1);
  await expect(dlg).toContainText('Nordea Bank Abp a');
  await expect(dlg).not.toContainText('Näytä Lähteet');
  await expect(dlg).not.toContainText('enemmän');
  await expect(dlg.locator('.importCandidate')).toContainText(['NDA-FI.HE','Jätä tunnistamatta']);
  await expect(dlg).not.toContainText('Advanced Micro Devices');
  await expect(dlg).not.toContainText('Apple Inc.');
  await expect(dlg).not.toContainText('Amazon.com');
  await expect(page.locator('#confirmImportReview')).toBeDisabled();
  expect(await page.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)).holdings,KEY)).toEqual([]);
});

test('Alpha OCR: fuzzy search returning only irrelevant companies never offers them for Nordea',async({page})=>{
  await start(page,ocr(['Nordea Bank Abp a','91 kpl','GAV 10.50 EUR']),()=>unrelated);
  const dlg=page.locator('#importReviewDlg');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.importReviewRow')).toHaveCount(1);
  await expect(dlg.locator('[data-candidate]')).toHaveCount(0);
  await expect(page.locator('#confirmImportReview')).toBeDisabled();
});

test('Alpha OCR: actual AMD remains available even alongside unrelated Yahoo matches',async({page})=>{
  await start(page,ocr(['Advanced Micro Devices, Inc.','5 kpl','GAV 100.50 USD']),
    q=>q.toLowerCase().includes('advanced micro')?[
      unrelated[1],unrelated[2],unrelated[0]
    ]:unrelated);
  const dlg=page.locator('#importReviewDlg');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.importReviewRow')).toHaveCount(1);
  await expect(dlg).toContainText('AMD');
  await expect(dlg).not.toContainText('Apple Inc.');
  await expect(dlg).not.toContainText('Amazon.com');
  expect(await page.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)).holdings,KEY)).toEqual([]);
});
