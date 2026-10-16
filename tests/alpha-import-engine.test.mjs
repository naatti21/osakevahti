import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectOcrHolding,inspectCsvText} from '../alpha-import-engine.mjs';

const PINNED_BLOBS={
  'numbers.mjs':'a9ae0ed4093eff6ffc042f12e4510cc4d84041a0',
  'acceptance.mjs':'b822f682db551269a239abe1bb9afbc763b34337',
  'csv.mjs':'bd9c2942b43446e0cfaa3db74b995105af8c495b',
  'holdings.mjs':'70bdb0332adbca4060526d06039442a396e856be'
};
for(const [name,expected] of Object.entries(PINNED_BLOBS)){
  test('Engine research core is byte-identical: '+name,async()=>{
    const b=await readFile(new URL('../engine/'+name,import.meta.url));
    const actual=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
    assert.equal(actual,expected,'Research core drift must be reviewed, not modified silently');
  });
}
function sample(extraRows=[],changes={}){
  return {
    symbol:'ASTR',name:'Aster Devices Corporation',quantity:12,buyPrice:35,currency:'USD',
    instrument:{listingTicker:'ASTR'},
    importMeta:{
      provided:{buyPrice:true},validationErrors:[],
      sourceRows:[
        {line:1,text:'Aster Devices Corporation'},
        {line:2,text:'Ticker ASTR'},
        {line:3,text:'12 kpl'},
        {line:4,text:'GAV 35 USD'},
        ...extraRows
      ]
    },
    ...changes
  };
}
test('OCR evidence from actual source rows can form candidate-ready but never persist',()=>{
  const r=inspectOcrHolding(sample());
  assert.equal(r.status,'candidate-ready');
  assert.equal(r.canPersist,false);
  assert.equal(r.originalRowCount,4);
});
test('unknown second-page money is not silently certified',()=>{
  const r=inspectOcrHolding(sample([{line:5,text:'Unmapped amount 43 000,00'}]));
  assert.equal(r.status,'review-required');
  assert.ok(r.problems.some(p=>p.code==='UNACCOUNTED_MATERIAL'));
  assert.equal(r.canPersist,false);
});
test('missing original buy price never becomes a verified zero',()=>{
  const h=sample();
  h.buyPrice=0;h.importMeta.provided.buyPrice=false;
  const r=inspectOcrHolding(h);
  assert.equal(r.status,'review-required');
  assert.ok(r.problems.some(p=>p.code==='MISSING_FIELD'&&p.field==='buyPrice'));
});
test('currency inferred from browser default is not source evidence',()=>{
  const r=inspectOcrHolding(sample([],{currency:'EUR'}));
  assert.equal(r.status,'review-required');
  assert.equal(r.canPersist,false);
});
test('screenshot candidate without OCR source rows is not green',()=>{
  const h=sample();h.importMeta.sourceRows=[];
  const r=inspectOcrHolding(h);
  assert.equal(r.status,'review-required');
  assert.ok(r.problems.some(p=>p.code==='BLOCKING_SOURCE_ISSUE'));
});
test('OCR parser error blocks Engine endorsement',()=>{
  const h=sample();h.importMeta.validationErrors=['Ristiriitainen MIC'];
  const r=inspectOcrHolding(h);
  assert.equal(r.status,'review-required');
  assert.equal(r.canPersist,false);
});
test('CSV engine separates correct and missing-currency batches',()=>{
  const valid=inspectCsvText('Name;Quantity;Buy Price;Currency\nAster Devices;12;35;USD');
  assert.equal(valid.status,'candidate-only');
  assert.equal(valid.canPersist,false);
  const missing=inspectCsvText('Name;Quantity;Buy Price\nAster Devices;12;35');
  assert.equal(missing.status,'review-required');
  assert.equal(missing.canPersist,false);
});
