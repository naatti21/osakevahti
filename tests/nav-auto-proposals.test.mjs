import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFundBackupSnapshot,proposeFundMatches,missingNavIdentityCandidate,createFundBackup,FUND_BACKUP_URL}
  from '../engine/public-nav-backup.mjs';
const NOW=Date.parse('2026-11-06T12:00:00Z');
const A='IE00B03HD191',B='SE0013801453',C='SE0005993102';
const raw=[
 {ISIN:A,companyNameFi:'Nordnet Suomi Indeksi',currency:'EUR',closePrice:'12.56',closePriceDate:'20261105'},
 {ISIN:B,companyNameFi:'Nordnet USA Indeksi A EUR',currency:'EUR',closePrice:'14.71',closePriceDate:'20261105'},
 {ISIN:C,companyNameFi:'Nordnet USA Indeksi B EUR',currency:'EUR',closePrice:'30.10',closePriceDate:'20261105'}
];
const parsed=parseFundBackupSnapshot(raw,NOW);
assert.equal(parsed.ok,true);
const h=(name,extra={})=>({id:name,assetType:'fund',name,currency:'EUR',
  quantity:10,buyPrice:2,account:'user-original-account',manualPrice:5,currentPrice:5,...extra});
test('exact name becomes candidate only; no holdings touched',()=>{
 const holding=h('Nordnet Suomi Indeksi');
 const original=JSON.stringify(holding);
 const r=proposeFundMatches(holding,parsed);
 assert.equal(r.status,'strong_name');
 assert.equal(r.candidates[0].isin,A);
 assert.equal(r.candidates[0].price,12.56);
 assert.equal(JSON.stringify(holding),original);
 assert.equal(holding.navBinding,undefined);
});
test('uncertain same-fund share classes are not presented as one proven match',()=>{
 const r=proposeFundMatches(h('Nordnet USA Indeksi'),parsed);
 assert.equal(r.status,'review');
 assert.equal(r.ambiguous,true);
 assert.equal(r.candidates.length,2);
});
test('existing ISIN is a hard constraint even when name suggests another fund',()=>{
 const r=proposeFundMatches(h('Nordnet Suomi Indeksi',{instrument:{isin:B}}),parsed);
 assert.equal(r.status,'known_isin');
 assert.deepEqual(r.candidates.map(c=>c.isin),[B]);
});
test('currency mismatch, invalid ISIN, and stocks produce no proposal',()=>{
 assert.equal(proposeFundMatches(h('Nordnet Suomi Indeksi',{currency:'USD'}),parsed).candidates.length,0);
 assert.equal(proposeFundMatches(h('Nordnet Suomi Indeksi',{instrument:{isin:'IE0000000000'}}),parsed).status,'invalid_isin');
 assert.equal(proposeFundMatches({...h('Nordnet Suomi Indeksi'),assetType:'stock'},parsed).candidates.length,0);
});
test('all fund proposals come from one global public fetch; no portfolio details leak',async()=>{
 let count=0,requests=[];
 const reader=createFundBackup({storage:null,now:()=>NOW,fetchImpl:async(url,opts)=>{
   count++;requests.push([url,opts]);
   return new Response(JSON.stringify(raw),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 const res=await reader.suggest([h('Nordnet Suomi Indeksi'),h('Nordnet USA Indeksi'),h('Unknown Fund')]);
 assert.equal(count,1);
 assert.equal(requests[0][0],FUND_BACKUP_URL);
 assert.equal(requests[0][1].credentials,'omit');
 assert.equal(JSON.stringify(requests).includes('user-original-account'),false);
 assert.equal(JSON.stringify(requests).includes('buyPrice'),false);
 assert.equal(res[0].candidates[0].isin,A);
 assert.equal(res[1].status,'review');
 assert.equal(res[2].status,'no_match');
});

test('Nordea Pohjoismaat Indeksi Select A matches verified Nordic alias and not another Nordea fund',()=>{
 const liveLike=parseFundBackupSnapshot([
   {ISIN:'FI4000602453',companyNameFi:'Nordea Nordic Indeksi Select A',
    currency:'EUR',closePrice:'10.12',closePriceDate:'20261106'},
   {ISIN:'FI0008800065',companyNameFi:'Nordea Pohjoismaat A',
    currency:'EUR',closePrice:'25.20',closePriceDate:'20261106'}
 ],NOW);
 assert.equal(liveLike.ok,true);
 const old=h('Nordea Pohjoismaat Indeksi Select A');
 const match=proposeFundMatches(old,liveLike);
 assert.equal(match.status,'strong_name');
 assert.equal(match.candidates[0].isin,'FI4000602453');
 assert.equal(match.candidates.length,1);
 assert.equal(old.navBinding,undefined);
});

test('Storebrand Japan A EUR is an identity-only candidate: NEVER a price or accepted NAV feed',()=>{
  const original=h('Storebrand Japan A EUR');
  const preserved=JSON.stringify(original);
  const result=proposeFundMatches(original,parsed);
  assert.equal(result.status,'no_nav_source');
  assert.equal(result.candidates.length,1);
  const candidate=result.candidates[0];
  assert.equal(candidate.isin,'SE0013801479');
  assert.equal(candidate.currency,'EUR');
  assert.equal(candidate.shareClass,'A EUR');
  assert.equal(candidate.sourceStatus,'identity-only');
  assert.equal(candidate.price,null);
  assert.equal(candidate.navDate,null);
  assert.equal(original.navBinding,undefined);
  assert.equal(JSON.stringify(original),preserved);
  assert.equal(missingNavIdentityCandidate(h('Storebrand Japan C EUR')),null);
  assert.equal(missingNavIdentityCandidate(h('Storebrand Japan A EUR',{currency:'SEK'})),null);
  assert.equal(missingNavIdentityCandidate(h('Storebrand Japan A EUR',{instrument:{isin:'SE0013801487'}})),null);
});
