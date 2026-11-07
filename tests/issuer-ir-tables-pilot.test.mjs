import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIssuerIrTables,combineIrReports} from '../engine/issuer-ir-tables-pilot.mjs';
const url='https://www.microsoft.com/investor/reports/ar25/';
const body=(cash=300,short=true)=>'<html>'+
'<table><tr><th>Year Ended June 30,</th><th>2025</th><th>2024</th><th>2023</th></tr>'+
'<tr><td>Total revenue</td><td>100</td><td>90</td><td>80</td></tr>'+
'<tr><td>Net income</td><td>10</td><td>9</td><td>8</td></tr></table>'+
'<table><tr><th>Year Ended June 30,</th><th>2025</th><th>2024</th><th>2023</th></tr>'+
'<tr><td>Net cash from operations</td><td>'+cash+'</td><td>200</td><td>100</td></tr></table>'+
'<table><tr><th>June 30,</th><th>2025</th><th>2024</th></tr>'+
'<tr><td>Total assets</td><td>1000</td><td>900</td></tr>'+
'<tr><td>Current portion of long-term debt</td><td>20</td><td>19</td></tr>'+
'<tr><td>Long-term debt</td><td>80</td><td>70</td></tr>'+
(short?'<tr><td>Short-term debt</td><td>0</td><td>10</td></tr>':'')+
'<tr><td>Total liabilities</td><td>600</td><td>500</td></tr></table></html>';
test('generic issuer IR tables read three fiscal-year income/cashflow and two year-end debt balances',()=>{
 const r=normalizeIssuerIrTables(body(),{sourceUrl:url,reportYear:2025});
 assert.equal(r.years[2025].revenue.value,100000000);
 assert.equal(r.years[2024].netIncome.value,9000000);
 assert.equal(r.years[2023].operatingCashflow.value,100000000);
 assert.equal(r.years[2025].interestBearingDebt.value,100000000);
 assert.equal(r.years[2024].interestBearingDebt.value,99000000);
 assert.equal(r.years[2023].interestBearingDebt.status,'missing');
});
test('unreported short-term borrowing cannot be assumed zero',()=>{
 const r=normalizeIssuerIrTables(body(300,false),{sourceUrl:url,reportYear:2025});
 assert.equal(r.years[2025].interestBearingDebt.status,'missing');
 assert.equal(r.years[2025].interestBearingDebt.knownLongTermAndCurrentPortion,100000000);
});
test('multiple contradictory annual reports produce restatement conflict, not silent overwrite',()=>{
 const a=normalizeIssuerIrTables(body(300),{sourceUrl:url,reportYear:2025});
 const b=normalizeIssuerIrTables(body(301),{sourceUrl:url,reportYear:2024});
 const c=combineIrReports([a,b]);
 assert.equal(c.years[2025].operatingCashflow.status,'conflict');
 assert.equal(c.years[2025].revenue.status,'ok');
});
