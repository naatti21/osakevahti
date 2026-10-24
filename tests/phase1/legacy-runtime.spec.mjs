import {test,expect} from '@playwright/test';
import {setup,stored} from './helpers.mjs';
import {newFund} from './fixtures.mjs';
test('older runtime import keeps quota failure atomic and pending review retryable',async({page})=>{
 await page.addInitScript(()=>{Intl.supportedValuesOf=undefined;window.structuredClone=undefined});await setup(page,{holdings:[newFund()]});const before=await stored(page);
 await page.evaluate(()=>{const h=JSON.parse(JSON.stringify(state.holdings[0]));h.quantity=.75;pendingImport={rows:[{ready:true,holding:h}]};window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Synthetic quota','QuotaExceededError')};commitPendingImport()});
 expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>state.holdings)).toEqual(before);expect(await page.evaluate(()=>pendingImport.rows[0].holding.quantity)).toBe(.75);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;commitPendingImport()});expect((await stored(page))[0].quantity).toBe(.75);expect(await page.evaluate(()=>pendingImport)).toBeNull();
});
