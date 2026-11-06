import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'allow'});
const KEY='osakevahti.single.v1';
const candidate={type:'fund',name:'Fictional Aurora B EUR',isin:'IE00B03HD191',currency:'EUR',shareClass:'B',provider:'issuer-public-nav',identityEvidence:'provider metadata, not independent verification'};
test('360px name → evidence → manual source acceptance → account → backup/offline',async({page,context})=>{
 await page.setViewportSize({width:360,height:800});
 const queries=[];
 await page.route('https://**/*',route=>{
  if(route.request().url().includes('/v1/search')){queries.push(route.request().url());return route.fulfill({json:{candidates:[candidate]}})}
  return route.fulfill({json:{}});
 });
 await page.goto('/');await expect.poll(()=>page.evaluate(async()=>!!navigator.serviceWorker.controller&&!!await caches.match('./engine/fund-review.mjs'))).toBe(true);await page.getByRole('button',{name:'+ Lisää rahasto'}).click();
 await page.locator('#newFundQuery').fill('Fictional Aurora');
 await page.locator('#newFundSearch').click();
 await page.getByRole('button',{name:'Valitse Fictional Aurora B EUR'}).click();
 await expect(page.locator('#newFundEvidence')).toContainText('IE00B03HD191');
 await expect(page.locator('#newFundSourceStatus')).toContainText('käyttöoikeutta');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
 await page.locator('#newFundIdentityConfirmed').check();
 for(const [id,value] of Object.entries({Broker:'Synthetic bank',Account:'First',Quantity:'0.37',Cost:'80',Nav:'100',Date:'2026-11-05',Source:'Synthetic issuer statement'}))await page.locator('#newFund'+id).fill(value);
 await page.locator('#newFundSourceConfirmed').check();
 await page.locator('#newFundConfirm').check();
 await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
 await expect(page.locator('#newFundDialog')).not.toBeVisible();
 await expect(page.locator('#portfolioValue')).toContainText('≈ 37,00');
 await page.evaluate(()=>refreshMarket(false));
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
 expect(saved.holdings[0]).toMatchObject({quantity:.37,buyPrice:80,symbol:'',instrument:{isin:candidate.isin,identification:'user-confirmed'},sourceBinding:{mode:'manual',isin:candidate.isin}});
 expect(queries).toHaveLength(1);expect(queries[0]).not.toContain('Synthetic');
 await page.locator('[data-view="settingsView"]').click();await page.getByText('Varmuuskopio',{exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();
 const stream=await (await downloadPromise).createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const backup=Buffer.concat(chunks);
 expect(JSON.parse(backup.toString()).holdings).toEqual(saved.holdings);
 await page.locator('[data-view="portfolioView"]').click();await page.locator('#holdings .item').click();await page.locator('#newFundCost').fill('90');await page.locator('#newFundIdentityConfirmed').check();await page.locator('#newFundSourceConfirmed').check();await page.locator('#newFundConfirm').check();await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();await expect(page.locator('#newFundDialog')).not.toBeVisible();
 await page.locator('[data-view="settingsView"]').click();
 await page.locator('#importBackup').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:backup});
 await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY)).toEqual(saved.holdings);
 const corrupted=JSON.parse(backup.toString());corrupted.holdings[0].sourceBinding.currency='USD';
 const rejected=page.waitForEvent('dialog');
 await page.locator('#importBackup').setInputFiles({name:'contradictory.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupted))});
 const dialog=await rejected;expect(dialog.message()).toContain('ristiriidassa');await dialog.dismiss();
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY)).toEqual(saved.holdings);
 await context.setOffline(true);await page.reload();await expect(page.locator('#portfolioValue')).toContainText('≈ 37,00');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings[0].sourceBinding,KEY)).toEqual(saved.holdings[0].sourceBinding);
});

