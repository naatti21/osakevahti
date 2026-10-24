import {test,expect} from '@playwright/test';
import {setup,stored,quote,refresh} from './helpers.mjs';
import {legacyFund,newFund} from './fixtures.mjs';
for(const fields of [{name:'Other Fictional Fund A EUR'},{isin:'FI0000000000'},{symbol:'OTHER_KEY'},{instrument:{currency:'USD'}},{shareClass:'B'}])test('same quote key cannot override contradictory metadata '+JSON.stringify(fields),async({page})=>{
 await setup(page,{quotes:{[legacyFund.symbol]:quote(fields)}});await refresh(page);expect((await stored(page))[0]).toMatchObject({currentPrice:143.75,navDate:'2026-10-22',quantity:4.3,buyPrice:121.25,quoteHealth:{status:'failed'}});
});
test('matching explicit metadata and existing binding can refresh',async({page})=>{
 await setup(page,{holdings:[{...legacyFund,isin:'FI0000000000'}],quotes:{[legacyFund.symbol]:quote({name:legacyFund.name,isin:'FI0000000000',symbol:legacyFund.symbol})}});await refresh(page);expect((await stored(page))[0].currentPrice).toBe(155.25);
});
test('unchanged binding does not allow a share class rename',async({page})=>{
 const h={...newFund('Storebrand Japan A EUR'),fundQuoteKey:'STOREBRAND_JAPAN_A_EUR'};await setup(page,{holdings:[h]});await page.locator('#holdings .item').click();await page.locator('#name').fill('Storebrand Japan B EUR');await page.locator('#form button[type="submit"]').click();expect((await stored(page))[0].name).toBe(h.name);
});
for(const [key,name] of [['NORDNET_EUROOPPA_INDEKSI','Nordnet – Eurooppa Indeksi (EUR)'],['NORDEA_POHJOISMAAT_SELECT_A','Nordea Pohjoismaat Indeksi Select A (EUR)'],['HANDELSBANKEN_USA_INDEKSI','Handelsbanken USA-Indeksi EUR'],['STOREBRAND_JAPAN_A_EUR','Storebrand Japan A']])test('catalog spelling alias retains full class and currency: '+name,async({page})=>{
 await setup(page,{holdings:[newFund(name)]});await page.locator('#holdings .item').click();await page.locator('#fundPriceSource').selectOption(key);await page.locator('#form button[type="submit"]').click();expect((await stored(page))[0].fundQuoteKey).toBe(key);
});
test('unknown legacy key is compatibility only, never identity verification',async({page})=>{
 const h={...legacyFund,symbol:'SYNTHETIC_UNKNOWN',name:'Unregistered Fictional Fund'};await setup(page,{holdings:[h],quotes:{[h.symbol]:quote()}});expect(await page.evaluate(()=>fundBindingMatches(state.holdings[0],state.holdings[0].symbol))).toBe(false);expect((await stored(page))[0].quoteIdentity.status).toBe('unverified-source');
});
