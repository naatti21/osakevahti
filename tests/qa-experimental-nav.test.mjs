import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('index.html','utf8');
const start=s.indexOf('function experimentalNavEnabled(h){');
const end=s.indexOf('function priceIssue(h){',start);
assert.ok(start>0&&end>start);
const helpers=s.slice(start,end);
const context={normalizedIdText:x=>String(x??'').trim().toUpperCase(),
 validImportIsin:x=>x==='IE00B03HD191',verifiedNavDate:x=>/^\\d{4}-\\d{2}-\\d{2}$/.test(String(x)),
 fundNavDateInfo:x=>({date:x,days:1,assumedYear:false}),
 FUND_NAV_MAX_AGE_DAYS:7,
 validPositive:x=>typeof x==='number'&&Number.isFinite(x)&&x>0};
vm.createContext(context);vm.runInContext(helpers,context);
function holding(){return {
 assetType:'fund',quoteSource:'MANUAL_NAV',experimentalAutoNav:true,
 instrument:{isin:'IE00B03HD191',shareClass:'A',identification:'user-confirmed'},
 currency:'EUR',manualPrice:102,navDate:'2026-11-04',
 sourceBinding:{mode:'manual',automatic:false,isin:'IE00B03HD191',currency:'EUR',shareClass:'A'},
 quoteObservation:{sourceKind:'manual',price:102,currency:'EUR',navDate:'2026-11-04'},
 experimentalNavObservation:{sourceId:'rahastoraportti-public-experiment',
 isin:'IE00B03HD191',currency:'EUR',price:103.5,navDate:'2026-11-05'}
};}
test('explicit opt-in overlays a dated NAV without mutating manual facts',()=>{
 const h=holding();assert.equal(context.experimentalNavEnabled(h),true);
 assert.equal(context.effectiveHoldingPrice(h),103.5);
 assert.equal(h.manualPrice,102);assert.equal(h.navDate,'2026-11-04');
 assert.equal(h.quoteObservation.price,102);assert.equal(h.quoteSource,'MANUAL_NAV');
});
test('opt out / wrong ISIN / wrong currency or class never overlays',()=>{
 for(const edit of [h=>h.experimentalAutoNav=false,h=>h.instrument.isin='IE00B03HD192',
 h=>h.instrument.shareClass='B',h=>h.experimentalNavObservation.currency='USD',
 h=>h.experimentalNavObservation.isin='IE00B03HD192',
 h=>h.experimentalNavObservation.sourceId='untrusted',
 h=>h.experimentalNavObservation.price=-3,
 h=>h.experimentalNavObservation.navDate='2026-11-01']){
  const h=holding();edit(h);assert.equal(context.usableExperimentalNav(h),null);
  assert.equal(context.effectiveHoldingPrice(h),102);
 }
});
test('stale NAV returns to manual quote, never a false fresh value',()=>{
 const h=holding();context.fundNavDateInfo=()=>({date:'2026-11-05',days:14,assumedYear:false});
 assert.equal(context.effectiveHoldingPrice(h),102);
});
test('UI has a reversible manual-NAV opt in and no unreviewed publication claim',()=>{
 assert.ok(s.includes('id="newFundAutoNav"'));assert.ok(s.includes('id="newFundAutoNavProbe"'));
 assert.ok(s.includes('KOKEILU-NAV'));assert.ok(s.includes('sourceId:"rahastoraportti-public-experiment"'));
 assert.ok(s.includes('if(wantsAuto)refreshMarket(false)'));
 assert.ok(s.includes('h.experimentalNavObservation'));
});
