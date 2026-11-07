// Source-local unit evidence for ordinary issuer HTML financial statements.
// Research-only: proves a table's displayed monetary scale, NOT its currency,
// entity, comparative restatement status, or independent accounting correctness.
// No company-specific IDs, titles, or scales are embedded in this parser.
import {normalizeGenericStatementHtml} from './generic-statement-tables.mjs';

const STATEMENT_HEADING={
 income:/(?:(?:consolidated\s+)?statements?\s+of\s+(?:operations|income|earnings)|income\s+statements?)/gi,
 cash:/(?:(?:consolidated\s+)?statements?\s+of\s+cash\s+flows?|cash\s+flows?\s+statements?)/gi,
 balance:/(?:(?:consolidated\s+)?balance\s+sheets?)/gi
};
const clean=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
 .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&#xA0;|&#32;/gi,' ')
 .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const multiplicity={dollars:1,thousands:1_000,millions:1_000_000,billions:1_000_000_000};
const unknown=reason=>({status:'missing',reason});
function findDeclaration(s,{atStart=false}={}){
 const rx=/(?:^|\s)(\((?:amounts?\s+)?in\s+(dollars|thousands|millions|billions)\b[^)]{0,160}\))/gi;
 let matches=[...s.matchAll(rx)];
 if(atStart)matches=matches.filter(m=>m.index<=8);
 if(!matches.length)return null;
 if(matches.length!==1)return {status:'conflict',reason:'more-than-one-scale-declaration'};
 const m=matches[0],unit=m[2].toLowerCase();
 return {status:'ok',multiplier:multiplicity[unit],declaration:m[1]};
}
function statementScale(html,tables,kind,index){
 if(index===null||!Number.isInteger(index)||!tables[index])
  return unknown('statement-not-uniquely-identified');
 const table=tables[index],initial=clean(table[1].slice(0,2700));
 // Microsoft-type: declaration is inside the first rows of the statement table.
 const internal=findDeclaration(initial.slice(0,430),{atStart:true});
 if(internal?.status==='conflict')return internal;
 // Apple-type: declaration directly follows a heading before the first <table>.
 const prior=clean(html.slice(Math.max(0,table.index-3800),table.index));
 const rx=STATEMENT_HEADING[kind],titles=[...prior.matchAll(rx)];
 const last=titles.at(-1);
 let external=null;
 if(last){
  const after=prior.slice(last.index+last[0].length).trim();
  // Require a declaration directly following the actual statement title,
  // never unrelated preceding notes/tables or a distant "in millions".
  external=findDeclaration(after.slice(0,240),{atStart:true});
 }
 if(external?.status==='conflict')return external;
 if(internal?.status==='ok'&&external?.status==='ok'&&
  internal.multiplier!==external.multiplier)
  return {status:'conflict',reason:'contradictory-table-and-heading-scales'};
 const proof=internal?.status==='ok'?internal:external;
 if(!proof)return unknown('financial-statement-scale-not-found-near-heading');
 return {status:'ok',multiplier:proof.multiplier,
  declaration:proof.declaration,statement:kind,tableIndex:index,
  scope:internal?.status==='ok'?'inside-statement-table':'adjacent-statement-heading'};
}
export function normalizeSourceScaledStatementHtml(html,{sourceUrl,reportYear,years,currency='USD'}={}){
 // Extract unscaled numbers first, so no caller-provided multiplier can
 // silently change financial magnitude. Each statement has its own scale.
 const extracted=normalizeGenericStatementHtml(html,{sourceUrl,reportYear,years,currency,multiplier:1});
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
 const byStatement={};
 for(const kind of ['income','cash','balance']){
  byStatement[kind]=statementScale(html,tables,kind,extracted.statementSelection[kind]);
 }
 const byMetric={revenue:'income',netIncome:'income',operatingCashflow:'cash',
  interestBearingDebt:'balance'};
 const output={};
 for(const [year,fields] of Object.entries(extracted.years)){
  output[year]={};
  for(const [metric,fact] of Object.entries(fields)){
   if(fact.status!=='ok'){output[year][metric]=fact;continue}
   const proof=byStatement[byMetric[metric]];
   if(proof.status!=='ok'){
    output[year][metric]={status:proof.status==='conflict'?'conflict':'missing',
     reason:proof.reason,sourceUrl};
    continue;
   }
   output[year][metric]={...fact,value:fact.value*proof.multiplier,
    // Derived debts inherit the unique balance sheet table's source identity.
    tableIndex:proof.tableIndex,scaleEvidence:{...proof,sourceUrl}};
  }
 }
 return {...extracted,provider:'Source-anchored generic issuer HTML statement',
  quality:'issuer-html-not-sec',years:output,statementScales:byStatement};
}