async function manualIdentity(page,account,quantity){
 await page.getByRole('button',{name:'+ Lisää rahasto'}).click();
 for(const [id,value] of Object.entries({Name:candidate.name,Isin:candidate.isin,Class:'B',Broker:'Synthetic bank',Account:account,Quantity:quantity,Cost:'80',Nav:'100',Date:'2026-11-05',Source:'Synthetic statement'}))await page.locator('#newFund'+id).fill(value);
 await page.locator('#newFundIdentityConfirmed').check();await page.locator('#newFundSourceConfirmed').check();await page.locator('#newFundConfirm').check();
 await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
}
test('same ISIN on two accounts remains separate; duplicate rejected; cancellation never commits',async({page})=>{
 await page.route('https://**/*',r=>r.fulfill({json:{}}));await page.goto('/');
 await manualIdentity(page,'One','.37');await expect(page.locator('#newFundDialog')).not.toBeVisible();
 await manualIdentity(page,'Two','4.3');await expect(page.locator('#newFundDialog')).not.toBeVisible();
 await page.evaluate(()=>refreshMarket(false));
 let holdings=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY);
 expect(holdings.map(h=>h.quantity)).toEqual([.37,4.3]);expect(holdings[0].id).not.toBe(holdings[1].id);expect(holdings[0].instrument.id).toBe(holdings[1].instrument.id);expect(holdings[0].accountId).not.toBe(holdings[1].accountId);
 await manualIdentity(page,'Two','4.3');await expect(page.locator('#newFundError')).toContainText('jo tällä tilillä');
 await page.locator('#newFundCancel').click();
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings,KEY)).toEqual(holdings);
});
for(const status of [429,503])test(`source HTTP ${status} gives usable manual fallback without implicit identity`,async({page})=>{
 await page.route('https://**/*',r=>r.fulfill({status,body:'unavailable'}));await page.goto('/');await page.getByRole('button',{name:'+ Lisää rahasto'}).click();
 await page.locator('#newFundQuery').fill(candidate.isin);await page.locator('#newFundSearch').click();
 await expect(page.locator('#newFundSearchStatus')).toContainText('HTTP '+status);
 await page.locator('#newFundWithoutIsin').click();await expect(page.locator('#newFundIsin')).toHaveValue('');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
test('pending search cannot write a stale selection into a closed or reopened review',async({page})=>{
 let finish;const ready=new Promise(resolve=>finish=resolve);
 await page.route('**/v1/search?**',async r=>{await ready;await r.fulfill({json:{candidates:[candidate]}}).catch(()=>{});});
 await page.goto('/');await page.getByRole('button',{name:'+ Lisää rahasto'}).click();await page.locator('#newFundQuery').fill('Fictional');await page.locator('#newFundSearch').click();
 await page.locator('#newFundCancel').click();await page.getByRole('button',{name:'+ Lisää rahasto'}).click();finish();
 await expect(page.locator('#newFundIsin')).toHaveValue('');await expect(page.locator('#newFundCandidates')).toBeEmpty();
});

test('candidate share-class change blocks commit even with all checkboxes selected',async({page})=>{
 await page.route('https://**/*',r=>r.fulfill({json:r.request().url().includes('/v1/search')?{candidates:[candidate]}:{}}));
 await page.goto('/');await page.getByRole('button',{name:'+ Lisää rahasto'}).click();
 await page.locator('#newFundQuery').fill(candidate.isin);await page.locator('#newFundSearch').click();await page.getByRole('button',{name:'Valitse '+candidate.name}).click();
 for(const [id,value] of Object.entries({Class:'A',Broker:'Synthetic',Account:'One',Quantity:'.37',Cost:'80',Nav:'100',Date:'2026-11-05',Source:'Synthetic source'}))await page.locator('#newFund'+id).fill(value);
 await page.locator('#newFundIdentityConfirmed').check();await page.locator('#newFundSourceConfirmed').check();await page.locator('#newFundConfirm').check();await page.getByRole('button',{name:'Vahvista ja lisää rahasto',exact:true}).click();
 await expect(page.locator('#newFundError')).toContainText('tunnistetiedot muuttuivat');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).holdings.length,KEY)).toBe(0);
});
