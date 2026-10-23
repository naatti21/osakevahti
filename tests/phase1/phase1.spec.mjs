import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {KEY,legacyFund,newFund,ocrFund} from './fixtures.mjs';
import {setup,stored,settings,importImage,chooseNew,commitFund,refresh,quote} from './helpers.mjs';
test.use({viewport:{width:393,height:851}});
for(const name of ['Storebrand Japan A EUR','Cedar Aurora Japan A EUR'])test('unknown fund import is explicit and repeated update does not duplicate: '+name,async({page})=>{
 await setup(page,{ocr:ocrFund(name)});const before=await stored(page);await importImage(page,name);expect(await stored(page)).toEqual(before);
 await chooseNew(page,name);expect(await stored(page)).toEqual(before);await commitFund(page);
 let rows=await stored(page);expect(rows).toHaveLength(2);const created=rows.find(h=>h.name===name);expect(created).toMatchObject({quantity:.37,buyPrice:101.25,symbol:'',assetType:'fund'});expect(created.instrument.isin).toBe('');expect(created.currentPrice).toBeUndefined();expect(rows.find(h=>h.id===legacyFund.id)).toEqual(before[0]);
 await importImage(page,name);await page.locator('#fundTarget0').selectOption(created.id);await page.locator('#fundQty0').fill('0,52');await commitFund(page);
 rows=await stored(page);expect(rows).toHaveLength(2);expect(rows.find(h=>h.id===created.id)).toMatchObject({quantity:.52,buyPrice:101.25});expect(rows.find(h=>h.id===legacyFund.id)).toEqual(before[0]);
});
test('same fund name on two accounts requires selection and updates only chosen position',async({page})=>{
 const a=newFund(),b={...a,id:'SYNTHETIC-SECOND',account:'Nordnet / Rahastotili / Test C',accountLabel:'Test C',quantity:7.5};await setup(page,{holdings:[a,b]});await importImage(page);await expect(page.locator('#fundTarget0')).toHaveValue('');await expect(page.locator('.fundMatchAmbiguous')).toBeVisible();await page.locator('#fundTarget0').selectOption(b.id);await commitFund(page);const rows=await stored(page);expect(rows).toHaveLength(2);expect(rows[0].quantity).toBe(.37);expect(rows[1].quantity).toBe(.37);expect(rows[0].account).not.toBe(rows[1].account);
});
test('legacy acquisition cost edit preserves quantity NAV and all other positions',async({page})=>{
 await setup(page,{holdings:[legacyFund,newFund()]});const before=await stored(page);await page.locator('#holdings .item').first().click();await page.locator('#buy').fill('123.45');await page.locator('#form button[type="submit"]').click();const after=await stored(page);expect(after[0]).toMatchObject({buyPrice:123.45,quantity:4.3,currentPrice:143.75,navDate:'2026-10-22',quoteTimestamp:legacyFund.quoteTimestamp});expect(after[1]).toEqual(before[1]);
});
for(const mode of ['missing','invalid','currency','stale','yearless','http503'])test('refresh preserves last validated quote on '+mode,async({page})=>{
 const q=mode==='missing'?{}:{[legacyFund.symbol]:quote(mode==='invalid'?{price:-10}:mode==='currency'?{currency:'USD'}:mode==='stale'?{nav_date:'2026-10-01'}:mode==='yearless'?{nav_date:'23.10.'}:{})};await setup(page,{quotes:q,httpStatus:mode==='http503'?503:200});await refresh(page);const h=(await stored(page))[0];expect(h).toMatchObject({quantity:4.3,buyPrice:121.25,currentPrice:143.75,navDate:'2026-10-22',quoteTimestamp:legacyFund.quoteTimestamp});expect(h.quoteHealth.status).toBe('failed');
});
test('missing NAV stays unpriced without borrowing acquisition cost',async({page})=>{
 await setup(page,{holdings:[newFund()]});await refresh(page);const h=(await stored(page))[0];expect(h.currentPrice).toBeUndefined();await expect(page.locator('#valuationWarning')).toBeVisible();await expect(page.locator('#portfolioValue')).toHaveText('—');
});
test('yearless NAV never acquires the fetch year or a verified quote timestamp',async({page})=>{
 const h={...legacyFund,currentPrice:undefined,navDate:undefined,quoteTimestamp:undefined};await setup(page,{holdings:[h],quotes:{[h.symbol]:quote({nav_date:'23.10.'})}});await refresh(page);expect((await stored(page))[0]).toMatchObject({navDate:'23.10.',quoteTimestamp:0,quoteHealth:{status:'unverified-nav-day'}});
});
for(const mode of ['yearless','stale'])test('uncertain NAV must label aggregate valuation as incomplete or estimated: '+mode,async({page})=>{
 const h={...legacyFund,navDate:mode==='yearless'?'23.10.':'2026-09-01',quoteTimestamp:0};await setup(page,{holdings:[h]});await expect(page.locator('#priceHealthNotice')).toBeVisible();const total=await page.locator('#portfolioValue').innerText();const warning=await page.locator('#valuationWarning').isVisible();expect(warning||total==='—'||total.startsWith('≈'),'aggregate must not silently appear exact when NAV date is unverified/stale').toBe(true);
});
test('different share class cannot bind to A EUR NAV using name overlap',async({page})=>{
 await setup(page,{holdings:[newFund('Storebrand Japan B EUR')]});await page.locator('#holdings .item').click();await page.locator('#fundPriceSource').selectOption('STOREBRAND_JAPAN_A_EUR');await page.locator('#form button[type="submit"]').click();expect((await stored(page))[0].fundQuoteKey||'').toBe('');
});
test('feed currency mismatch is rejected even for matching fund key',async({page})=>{
 await setup(page,{quotes:{[legacyFund.symbol]:quote({currency:'SEK'})}});await refresh(page);expect((await stored(page))[0].currentPrice).toBe(143.75);
});
test('backup export restore retains account source binding and quote evidence',async({page})=>{
 await setup(page,{holdings:[{...legacyFund,fundQuoteKey:legacyFund.symbol},newFund()]});await settings(page);await page.getByText('Varmuuskopio',{exact:true}).click();const before=await stored(page);const download=page.waitForEvent('download');await page.locator('#exportBtn').click();const file=await download;const data=JSON.parse(await readFile(await file.path(),'utf8'));expect(data.apiKey).toBeUndefined();expect(data.holdings).toEqual(before);
 await page.locator('#importBackup').setInputFiles({name:'synthetic-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.reload();expect(await stored(page)).toEqual(before);
});
test('legacy migration is idempotent and preserves raw account identity',async({page})=>{
 const h={...legacyFund,account:'Nordnet',accountType:undefined,broker:undefined,accountDetailsConfirmed:undefined};await setup(page,{holdings:[h]});const result=await page.evaluate(()=>{const a=structuredClone(state);migrateState(a);const b=structuredClone(a);migrateState(b);return {a,b};});expect(result.b).toEqual(result.a);expect(result.a.holdings[0]).toMatchObject({account:'Nordnet',legacyAccount:'Nordnet',quantity:4.3,buyPrice:121.25,accountDetailsConfirmed:false});
});
for(const mode of ['negative-quantity','invalid-currency'])test('invalid backup must preserve existing data atomically: '+mode,async({page})=>{
 await setup(page);await settings(page);const before=await stored(page),bad={...newFund(),...(mode==='negative-quantity'?{quantity:-1}:mode==='invalid-currency'?{currency:'NOT-A-CURRENCY'}:{id:undefined})};await page.locator('#importBackup').setInputFiles({name:'synthetic-invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({holdings:[bad]}))});await page.waitForFunction(()=>document.getElementById('importBackup').value==='');expect(await stored(page)).toEqual(before);
});
test('storage quota failure during fund commit leaves persisted and in-memory holdings intact',async({page})=>{
 await setup(page);await importImage(page);await chooseNew(page,'Cedar Aurora Japan A EUR');const before=await stored(page);await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Synthetic quota failure','QuotaExceededError');};});await commitFund(page);expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>state.holdings)).toEqual(before);await expect(page.locator('#fundTrialStatus')).toContainText('Tallennus epäonnistui');
});
for(const width of [320,360,393])test('mobile tabs remain visible tappable and within viewport '+width,async({page},info)=>{
 await page.setViewportSize({width,height:800});await setup(page,{holdings:[legacyFund,newFund('A very long fictional international fund name A EUR')]});for(const view of ['riskView','newsView','settingsView','portfolioView']){const nav=page.locator('.nav[data-view="'+view+'"]');await nav.click();const g=await nav.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,hit:el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});expect(g.scroll).toBeLessThanOrEqual(width);expect(g.bottom).toBeLessThanOrEqual(g.height);expect(g.x).toBeGreaterThanOrEqual(0);expect(g.right).toBeLessThanOrEqual(width);expect(g.hit).toBe(true);}await page.screenshot({path:info.outputPath('mobile.png'),fullPage:true});
});

test('CSV unknown fund is reviewed and repeated same-account import updates rather than duplicates',async({page})=>{
 const h=newFund();await setup(page,{holdings:[h]});const before=await stored(page);await settings(page);await page.locator('#portfolioImportBox > summary').click();
 const csv='name;quantity;currency;account;asset_type\n'+h.name+';0,52;EUR;'+h.account+';fund';await page.locator('#importCsv').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(page.locator('#importReviewDlg')).toBeVisible();await expect(page.locator('[data-unverified="1"]')).toHaveCount(1);expect(await stored(page)).toEqual(before);await page.locator('[data-unverified="1"]').click();await expect(page.locator('#confirmImportReview')).toBeEnabled();await page.locator('#confirmImportReview').click();const after=await stored(page);expect(after).toHaveLength(1);expect(after[0]).toMatchObject({id:h.id,quantity:.52,buyPrice:h.buyPrice,account:h.account,symbol:''});expect(after[0].currentPrice).toBeUndefined();
});
test('quote refresh must reject a conflicting instrument identity in a same-key feed record',async({page})=>{
 await setup(page,{quotes:{[legacyFund.symbol]:quote({name:'Different Fictional Fund Class B',isin:'SYNTHETIC-CONFLICTING-ID',currency:'EUR'})}});await refresh(page);expect((await stored(page))[0].currentPrice).toBe(143.75);
});

test('legacy backup without position ID must be rejected or acquire a stable unique internal ID',async({page})=>{
 await setup(page);await settings(page);const before=await stored(page),legacy={...newFund(),id:undefined};await page.locator('#importBackup').setInputFiles({name:'synthetic-no-id.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({holdings:[legacy]}))});await page.waitForFunction(()=>document.getElementById('importBackup').value==='');const after=await stored(page);if(JSON.stringify(after)===JSON.stringify(before))return;expect(after).toHaveLength(1);expect(typeof after[0].id).toBe('string');expect(after[0].id.length).toBeGreaterThan(0);const id=after[0].id;await page.reload();expect((await stored(page))[0]).toMatchObject({id,quantity:.37,buyPrice:101.25});
});
