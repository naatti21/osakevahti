import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateRegistry} from '../engine/listing-registry.mjs';
const now=Date.parse('2026-11-07'),policy={reviewed:true,monthlyCost:0,automatedUse:true,redistribution:true,source:'synthetic',termsUrl:'https://example.org/terms'};
const row={symbol:'NEWCO',mic:'XNAS',country:'US',currency:'USD',instrumentType:'stock',name:'Fictional new company',source:'synthetic',listUpdatedAt:'2026-11-06',active:true};
const run=(listings,p=policy)=>validateRegistry({schemaVersion:1,source:'synthetic',listings},p,now);
test('data additions and removals require no company code changes',()=>{assert.equal(run([row]).listings.length,1);assert.equal(run([{...row,active:false}]).listings.length,0);assert.equal(run([{...row,symbol:'OTHER'}]).listings[0].symbol,'OTHER');});
test('unknown permission, duplicates, ETF, stale and conflicting currency fail closed',()=>{
 assert.equal(run([row],{}).status,'unavailable');assert.equal(run([row,row]).status,'unavailable');
 for(const patch of [{instrumentType:'ETF'},{currency:'EUR'},{listUpdatedAt:'2020-01-01'},{mic:'OTC'}])assert.equal(run([{...row,...patch}]).status,'unavailable');
});
