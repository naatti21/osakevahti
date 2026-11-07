import {test} from 'node:test';import assert from 'node:assert/strict';
import {capitalTax,aotDividendTax,ostWithdrawal,aotSaleTax,compareScenario,localAccountPlacement} from '../engine/account-tax.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('AOT 85% taxable, both rates and crossing threshold',()=>{near(aotDividendTax(1000),255);near(aotDividendTax(1000,30000),289);near(capitalTax(2000,29000),640);});
test('OST whole-account gain ratio and withdrawal basis; no permanent tax exemption',()=>{
 const r=ostWithdrawal({value:15000,depositBasis:10000,withdrawal:3000,rate:.3});near(r.taxable,1000);near(r.tax,300);near(r.remainingDepositBasis,8000);
 const loss=ostWithdrawal({value:5000,depositBasis:10000,withdrawal:1000,rate:.3});near(loss.tax,0);near(loss.remainingDepositBasis,9000);
});
test('AOT allowance by individual lot age; losses are not automatic refunds',()=>{near(aotSaleTax({proceeds:10000,cost:1000,years:10,rate:.3}).tax,1800);near(aotSaleTax({proceeds:10000,cost:1000,years:9,rate:.3}).tax,2400);near(aotSaleTax({proceeds:900,cost:1000,years:10,rate:.3}).tax,0);});
test('zero-return scenario preserves capital and no false winner',()=>{const r=compareScenario({principal:1000,years:5,dividendYield:0,priceGrowth:0,reinvest:true,rate:.3});near(r.aot,1000);near(r.ost,1000);assert.equal(r.recommendation,'Tieto ei riitä');});
test('reinvestment grows AOT cost basis but never OST deposits',()=>{
 const r=compareScenario({principal:1000,years:3,dividendYield:.1,priceGrowth:0,reinvest:true,rate:.3});near(r.aot,1000*1.0745**3);near(r.aotSaleTax,0);near(r.ost,1000+(1000*1.1**3-1000)*.7);
});
test('withdrawn dividends use the OST account ratio, then final liquidation taxed',()=>{const r=compareScenario({principal:1000,years:3,dividendYield:.1,priceGrowth:0,reinvest:false,rate:.3});near(r.aot,1223.5);near(r.ost,1210);near(r.ostTax,90);});
test('invalid, missing and invented numeric inputs rejected',()=>{for(const principal of [NaN,-1,Infinity,100001,'1000'])assert.throws(()=>compareScenario({principal,years:3,dividendYield:.05,priceGrowth:0,reinvest:true,rate:.3}));assert.throws(()=>ostWithdrawal({value:100,depositBasis:100,withdrawal:101,rate:.3}));});


test('confirmed OST/AOT exposure stays local and unknown accounts never count as confirmed',()=>{
 const now=Date.now();
 const h=(symbol,accountType,quantity,currentPrice,confirmed=true)=>({symbol,accountType,quantity,currentPrice,
  currency:'EUR',accountDetailsConfirmed:confirmed,quoteTimestamp:now});
 const r=localAccountPlacement({listing:'TEST.HE',investmentEur:200,holdings:[
  h('TEST.HE','OST',10,100),h('OTHER.HE','AOT',5,200),h('TEST.HE','OST',100,100,false)]});
 assert.equal(r.unconfirmed,1);assert.equal(r.status,'partial');
 near(r.accounts.OST.value,1000);near(r.accounts.AOT.value,1000);
 near(r.accounts.OST.newListingWeightPct,100);near(r.accounts.AOT.newListingWeightPct,200/1200*100);
 assert.equal(r.recommendation,'Tieto ei riitä');
});
test('missing prices or unverified FX make account exposure unavailable, not zero',()=>{
 const r=localAccountPlacement({listing:'TEST.HE',investmentEur:200,holdings:[
  {accountType:'OST',accountDetailsConfirmed:true,assetType:'stock',symbol:'TEST.HE',quantity:1,currency:'EUR'},
  {accountType:'AOT',accountDetailsConfirmed:true,symbol:'US',quantity:1,currentPrice:150,currency:'USD',fxRate:1}]});
 assert.equal(r.accounts.OST.missing,1);assert.equal(r.accounts.AOT.missing,1);
 assert.equal(r.accounts.OST.newListingWeightPct,null);assert.equal(r.accounts.AOT.newListingWeightPct,null);
 assert.equal(localAccountPlacement({listing:'<script>',investmentEur:200,holdings:[]}).status,'unavailable');
});
test('exact listing only: different ticker or guessed alias is not same issuer',()=>{
 const r=localAccountPlacement({listing:'XYZ.HE',investmentEur:50,holdings:[
  {accountType:'OST',accountDetailsConfirmed:true,symbol:'XYZ',quantity:10,currentPrice:10,currency:'EUR',quoteTimestamp:Date.now()}]});
 near(r.accounts.OST.newListingWeightPct,50/150*100);
});
