import {test} from "node:test";
import assert from "node:assert/strict";
import {navConsentForHolding,removeNavConsent,usableNavObservation,effectiveFundPrice,updateNavQuote} from "../engine/nav-consent.mjs";
const now=Date.parse("2026-11-06T10:00:00Z"),day="2026-11-05",id="SE0005993102";
const legacy=()=>({
 id:"legacy-1",assetType:"fund",name:"Nordnet Suomi Indeksi",symbol:"old_key",
 instrument:{isin:"",identification:"legacy-unverified"},quantity:0.37,
 buyPrice:200.12,currentPrice:350.01,manualPrice:349.99,
 navDate:"2026-11-02",account:"Nordnet",accountType:"FUND",
 broker:"Nordnet",currency:"EUR",fundQuoteKey:"old_key",importMeta:{source:"ocr"}
});
const c={name:"Nordnet Suomi Indeksi",isin:id,currency:"EUR",shareClass:""};
const q={status:"candidate",isin:id,currency:"EUR",price:361.67,navDate:day};
test("legacy consent does not modify any recorded position or acquisition fields",()=>{
 const a=legacy(),b=navConsentForHolding(a,c);
 for(const field of ["id","quantity","buyPrice","account","accountType","broker","currentPrice","manualPrice","navDate","fundQuoteKey","symbol","importMeta"])
  assert.deepEqual(b[field],a[field],field);
 assert.equal(b.navOptIn,true);
 assert.equal(b.navBinding.isin,id);
 assert.equal(a.navBinding,undefined);
});
test("wrong currency, existing contradictory ISIN or stock never linked",()=>{
 assert.throws(()=>navConsentForHolding({...legacy(),currency:"USD"},c),/valuutta/);
 assert.throws(()=>navConsentForHolding({...legacy(),instrument:{isin:"FI1111111111"}},c),/ristiriitainen/);
 assert.throws(()=>navConsentForHolding({...legacy(),assetType:"stock"},c),/rahasto/);
});
test("NAV overlay is explicitly opt-in and is only indicative and fresh",()=>{
 const a=navConsentForHolding(legacy(),c);
 const b=updateNavQuote(a,q,now);
 assert.equal(effectiveFundPrice(b,now),361.67);
 assert.equal(usableNavObservation(b,now).navDate,day);
 assert.equal(b.currentPrice,350.01);
 assert.equal(b.buyPrice,200.12);
 assert.equal(effectiveFundPrice(removeNavConsent(b),now),350.01);
 assert.equal(usableNavObservation(b,Date.parse("2026-11-20T10:00:00Z")),null);
});
test("invalid or contradictory data does not overwrite previous NAV",()=>{
 const a=navConsentForHolding(legacy(),c),b=updateNavQuote(a,q,now);
 for(const probe of [{...q,currency:"USD"},{...q,isin:"FI0000000000"},{...q,price:-1},{...q,navDate:"2026-11-01"}]){
  const next=updateNavQuote(b,probe,now);
  assert.equal(next.navObservation.price,361.67);
 }
});
test("suspicious NAV leap needs review and preserves fallback",()=>{
 const a=navConsentForHolding(legacy(),c);
 const x=updateNavQuote(a,{...q,price:1000},now);
 assert.equal(x.navObservation,undefined);
 assert.equal(x.navDiagnostic.reason,"large_nav_change_needs_review");
 assert.equal(effectiveFundPrice(x,now),350.01);
});
