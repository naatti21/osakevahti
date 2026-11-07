import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSourceScaledStatementHtml} from '../engine/html-statement-unit-evidence.mjs';
const url='https://example.org/report-2025';
const row=(...cells)=>'<tr>'+cells.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
const table=(...rows)=>'<table>'+rows.join('')+'</table>';
const year3=row('Years ended','2025','2024','2023');
const year2=row('As of','2025','2024');
const income=table(year3,row('Total revenue','400','300','200'),
 row('Operating income','50','40','30'),row('Net income','25','20','15'));
const cash=table(year3,row('Net income','25','20','15'),
 row('Net cash from operations','31','28','22'),
 row('Net cash from investing activities','(8)','(7)','(6)'));
const debt=table(year2,row('Total assets','999','888'),
 row('Current liabilities:'),row('Short-term debt','2','3'),
 row('Current portion of long-term debt','10','11'),row('Long-term debt','50','60'),
 row('Total liabilities','400','390'));
const wrap=({incomeHead='',cashHead='',balanceHead='',inIncome='',inCash='',inBalance=''}={})=>{
 const put=(s,cell)=>s.replace('<table>','<table>'+cell);
 return '<html>'+incomeHead+put(income,inIncome)+cashHead+put(cash,inCash)+
  balanceHead+put(debt,inBalance)+'</html>';
};
test('three statements independently prove in-table millions (Microsoft-style)',()=>{
 const html=wrap({inIncome:row('(In millions, except per share amounts)'),
  inCash:row('(In millions)'),inBalance:row('(In millions)')});
 const out=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:2025});
 assert.equal(out.years[2025].revenue.value,400000000);
 assert.equal(out.years[2025].operatingCashflow.value,31000000);
 assert.equal(out.years[2025].interestBearingDebt.value,62000000);
 assert.equal(out.years[2025].revenue.scaleEvidence.scope,'inside-statement-table');
 assert.equal(out.statementScales.balance.multiplier,1000000);
});
test('adjacent headings prove millions, thousands and dollars independently (Apple-style)',()=>{
 const html=wrap({incomeHead:'<h2>CONSOLIDATED STATEMENTS OF OPERATIONS</h2><p>(In millions, except per share amounts)</p>',
  cashHead:'<h2>CONSOLIDATED STATEMENTS OF CASH FLOWS</h2><p>(In thousands)</p>',
  balanceHead:'<h2>CONSOLIDATED BALANCE SHEETS</h2><p>(In dollars)</p>'});
 const out=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:2025});
 assert.equal(out.years[2025].revenue.value,400000000);
 assert.equal(out.years[2025].operatingCashflow.value,31000);
 assert.equal(out.years[2025].interestBearingDebt.value,62);
 assert.equal(out.years[2025].operatingCashflow.scaleEvidence.scope,'adjacent-statement-heading');
});
test('unknown scale is missing and cannot default to one million',()=>{
 const out=normalizeSourceScaledStatementHtml(wrap(),{sourceUrl:url,reportYear:2025});
 for(const m of Object.values(out.years[2025]))assert.equal(m.status,'missing');
});
test('unrelated prior table/paragraph mentioning millions is not source-scale evidence',()=>{
 const html='<p>Sensitivity analysis (In millions)</p>'+wrap();
 const out=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:2025});
 assert.equal(out.years[2025].revenue.status,'missing');
});
test('conflicting table/heading scale fails closed',()=>{
 const html=wrap({incomeHead:'<h2>INCOME STATEMENTS</h2><p>(In thousands)</p>',
  inIncome:row('(In millions)')});
 const out=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:2025});
 assert.equal(out.statementScales.income.status,'conflict');
 assert.equal(out.years[2025].revenue.status,'conflict');
});
test('a scale on cash-flow table cannot be borrowed by income or balance',()=>{
 const html=wrap({cashHead:'<h2>CONSOLIDATED STATEMENTS OF CASH FLOWS</h2><p>(In millions)</p>'});
 const out=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:2025});
 assert.equal(out.years[2025].revenue.status,'missing');
 assert.equal(out.years[2025].operatingCashflow.status,'ok');
 assert.equal(out.years[2025].interestBearingDebt.status,'missing');
});

test('derived debt retains the actual balance-sheet table index in its scale proof',()=>{
 const html=wrap({incomeHead:'<h2>INCOME STATEMENTS</h2><p>(In millions)</p>',
  cashHead:'<h2>CASH FLOWS STATEMENTS</h2><p>(In millions)</p>',
  balanceHead:'<h2>BALANCE SHEETS</h2><p>(In millions)</p>'});
 const o=normalizeSourceScaledStatementHtml(html,{sourceUrl:url,reportYear:2025});
 const debt=o.years[2025].interestBearingDebt;
 assert.equal(debt.status,'ok');
 assert.equal(debt.tableIndex,o.statementSelection.balance);
 assert.equal(debt.scaleEvidence.tableIndex,o.statementSelection.balance);
 assert.equal(debt.scaleEvidence.multiplier,1_000_000);
});
