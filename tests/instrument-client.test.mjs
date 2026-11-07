import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstrumentClient} from '../engine/instrument-client.mjs';
const now=Date.now();
const data=symbol=>({version:1,symbol,quote:{status:'ok',value:{symbol,currency:'EUR',price:12,observedAt:now,source:'synthetic'}},
  momentum:{status:'unavailable'},dividends:{status:'unavailable'},news:{status:'ok',items:[]}});
test('coalesces duplicate accounts, bounds concurrency and sends only listing symbols',async()=>{
 let active=0,max=0,calls=0;const urls=[];
 const client=createInstrumentClient({origin:'https://worker.test',fetchImpl:async(url,options)=>{
  calls++;urls.push(url);active++;max=Math.max(active,max);assert.equal(options.credentials,'omit');
  await new Promise(r=>setTimeout(r,5));active--;return Response.json(data(new URL(url).searchParams.get('symbol')));
 }});
 await Promise.all(['AAA','AAA','BBB','CCC','DDD','EEE'].map(symbol=>client.lookup(symbol)));
 assert.equal(calls,5);assert.equal(max,3);
 assert.ok(urls.every(url=>[...new URL(url).searchParams.keys()].join()==='symbol'));
 assert.equal((await client.lookup('AAA',{currency:'USD'})).quote.status,'error');assert.equal(calls,5);
});
test('old Worker and invalid currency cannot masquerade as successful observations',async()=>{
 const old=createInstrumentClient({origin:'https://worker.test',fetchImpl:async()=>Response.json({assets:{AAA:{price:12}}})});
 assert.equal((await old.lookup('AAA')).quote.status,'error');
 const client=createInstrumentClient({origin:'https://worker.test',fetchImpl:async()=>Response.json({...data('AAA'),dividends:{status:'ok',amount:1,yieldPct:3,eventCount:1,currency:'USD',observedAt:now}})});
 assert.equal((await client.lookup('AAA')).dividends.status,'error');
});

test('verified quote currency must agree with provider envelope even when caller has no expected currency',async()=>{
 const client=createInstrumentClient({origin:'https://worker.test',fetchImpl:async()=>Response.json({
  ...data('NEW.HE'),currency:'EUR',instrumentType:'EQUITY',name:'Synthetic',
  quote:{status:'ok',value:{symbol:'NEW.HE',currency:'USD',price:12,observedAt:now,source:'synthetic'}}
 })});
 const result=await client.lookup('NEW.HE');
 assert.equal(result.quote.status,'error');
 assert.equal(result.instrumentType,'EQUITY');
});
