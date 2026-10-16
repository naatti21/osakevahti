import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newAdapter} from './import-qa/new-adapter.mjs';
const root=process.env.OSAKEVAHTI_SOURCE||process.cwd();
const ocr=lines=>({text:lines.map(x=>typeof x==='string'?x:x.text).join('\n'),lines:lines.map(x=>typeof x==='string'?{text:x,confidence:97}:x)});
const candidate=(symbol,name,currency='EUR',extra={})=>({symbol,longname:name,currency,quote_type:'EQUITY',exchange:'HEL',full_exchange_name:'Helsinki',...extra});
const row=(a,name='Aurora Robotics',extra={})=>a.holdingFromImportRow({name,quantity:'7',currency:'EUR',...extra},'synthetic');

test('short and non-Latin issuer labels remain reviewable without invented ticker',()=>{
 const a=newAdapter(root);
 for(const name of ['QZX','東京電力','3M']){
  const r=a.screenshotCandidatesFromOcr(ocr([name,'7 kpl','GAV 12 EUR']));
  assert.equal(r[0]?.name,name); assert.equal(r[0].symbol,'');
 }
});
test('partial shared company words do not make unrelated issuers relevant',async()=>{
 const a=newAdapter(root); a.setCandidates([candidate('AMN','Aurora Mining')]);
 const r=await a.resolveImportedHolding(row(a,'Aurora Robotics'));
 assert.equal(r.candidates.length,0);
});
test('bare ticker name can find a listing but cannot silently identify it',async()=>{
 const a=newAdapter(root); a.setCandidates([candidate('QZX','Quartz Xenon Systems')]);
 const r=await a.resolveImportedHolding(row(a,'QZX'));
 assert.equal(r.candidates.length,1); assert.equal(r.ready,false);
});
test('exact ISIN can retain translated issuer names without guessing',async()=>{
 const a=newAdapter(root);
 a.setCandidates([candidate('SYN','Different Transliteration','EUR',{isin:'US0378331005'})]);
 const r=await a.resolveImportedHolding(row(a,'Paikallinen nimi',{isin:'US0378331005'}));
 assert.equal(r.candidates.length,1); assert.equal(r.ready,false);
});
test('all relevant alternate listings remain available, including beyond first five',async()=>{
 const a=newAdapter(root); a.setCandidates(Array.from({length:8},(_,i)=>candidate('AR'+i,'Aurora Robotics',i%2?'USD':'EUR')));
 const r=await a.resolveImportedHolding(row(a)); assert.equal(r.candidates.length,8); assert.equal(r.ready,false);
});
test('column-major OCR order uses physical rows, not adjacent array positions',()=>{
 const a=newAdapter(root);
 const r=a.screenshotCandidatesFromOcr(ocr([
  {text:'Aurora Robotics',top:10,bottom:28,left:10,right:180},
  {text:'Boreal Materials',top:50,bottom:68,left:10,right:180},
  {text:'7 kpl',top:10,bottom:28,left:230,right:280},
  {text:'19 kpl',top:50,bottom:68,left:230,right:280}
 ]));
 assert.equal(r.find(x=>x.name==='Aurora Robotics')?.quantity,7);
 assert.equal(r.find(x=>x.name==='Boreal Materials')?.quantity,19);
 assert.equal(r[0].sourceRows[0].top,10);
});
test('two side-by-side cards cannot attach the other card quantity',()=>{
 const a=newAdapter(root);
 const r=a.screenshotCandidatesFromOcr(ocr([
  {text:'Aurora Robotics',top:10,bottom:28,left:10,right:180},
  {text:'Boreal Materials',top:10,bottom:28,left:230,right:400},
  {text:'7 kpl',top:40,bottom:58,left:10,right:80}
 ]));
 assert.ok(r.every(x=>x.validationErrors.length>0));
});
test('multiple quantities inside one OCR line never silently select the first',()=>{
 const a=newAdapter(root); const r=a.screenshotCandidatesFromOcr(ocr(['Aurora Robotics','7 kpl 19 kpl','GAV 12 EUR']));
 assert.ok(r[0].validationErrors.length>0);
});
test('low-confidence explicit quantity cannot auto-resolve or bypass final confirmation',async()=>{
 const a=newAdapter(root);const r=a.screenshotCandidatesFromOcr(ocr(['Aurora Robotics','Ticker AR',{text:'7 kpl',confidence:12},'GAV 12 EUR']));
 a.setCandidates([candidate('AR','Aurora Robotics')]);
 const resolved=await a.resolveImportedHolding(a.holdingFromOcrCandidate(r[0],'synthetic'));
 assert.equal(resolved.ready,false);
 const result=a.commit([{...resolved,ready:true,status:'unverified'}]);
 assert.equal(result.saved,null);
});
test('international currency is preserved and ambiguous dollar is not USD',()=>{
 const a=newAdapter(root);
 const cad=a.screenshotCandidatesFromOcr(ocr(['Aurora Robotics','7 kpl','GAV 12 CAD']));
 assert.equal(cad[0].currency,'CAD');
 const dollar=a.screenshotCandidatesFromOcr(ocr(['Aurora Robotics','7 kpl','GAV 12 $']));
 assert.notEqual(dollar[0].currency,'USD'); assert.ok(dollar[0].validationErrors.length>0);
});
test('malformed resolver payload entries do not crash or become candidates',async()=>{
 const a=newAdapter(root);a.setCandidates([null,{},candidate('AR','Aurora Robotics')]);
 const r=await a.resolveImportedHolding(row(a));assert.equal(r.candidates.length,1);
});
test('unknown identity cannot overwrite a verified same-ticker holding',()=>{
 const a=newAdapter(root);const existing=row(a,'Aurora Robotics',{symbol:'AR'});
 existing.instrument.identification='resolved';existing.instrument.providerSymbol='AR';existing.id='old';
 const incoming=row(a,'Unrelated Resource',{symbol:'AR',quantity:'99'});
 const result=a.mergeImportedHoldings([existing],[incoming]);
 assert.equal(result.holdings.find(x=>x.id==='old').quantity,7);
});
test('final save rechecks positive finite quantity and currency',()=>{
 for(const overrides of [{quantity:0},{quantity:Infinity},{currency:'',instrument:{}}]){
  const a=newAdapter(root),h={...row(a),...overrides};
  const result=a.commit([{holding:h,ready:true,status:'manual',candidates:[],selected:-1}]);
  assert.equal(result.saved,null);
 }
});

