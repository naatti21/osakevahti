import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareManualFund,validManualNav,validateManualFundBackup} from '../engine/manual-fund.mjs';
const now=Date.parse('2026-11-05T10:00:00Z');
const input={name:'Fictional Unlisted B',shareClass:'B',broker:'Synthetic',accountLabel:'First',currency:'EUR',quantity:'2.5',buyPrice:'80',nav:'100',navDate:'2026-10-22',sourceDescription:'Synthetic statement',confirmed:true};
const opts={id:'position-1',now,supportedCurrency:c=>['EUR','USD','CHF','JPY','CAD'].includes(c)};
test('name-only position preserves cost, manual provenance and unverified identity',()=>{
 const h=prepareManualFund(input,[],opts);assert.equal(h.symbol,'');assert.equal(h.instrument.isin,'');assert.equal(h.instrument.identification,'unverified');assert.equal(h.sourceBinding,null);assert.equal(h.buyPrice,80);assert.equal(h.manualPrice,100);validateManualFundBackup(h,now);
});
test('duplicate account blocked, separate account accepted, existing position edit permitted',()=>{
 const h=prepareManualFund(input,[],opts);
 assert.throws(()=>prepareManualFund(input,[h],{...opts,id:'second'}),/jo tällä tilillä/);
 assert.equal(prepareManualFund({...input,accountLabel:'Second'},[h],{...opts,id:'second'}).quantity,2.5);
 assert.equal(prepareManualFund({...input,buyPrice:'90'},[h],opts).buyPrice,90);
});
test('unconfirmed, invalid, yearless, future and contradictory manual NAV rejected',()=>{
 for(const over of [{confirmed:false},{quantity:''},{quantity:'-1'},{buyPrice:''},{nav:'0'},{navDate:'22.10.'},{navDate:'2026-02-30'},{navDate:'2026-11-06'},{sourceDescription:''},{currency:'ZZZ'}])assert.throws(()=>prepareManualFund({...input,...over},[],opts));
 const h=prepareManualFund(input,[],opts);
 for(const over of [{currency:'USD'},{manualPrice:101},{currentPrice:102},{navDate:'2026-11-01'}])assert.throws(()=>validateManualFundBackup({...h,...over},now));
});
test('fresh, eight-day and fourteen-day observations retain real date and price',()=>{
 for(const date of ['2026-11-05','2026-10-28','2026-10-22']){const h=prepareManualFund({...input,navDate:date},[],opts);assert.equal(h.navDate,date);assert.equal(validManualNav(h.quoteObservation,now),true);}
});
