import {test,expect} from '@playwright/test';
import {setup,stored,settings} from './helpers.mjs';
import {newFund} from './fixtures.mjs';
for(const source of ['csv','ocr'])test(source+' commit quota failure is atomic and retryable',async({page})=>{
 const h=newFund();await setup(page,{holdings:[h]});const before=await stored(page);
 await page.evaluate(({h,source})=>{const incoming=structuredClone(h);incoming.quantity=.52;incoming.importMeta={source,provided:{quantity:true}};incoming.instrument={...h.instrument,identification:'unverified'};pendingImport={rows:[{holding:incoming,ready:true}]};}, {h:before[0],source});
 // Exercise the shared final commit boundary; source-specific previews are covered by existing UI tests.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Synthetic quota','QuotaExceededError')};});
 await page.evaluate(()=>{try{commitPendingImport()}catch(e){window.commitFailure=e.name}});expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>state.holdings)).toEqual(before);expect(await page.evaluate(()=>!!pendingImport)).toBe(true);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;commitPendingImport()});expect((await stored(page))[0].quantity).toBe(.52);expect(await page.evaluate(()=>pendingImport)).toBeNull();
});
for(const currency of ['EUR','USD','SEK','NOK','GBP','CHF','JPY','CAD'])test('restore preserves legitimate currency and account '+currency,async({page})=>{
 await setup(page);await settings(page);const h={...newFund(),currency,broker:'Synthetic broker',accountLabel:'Legacy account'};
 await page.locator('#importBackup').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({holdings:[h]}))});await page.waitForFunction(()=>document.querySelector('#importBackup').value==='');expect((await stored(page))[0]).toMatchObject(h);
});
test('backup quota failure leaves memory and storage unchanged',async({page})=>{
 await setup(page);await settings(page);const before=await stored(page);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Synthetic quota','QuotaExceededError')}});
 await page.locator('#importBackup').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({holdings:[newFund()]}))});await page.waitForFunction(()=>document.querySelector('#importBackup').value==='');expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>state.holdings)).toEqual(before);
});
test('invalid final import cannot change either portfolio representation',async({page})=>{
 await setup(page);const before=await stored(page);await page.evaluate(()=>{pendingImport={rows:[{ready:true,holding:{...structuredClone(state.holdings[0]),quantity:-3}}]};commitPendingImport()});expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>state.holdings)).toEqual(before);
});
for(const currency of ['CHF','JPY','CAD','ZZZ'])test('currency validation without Intl.supportedValuesOf: '+currency,async({page})=>{
 await page.addInitScript(()=>{Intl.supportedValuesOf=undefined;window.structuredClone=undefined});await setup(page);await settings(page);const before=await stored(page);const h={...newFund(),currency};await page.locator('#importBackup').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({holdings:[h]}))});await page.waitForFunction(()=>document.querySelector('#importBackup').value==='');expect(await stored(page)).toEqual(currency==='ZZZ'?before:[expect.objectContaining(h)]);
});
test('incomplete legacy currency remains repairable and does not block unrelated imports',async({page})=>{
 await setup(page);await settings(page);const legacy={...newFund('Legacy fictional fund'),id:undefined,currency:undefined};await page.locator('#importBackup').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({holdings:[legacy]}))});await page.waitForFunction(()=>document.querySelector('#importBackup').value==='');const restored=await stored(page);expect(restored).toHaveLength(1);expect(restored[0].name).toBe(legacy.name);expect(restored[0].currency).toBeUndefined();expect(restored[0].instrument.currency).toBe('');expect(restored[0].id).toBeTruthy();
 await page.evaluate(h=>{pendingImport={rows:[{ready:true,holding:h}]};commitPendingImport()},newFund());expect(await stored(page)).toHaveLength(2);expect((await stored(page))[0]).toEqual(restored[0]);
 await page.locator('[data-view="portfolioView"]').click();await page.locator('#holdings .item').first().click();await expect(page.locator('#currency')).toHaveValue('');await page.locator('#currency').selectOption('EUR');await page.locator('#form button[type="submit"]').click();const fixed=(await stored(page))[0];expect(fixed).toMatchObject({id:restored[0].id,currency:'EUR',quantity:legacy.quantity,buyPrice:legacy.buyPrice});
});
