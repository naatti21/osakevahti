import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=fs.readFileSync('worker/worker.js','utf8');
const selected=new Set(['yahooSearch','yahooInstrumentMeta','resolveInstrument']);
const nodes=parse(source,{ecmaVersion:'latest',sourceType:'module'}).body.filter(n=>n.type==='FunctionDeclaration'&&selected.has(n.id.name));
function resolver(fetch){
 const ctx=vm.createContext({fetch,URLSearchParams,Date});
 vm.runInContext(nodes.map(n=>source.slice(n.start,n.end)).join('\n'),ctx);
 return vm.runInContext('resolveInstrument',ctx);
}
test('actual Worker contract filters instrument types and enriches only returned listings',async()=>{
 const urls=[];
 const run=resolver(async url=>{
  urls.push(url);
  return {ok:true,json:async()=>url.includes('/search?')?{quotes:[
   {symbol:'BGL.L',longname:'Boreal Global Index',quoteType:'ETF',exchange:'LSE'},
   {symbol:'BGF',longname:'Boreal Global Fund',quoteType:'MUTUALFUND'},
   {symbol:'^NO',quoteType:'INDEX'},null,{}
  ]}:{chart:{result:[{meta:{currency:'GBP',exchangeName:'LSE',fullExchangeName:'London',instrumentType:'ETF'}}]}}};
 });
 const result=await run('Boreal Global');
 assert.equal(result.candidates.length,2);assert.equal(result.candidates[0].currency,'GBP');
 assert.ok(urls.every(u=>!u.includes('quantity')&&!u.includes('buyPrice')));
 assert.equal(new URL(urls[0]).searchParams.get('enableFuzzyQuery'),'true');
});
test('actual Worker metadata failure leaves currency absent instead of inventing it',async()=>{
 const run=resolver(async url=>{
  if(!url.includes('/search?'))throw new Error('Synthetic metadata outage');
  return {ok:true,json:async()=>({quotes:[{symbol:'AR',longname:'Aurora Robotics',quoteType:'EQUITY'}]})};
 });
 const result=await run('Aurora Robotics');assert.equal(result.candidates[0].currency,'');
 assert.equal(result.candidates[0].isin,undefined);
});
test('actual Worker propagates Yahoo HTTP failure',async()=>{
 const run=resolver(async()=>({ok:false,status:429}));
 await assert.rejects(()=>run('Aurora Robotics'),/HTTP 429/);
});
