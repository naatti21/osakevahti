import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchFundCandidates,bindingEligibility,validateFundReviewBackup} from '../engine/fund-review.mjs';
import {prepareManualFund,validateManualFundBackup} from '../engine/manual-fund.mjs';
const c={type:'fund',name:'Fictional Aurora B EUR',isin:'IE00B03HD191',currency:'EUR',shareClass:'B',provider:'issuer-public-nav'};
const input={name:c.name,isin:c.isin,shareClass:'B',currency:'EUR',broker:'Synthetic',accountLabel:'One',quantity:'.37',buyPrice:'80',nav:'100',navDate:'2026-11-05',sourceDescription:'Synthetic statement',confirmed:true,identityConfirmed:true,sourceConfirmed:true};
const opts={id:'one',now:Date.parse('2026-11-06T12:00:00Z'),supportedCurrency:x=>x==='EUR'};
test('search uses identity-only query; wrong/missing ISIN and ambiguous class rejected',async()=>{
 let calls=0;const request=async(url,options)=>{calls++;assert.equal(options.body,undefined);assert.equal(new URL(url).searchParams.size,1);return new Response(JSON.stringify({candidates:[c]}));};
 assert.equal((await searchFundCandidates(c.isin,{gatewayUrl:'https://fixture.test',fetchImpl:request}))[0].isin,c.isin);
 await assert.rejects(searchFundCandidates('IE00B03HD192',{gatewayUrl:'https://fixture.test',fetchImpl:request}),/tarkiste/);assert.equal(calls,1);
 for(const rows of [[{...c,isin:''}],[{...c,isin:'SE0013801453'}],[c,{...c,shareClass:'A'}]])assert.deepEqual(await searchFundCandidates(c.isin,{gatewayUrl:'https://fixture.test',fetchImpl:async()=>new Response(JSON.stringify({candidates:rows}))}),[]);
});
test('offline/429 never produce synthetic candidates',async()=>{
 for(const fetchImpl of [async()=>new Response('',{status:429}),async()=>{throw Error('offline')}])await assert.rejects(searchFundCandidates('Fictional',{gatewayUrl:'https://fixture.test',fetchImpl}));
});
test('source response or checkbox cannot grant usage rights; contradictory quotes cannot bind',()=>{
 const quote={provider:c.provider,currency:'EUR',price:100,navDate:'2026-11-05',sourceKind:'issuer',requiresManualReview:false,providerIdentity:{isin:c.isin,currency:'EUR',shareClass:'B',identityStatus:'issuer-or-qualified-provider-isin'}};
 assert.equal(bindingEligibility(c,quote).allowed,false);
 const sources=[{id:c.provider,role:'fund-nav',assets:['fund'],monthlyEuroCost:0,enabledByDefault:true,terms:'documented-public-free'}];
 assert.equal(bindingEligibility(c,quote,{sources}).allowed,true);
 for(const over of [{currency:'USD'},{requiresManualReview:true},{navDate:'05.11.'},{price:0},{provider:'wrong'},{providerIdentity:{...quote.providerIdentity,shareClass:'A'}},{providerIdentity:{...quote.providerIdentity,isin:'SE0013801453'}}])assert.equal(bindingEligibility(c,{...quote,...over},{sources}).allowed,false);
});
test('explicit local identity and source review never upgrades instrument to externally verified',()=>{
 const h=prepareManualFund(input,[],opts);assert.equal(h.instrument.identification,'user-confirmed');assert.equal(h.sourceBinding.automatic,false);assert.equal(h.buyPrice,80);assert.equal(h.manualPrice,100);
 for(const over of [{identityConfirmed:false},{sourceConfirmed:false},{isin:'IE00B03HD192'},{candidate:{...c,name:'Another fund'}},{candidate:{...c,currency:'USD'}},{candidate:{...c,shareClass:'A'}}])assert.throws(()=>prepareManualFund({...input,...over},[],opts));
 assert.throws(()=>prepareManualFund({...input,name:'Renamed exact same ISIN'},[h],{...opts,id:'duplicate'}),/ISIN/);
 assert.equal(prepareManualFund({...input,accountLabel:'Two',quantity:'4.3'},[h],{...opts,id:'two'}).quantity,4.3);
 validateManualFundBackup(h,opts.now);
 for(const over of [{isin:'SE0013801453'},{currency:'USD'},{shareClass:'A'},{automatic:true},{providerId:'invented'}])assert.throws(()=>validateFundReviewBackup({...h,sourceBinding:{...h.sourceBinding,...over}}));
});