test('ETF and mutual fund listings remain reviewable across currencies and markets',async()=>{
 for(const [type,providerType] of [['etf','ETF'],['fund','MUTUALFUND']]){
  const a=newAdapter(root);
  a.setCandidates([
   candidate('BGL.L','Boreal Global Index','GBP',{quote_type:providerType,exchange:'LSE',full_exchange_name:'London'}),
   candidate('BGL.TO','Boreal Global Index','CAD',{quote_type:providerType,exchange:'TOR',full_exchange_name:'Toronto'})
  ]);
  const r=await a.resolveImportedHolding(row(a,'Boreal Global Index',{asset_type:type,currency:'CAD'}));
  assert.equal(r.candidates.length,2);assert.equal(r.ready,false);
 }
});
test('identical names and tickers at different venues cannot auto-resolve',async()=>{
 const a=newAdapter(root);
 a.setCandidates([candidate('AR','Aurora Robotics'),candidate('AR','Aurora Robotics','EUR',{exchange:'GER',full_exchange_name:'Xetra'})]);
 const r=await a.resolveImportedHolding(row(a,'Aurora Robotics',{symbol:'AR'}));
 assert.equal(r.ready,false);assert.equal(r.candidates.length,2);
});
test('network failure preserves review-required and never writes existing portfolio',async()=>{
 const a=newAdapter(root),old=row(a);a.setCandidates([],'failure');
 const r=await a.resolveImportedHolding(row(a));
 assert.equal(r.status,'error');assert.equal(r.ready,false);
 const result=a.commit([r],[old]);assert.equal(result.saved,null);
 assert.deepEqual(result.holdings,JSON.parse(JSON.stringify([old])));
});
test('same issuer with distinct explicit venues does not overwrite the old listing',()=>{
 const a=newAdapter(root),old=row(a,'Aurora Robotics',{symbol:'AR',mic:'XHEL'});
 old.id='existing';const incoming=row(a,'Aurora Robotics',{symbol:'AR',mic:'XETR',quantity:'19'});
 const result=a.mergeImportedHoldings([old],[incoming]);
 assert.equal(result.holdings.length,2);assert.equal(result.holdings[0].quantity,7);
});
test('strict CSV quantity rejects malformed, negative and infinite values',()=>{
 const a=newAdapter(root);
 for(const quantity of ['7 shares','NaN','Infinity','-1','0','12..3'])assert.throws(()=>row(a,'Aurora Robotics',{quantity}));
 assert.equal(row(a,'Aurora Robotics',{quantity:'7,25'}).quantity,7.25);
});
test('resolved ETF and fund types survive candidate construction',async()=>{
 for(const [quote_type,expected] of [['ETF','etf'],['MUTUALFUND','fund']]){
  const a=newAdapter(root);a.setCandidates([candidate('BGL','Boreal Global Index','EUR',{quote_type})]);
  const r=await a.resolveImportedHolding(row(a,'Boreal Global Index',{symbol:'BGL'}));
  assert.equal(r.ready,true);assert.equal(r.holding.assetType,expected);
 }
});
test('UI commands followed by a quantity cannot become ownership names',()=>{
 const a=newAdapter(root);const r=a.screenshotCandidatesFromOcr(ocr(['Show sources 7 shares']));
 assert.equal(r.length,0);
});
test('ISO currency codes inside ticker fields or issuer names are not currency evidence',()=>{
 const a=newAdapter(root);
 for(const ticker of ['CAD','ALL','AMD']){
  const r=a.screenshotCandidatesFromOcr(ocr(['Aurora Robotics','Ticker '+ticker,'7 kpl','GAV 12 USD']));
  assert.equal(r[0].currency,'USD');assert.equal(r[0].validationErrors.length,0);
 }
});
test('staggered side-by-side cards cannot lend a quantity across columns',()=>{
 const a=newAdapter(root);const r=a.screenshotCandidatesFromOcr(ocr([
  {text:'Aurora Robotics',top:10,bottom:28,left:10,right:180},
  {text:'Boreal Materials',top:40,bottom:58,left:230,right:400},
  {text:'7 kpl',top:70,bottom:88,left:10,right:80}
 ]));
 assert.ok(r.every(x=>x.validationErrors.length>0));
});
