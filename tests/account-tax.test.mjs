import {test} from 'node:test';import assert from 'node:assert/strict';
import {capitalTax,aotDividendTax,ostWithdrawal,aotSaleTax,compareScenario} from '../engine/account-tax.mjs';
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
