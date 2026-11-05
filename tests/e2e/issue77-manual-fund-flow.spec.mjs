import {test,expect} from '@playwright/test';
const KEY='osakevahti.single.v1';
async function start(page,holdings=[]){
  await page.route('https://**/*',r=>r.fulfill({json:{}}));
  await page.goto('/');
  await page.evaluate(({key,holdings})=>localStorage.setItem(key,JSON.stringify({holdings,baseCurrency:'EUR',fxRates:{EUR:1},settings:{}})),{key:KEY,holdings});
  await page.reload();
  await page.getByRole('button',{name:'+ Lisää rahasto'}).click();
}
async function fill(page){
  for(const [id,value] of Object.entries({newFundName:'Fiktiivinen Revontuli B',newFundClass:'B',newFundBroker:'Testipankki',newFundAccount:'Pitkä säästö',newFundQuantity:'2.5',newFundCost:'80',newFundNav:'100',newFundDate:'2026-10-22',newFundSource:'Synteettinen rahastoraportti'}))await page.locator('#'+id).fill(value);
  await page.locator('#newFundConfirm').check();
}
test('unknown name-only fund: explicit confirmation, manual NAV, backup and reload at 360px',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await start(page);await fill(page);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
  await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
  await expect(page.locator('#newFundDialog')).not.toBeVisible();
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  expect(saved.holdings).toHaveLength(1);
  const h=saved.holdings[0];
  expect(h).toMatchObject({symbol:'',quantity:2.5,buyPrice:80,manualPrice:100,navDate:'2026-10-22',assetType:'fund'});
  expect(h.instrument.identification).toBe('unverified');
  expect(h.quoteObservation).toMatchObject({sourceKind:'manual',navDate:'2026-10-22',currency:'EUR'});
  await expect(page.locator('#portfolioValue')).toContainText('≈ 250,00');
  await page.reload();
  await expect(page.locator('body')).toContainText('KÄSIN');
  // Restore through the actual file input, not an injected state assignment.
  await page.locator('[data-view="settingsView"]').click();
  await page.getByText('Varmuuskopio',{exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download=await downloadPromise;
  const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const backup=Buffer.concat(chunks);
  expect(JSON.parse(backup.toString()).holdings).toEqual(saved.holdings);
  await page.locator('[data-view="portfolioView"]').click();
  await page.locator('#holdings .item').click();
  await page.locator('#newFundCost').fill('90');await page.locator('#newFundConfirm').check();
  await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
  await expect(page.locator('#newFundDialog')).not.toBeVisible();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY)).toMatchObject({buyPrice:90,quantity:2.5,manualPrice:100});
  await page.locator('[data-view="settingsView"]').click();
  for(let attempt=0;attempt<2;attempt++){
    await page.locator('#importBackup').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:backup});
    await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY)).toEqual(saved.holdings);
  }
});
test('quota failure retains form and existing portfolio',async({page})=>{
  await start(page,[{id:'keep',symbol:'SYNTH',name:'Synthetic existing',currency:'EUR',quantity:7,buyPrice:12,account:'Test',assetType:'stock'}]);await fill(page);
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}});
  await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
  await expect(page.locator('#newFundError')).toContainText('Tallennus epäonnistui');
  await expect(page.locator('#newFundName')).toHaveValue('Fiktiivinen Revontuli B');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY)).toEqual(before);
});

test('manual foreign NAV does not fabricate FX or a precise portfolio total',async({page})=>{
 await start(page);await fill(page);await page.locator('#newFundCurrency').selectOption('CHF');
 await expect(page.locator('#newFundConfirm')).not.toBeChecked();await page.locator('#newFundConfirm').check();
 await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
 await expect(page.locator('#newFundDialog')).not.toBeVisible();
 await expect(page.locator('#portfolioValue')).toHaveText('—');
 await expect(page.locator('#valuationWarning')).toContainText('valuuttakurssi');
});
test.describe('offline manual fund',()=>{
 test.use({serviceWorkers:'allow'});
 test('cached review module saves locally offline and survives reload',async({page,context})=>{
  await page.goto('/');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({holdings:[],baseCurrency:'EUR',settings:{}})),KEY);
  await context.setOffline(true);await page.reload();
  await page.getByRole('button',{name:'+ Lisää rahasto'}).click();await fill(page);
  await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
  await expect(page.locator('#newFundDialog')).not.toBeVisible();
  await page.reload();await expect(page.locator('#portfolioValue')).toContainText('≈ 250,00');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0].quoteObservation.sourceKind,KEY)).toBe('manual');
 });
});

test('5 November: 22 October public NAV is visibly 14 days old and cannot overwrite previous price',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-05T10:00:00Z'));
 const isin='IE00B03HD191';
 await page.route('https://**/*',route=>route.fulfill({json:route.request().url().includes('Fund_ClosingPrices_LATEST.json')?
  [{ISIN:isin,currency:'EUR',closePrice:'100',closePriceDate:'20261022'}]:{}}));
 await page.addInitScript(({key,isin})=>{
  if(localStorage.getItem(key))return;
  localStorage.setItem(key,JSON.stringify({baseCurrency:'EUR',holdings:[{id:'stale-test',symbol:'',assetType:'fund',name:'Synthetic source test',currency:'EUR',quantity:2,buyPrice:80,currentPrice:90,navDate:'2026-10-20',instrument:{isin,currency:'EUR'}}]}));
 },{key:KEY,isin});
 await page.goto('/');await page.locator('#refreshBtn').click();
 await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0].navDiagnostic?.status,KEY)).toBe('stale_nav');
 const h=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0],KEY);
 expect(h.currentPrice).toBe(90);expect(h.navDate).toBe('2026-10-20');
 expect(h.navDiagnostic.ageDays).toBe(14);expect(h.navDiagnostic.feedNewestDate).toBe('2026-10-22');
 await page.locator('#priceHealthSummary').click();await expect(page.locator('#priceHealthItems')).toContainText('14 kalenteripäivää');
});
