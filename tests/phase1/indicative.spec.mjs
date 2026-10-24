import {test,expect} from '@playwright/test';
import {setup,quote,stored} from './helpers.mjs';
import {legacyFund} from './fixtures.mjs';
const funds=[{...legacyFund,id:'fund-europe',symbol:'NORDNET_EUROOPPA_INDEKSI',name:'Nordnet Eurooppa Indeksi',navDate:'22.10.',quoteTimestamp:0},{...legacyFund,id:'fund-world',symbol:'NORDNET_MAAILMA_INDEKSI_125',name:'Nordnet Maailma Indeksi 125',navDate:'22.10.',quoteTimestamp:0}];
const stocks=['AOT','OST'].map((type,i)=>({id:'stock-'+i,symbol:'SYNTH'+i,name:'Fictional Stock '+i,assetType:'stock',currency:'EUR',quantity:2,buyPrice:8,currentPrice:10,quoteTimestamp:Date.parse('2026-10-23T12:00:00Z'),account:type,accountType:type,broker:'Synthetic',accountDetailsConfirmed:true,targetWeight:15,trailingPct:12}));
test('multiple yearless Nordnet NAVs and AOT OST stocks retain labelled indicative analytics',async({page})=>{
 await setup(page,{holdings:[...funds,...stocks,{...stocks[0],id:"empty-position",quantity:0,currentPrice:undefined}],quotes:Object.fromEntries(funds.map(h=>[h.symbol,quote({nav_date:'22.10.'})]))});
 for(const id of ['portfolioValue','portfolioProfit','accountSummary','portfolioAnalysisResult','whatIfResult','riskSummary'])await expect(page.locator('#'+id)).toHaveAttribute('data-valuation-quality','verified');
 await expect(page.locator('#portfolioValue')).toHaveText(new Intl.NumberFormat('fi-FI',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(2*4.3*155.25+40));await expect(page.locator('#portfolioProfit')).not.toHaveText(/^≈ /);await expect(page.locator('#accountSummary')).toContainText('OST · vahvistettu');await expect(page.locator('#accountSummary')).toContainText('≈');
 await page.locator('#whatIfBox').evaluate(e=>e.open=true);await expect(page.locator('#whatIfHolding')).toBeEnabled();await page.locator('#whatIfAmount').fill('250');await expect(page.locator('#whatIfResult .labScenario')).toHaveCount(1);await expect(page.locator('#whatIfResult')).not.toContainText('≈');await expect(page.locator('#whatIfResult')).toContainText(new Intl.NumberFormat('fi-FI',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(2*4.3*155.25+40+250));
 await page.locator('[data-view="riskView"]').click();await expect(page.locator('#riskSummary')).not.toContainText('≈');expect(await page.locator('#risks').innerHTML()).not.toBe('');
 const saved=await stored(page);for(const h of saved.filter(h=>h.assetType==='fund')){expect(h.navDate).toBe('22.10.');expect(h.quoteTimestamp).toBe(0);expect(h.buyPrice).toBe(121.25)}
});
for(const mode of ['missing-price','contradictory-source','missing-fx'])test('unavailable '+mode+' still blocks aggregate analytics',async({page})=>{
 const h=mode==='missing-fx'?{...stocks[0],currency:'USD',fxRate:undefined}:mode==='contradictory-source'?{...funds[0],name:'Storebrand Japan B EUR',symbol:'STOREBRAND_JAPAN_A_EUR'}:{...funds[0],currentPrice:undefined};await setup(page,{holdings:[h]});
 await expect(page.locator('#portfolioValue')).toHaveText('—');await expect(page.locator('#portfolioValue')).toHaveAttribute('data-valuation-quality','unavailable');await page.locator('#whatIfBox').evaluate(e=>e.open=true);await expect(page.locator('#whatIfHolding')).toBeDisabled();await page.locator('[data-view="riskView"]').click();await expect(page.locator('#risks')).toBeEmpty();
});

test('day-month NAV alone never creates a red main-screen alarm or duplicate banners',async({page})=>{
 await setup(page,{holdings:funds,quotes:Object.fromEntries(funds.map(h=>[h.symbol,quote({nav_date:'22.10.'})]))});
 const before=await stored(page);
 await expect(page.locator('#portfolioValue')).not.toHaveText(/^≈ /);
 await expect(page.locator('#portfolioValue')).toHaveAttribute('data-valuation-quality','verified');
 await expect(page.locator('#valuationWarning')).toBeHidden();
 await expect(page.locator('#priceHealthNotice')).toBeHidden();
 await expect(page.locator('#priceHealthSummary')).not.toContainText('hintavirhe');
 await expect(page.locator('#quoteAge')).toContainText('NAV ≤7 pv 2/2');
 await expect(page.locator('#accountSummary')).not.toContainText('Viitteellinen laskelma');
 await page.locator('#detailsToggle').click();
 await expect(page.locator('#holdings')).toContainText('vuosi päätelty');
 expect(await stored(page)).toEqual(before);
});
test('real unavailability still has visible red warning, unlike benign NAV source dates',async({page})=>{
 await setup(page,{holdings:[{...funds[0],currentPrice:undefined,navDate:''}]});
 await expect(page.locator('#portfolioValue')).toHaveText('—');
 await expect(page.locator('#valuationWarning')).toBeVisible();
 await expect(page.locator('#valuationWarning')).toHaveClass(/statusBad/);
 await expect(page.locator('#valuationWarning')).toContainText('puutteellinen');
});
test('mixed yearless and other uncertain quotes retain a neutral but visible estimate note',async({page})=>{
 const stale={...stocks[0],quoteTimestamp:Date.parse('2026-10-01T12:00:00Z')};
 await setup(page,{holdings:[...funds,stale],quotes:Object.fromEntries(funds.map(h=>[h.symbol,quote({nav_date:'22.10.'})]))});
 await expect(page.locator('#portfolioValue')).toHaveText(/^≈ /);
 await expect(page.locator('#valuationWarning')).toBeVisible();
 await expect(page.locator('#valuationWarning')).toHaveClass(/muted/);
 await expect(page.locator('#valuationWarning')).not.toHaveClass(/statusBad/);
});
