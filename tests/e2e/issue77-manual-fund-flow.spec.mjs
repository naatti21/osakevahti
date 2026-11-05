import {test,expect} from '@playwright/test';
const KEY='osakevahti.single.v1';
async function start(page){
  await page.route('https://**/*',r=>r.fulfill({json:{}}));
  await page.goto('/');
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({holdings:[],baseCurrency:'EUR',fxRates:{EUR:1},settings:{}})),KEY);
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
  await page.reload();
  await expect(page.locator('body')).toContainText('KÄSIN');
  // Restore through the actual file input, not an injected state assignment.
  await page.locator('[data-view="settingsView"]').click();
  await page.locator('#importBackup').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY)).toEqual(saved.holdings);
});
test('quota failure retains form and existing portfolio',async({page})=>{
  await start(page);await fill(page);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}});
  await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
  await expect(page.locator('#newFundError')).toContainText('Tallennus epäonnistui');
  await expect(page.locator('#newFundName')).toHaveValue('Fiktiivinen Revontuli B');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
