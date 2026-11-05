import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRahastoraporttiPublicSource} from '../workers/providers/rahastoraportti-public.mjs';
import {createFundNavAdapter} from '../workers/providers/fund-nav-contract.mjs';
const isin='IE00B03HD191',other='SE0013801453';
const now=Date.parse('2026-11-05T10:00:00Z');
const row=(date='20261022',id=isin)=>({ISIN:id,currency:'EUR',closePrice:'100',closePriceDate:date,companyNameFi:'Synthetic test B'});
const source=rows=>createRahastoraporttiPublicSource({now:()=>now,fetchImpl:async()=>new Response(JSON.stringify(rows))});
test('fourteen calendar days is stale, with evidence retained and not a fresh candidate',async()=>{
 const s=source([row()]);const r=await s.getNavResult({isin});
 assert.equal(r.status,'stale_nav');assert.equal(r.ageDays,14);assert.equal(r.feedNewestDate,'2026-10-22');assert.equal(r.sourceFeedStale,true);assert.equal(r.observation.price,100);assert.equal(r.observation.requiresManualReview,true);
 const a=await createFundNavAdapter({source:s,now:()=>now}).quote({type:'fund',isin,currency:'EUR'});
 assert.equal(a.status,'unavailable');assert.equal(a.reason,'stale_nav');assert.equal(a.diagnostics.ageDays,14);
});
test('fresh, eight days, newer feed with old instrument, no binding and missing distinct',async()=>{
 assert.equal((await source([row('20261105')]).getNavResult({isin})).status,'candidate');
 assert.equal((await source([row('20261028')]).getNavResult({isin})).ageDays,8);
 const r=await source([row(),row('20261105',other)]).getNavResult({isin});assert.equal(r.sourceFeedStale,false);assert.equal(r.ageDays,14);
 assert.equal((await source([row()]).getNavResult({})).status,'no_binding');
 assert.equal((await source([row()]).getNavResult({isin:other})).status,'not_found');
 assert.equal((await source([row()]).getNavResult({isin:'bogus'})).status,'invalid_identity');
});
test('429/offline retain last observation while reporting upstream failure',async()=>{
 let clock=now,fail=false;
 const s=createRahastoraporttiPublicSource({now:()=>clock,fetchImpl:async()=>fail?new Response('',{status:429}):new Response(JSON.stringify([row('20261105')]))});
 await s.getNavResult({isin});fail=true;clock+=86400001;
 const r=await s.getNavResult({isin});assert.equal(r.status,'upstream_failed');assert.equal(r.observation.price,100);assert.match(r.reason,/429/);
 const off=createRahastoraporttiPublicSource({now:()=>now,fetchImpl:async()=>{throw Error('offline')}});
 assert.equal((await off.getNavResult({isin})).status,'upstream_failed');
});
