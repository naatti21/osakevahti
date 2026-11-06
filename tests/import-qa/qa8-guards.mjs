// Locked QA8 failure-mode checks. These exercise production functions from
// the checked-out index.html; resolver and save are deliberately stubbed.
// Not a substitute for real-browser persistence or real OCR.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { newAdapter } from './new-adapter.mjs';

const source=path.resolve(process.env.OSAKEVAHTI_SOURCE||'.');
const destination=path.resolve(process.env.QA_REPORT_DIR||'test-results');
fs.mkdirSync(destination,{recursive:true});
const results={
  source,testedSourceSha256:null,
  method:'production AST functions; deterministic synthetic resolver; save stub',
  policy:'fail on QA8 P1/P2 regression; no baseline rewriting',
  scenarios:[]
};
let adapter;
try {
  adapter=newAdapter(source);
  results.testedSourceSha256=adapter.sourceSha256;
} catch(error) {
  results.setupFailure=error.stack||String(error);
  fs.writeFileSync(path.join(destination,'qa8-guards.json'),JSON.stringify(results,null,2));
  console.error(results.setupFailure);
  process.exit(2);
}
async function check(name,fn) {
  const row={name};
  try {await fn(row);row.status='PASS';}
  catch(error) {row.status='FAIL';row.error=error.stack||String(error);}
  results.scenarios.push(row);
  console.log(row.status+': '+name+(row.error?' — '+row.error.split('\n')[0]:''));
}
async function resolvedRow(isin='',mic='XNAS',quantity=12) {
  const holding=adapter.holdingFromImportRow({
    symbol:'ASTR',name:'Aster Devices Corporation',quantity:String(quantity),
    buy_price:'35',currency:'USD',isin,mic,account:'QA8'
  },'QA8');
  adapter.setCandidates([{
    symbol:'ASTR',longname:holding.name,currency:'USD',quote_type:'EQUITY',
    exchange:mic==='XHEL'?'HEL':'NMS',mic
  }]);
  return adapter.resolveImportedHolding(holding);
}
const baseText='Aster Devices Corporation\nTicker ASTR\n12 kpl\nGAV 35 USD\n';
async function textCase(id,suffix,accept) {
  await check(id,async()=>{
    adapter.setExisting([]);
    const text=baseText+suffix;
    const parsed=adapter.screenshotCandidatesFromOcr({
      text,lines:text.split('\n').map(value=>({text:value,confidence:96}))
    });
    const rows=[];
    for(const part of parsed){
      adapter.setCandidates([{
        symbol:'ASTR',longname:part.name,currency:'USD',quote_type:'EQUITY',
        exchange:'NMS',full_exchange_name:'NasdaqGS',mic:'XNAS'
      }]);
      rows.push(await adapter.resolveImportedHolding(adapter.holdingFromOcrCandidate(part,'QA8')));
    }
    const committed=adapter.commit(rows);
    if(accept)assert.equal(committed.saved?.length,1,'expected one saved holding');
    else assert.equal(committed.saved,null,'conflicting or invalid source must be blocked');
  });
}
await check('Q8-01-source-ISIN-survives-empty-update',async()=>{
  const first=adapter.commit([await resolvedRow('US5949181045')]);
  assert.equal(first.saved?.length,1);
  const omitted=adapter.commit([await resolvedRow('','XNAS',15)],structuredClone(first.saved));
  assert.equal(omitted.saved?.[0]?.importMeta?.sourceIdentifiers?.isin,'US5949181045');
  adapter.setExisting(omitted.saved);
  const conflicting=await resolvedRow('FI4000297767','XNAS',20);
  assert.equal(adapter.importActionForRow(conflicting).kind,'review');
  const blocked=adapter.commit([conflicting],omitted.saved);
  assert.equal(blocked.saved,null);
  assert.deepEqual(blocked.holdings,omitted.saved);
});
for(const[id,tail,accept]of[
  ['Q8-02-double-isin','ISIN US5949181045 FI4000297767',false],
  ['Q8-02-double-mic','MIC XNAS XHEL',false],
  ['Q8-02-identical-isin','ISIN US5949181045 US5949181045',true],
  ['Q8-02-identical-mic','MIC XNAS XNAS',true],
  ['Q8-02-valid-then-invalid-isin','ISIN US5949181045 US5949181046',false],
  ['Q8-02-valid-then-invalid-mic','MIC XNAS X!AS',false],
  ['Q8-02-invalid-then-valid-isin','ISIN XX US5949181045',false],
  ['Q8-02-invalid-then-valid-mic','MIC X!AS XNAS',false],
  ['Q8-04-XNAS-NASDAQ','MIC XNAS\nExchange NASDAQ',true],
  ['Q8-04-XHEL-NASDAQ','MIC XHEL\nExchange NASDAQ',false],
  ['Q8-04-XNAS-NasdaqGS','MIC XNAS\nExchange NasdaqGS',true],
  ['Q8-04-XNAS-NMS','MIC XNAS\nExchange NMS',true]
])await textCase(id,tail,accept);
await check('Q8-03-distinct-listings-and-idempotence',async()=>{
  adapter.setExisting([]);
  const rows=[await resolvedRow('US5949181045'),await resolvedRow('FI4000297767','XHEL')];
  const first=adapter.commit(rows);
  assert.equal(first.saved?.length,2);
  const repeated=adapter.commit(rows,first.saved);
  assert.equal(repeated.saved?.length,2);
  assert.deepEqual(repeated.saved.map(h=>h.id),first.saved.map(h=>h.id));
  const update=adapter.commit([
    await resolvedRow('FI4000297767','XHEL',18),
    await resolvedRow('US5949181045','XNAS',15)
  ],repeated.saved);
  assert.equal(update.saved?.length,2);
  assert.deepEqual(update.saved.map(h=>h.quantity),[15,18]);
});
await check('Q8-03-same-MIC-conflicting-ISIN-must-block',async()=>{
  adapter.setExisting([]);
  const blocked=adapter.commit([
    await resolvedRow('US5949181045'),await resolvedRow('FI4000297767')
  ]);
  assert.equal(blocked.saved,null);
  assert.equal(blocked.holdings.length,0);
});
results.pass=results.scenarios.filter(r=>r.status==='PASS').length;
results.fail=results.scenarios.filter(r=>r.status==='FAIL').length;
fs.writeFileSync(path.join(destination,'qa8-guards.json'),JSON.stringify(results,null,2));
console.log('QA8 source guards: '+results.pass+' PASS / '+results.fail+' FAIL; SHA256 '+results.testedSourceSha256);
if(results.fail)process.exitCode=1;
