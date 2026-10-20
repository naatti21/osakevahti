import test from 'node:test';
import assert from 'node:assert/strict';
import {validIsin,navDay,validateFundNavEvidence,chooseFundNavEvidence}
  from '../fund-nav-evidence.mjs';

const now=Date.parse('2026-10-20T12:00:00Z');
const vanguard={isin:'IE00B03HD191',currency:'EUR',shareClass:'EUR Acc'};
const storebrand={isin:'SE0013801453',currency:'EUR',shareClass:'A EUR'};
const voucher=(identity,overrides={})=>({
  isin:identity.isin,currency:identity.currency,shareClass:identity.shareClass,
  provider:'Fictional issuer adapter',sourceKind:'issuer',
  nav:56.1234,navDate:'2026-10-19',fetchedAt:now,...overrides
});
const validate=(raw,expected=vanguard)=>validateFundNavEvidence(raw,expected,{now});

test('both independently published example issuer ISIN structures checksum',()=>{
  assert.equal(validIsin(vanguard.isin),true);
  assert.equal(validIsin(storebrand.isin),true);
  assert.equal(validIsin('IE00B03HD192'),false);
  assert.equal(validIsin('NOT_AN_ISIN'),false);
});
test('valid NAV date independent from fetch timestamp',()=>{
  const r=validate(voucher(vanguard,{fetchedAt:Date.parse('2026-10-20T12:00:00Z')}));
  assert.equal(r.status,'eligible');
  assert.equal(r.quote.navDate,'2026-10-19');
  assert.equal(r.quote.fetchedAt,now);
});
test('second issuer fund not in hardcoded six is not hardcoded into validator',()=>{
  const r=validate(voucher(storebrand,{nav:233.25}),storebrand);
  assert.equal(r.status,'eligible');
  assert.equal(r.quote.currency,'EUR');
});
test('identity, currency and share class are role boundaries',()=>{
  assert.equal(validate(voucher(vanguard,{isin:storebrand.isin})).reason,'isin-mismatch-or-missing');
  assert.equal(validate(voucher(vanguard,{currency:'USD'})).reason,'currency-mismatch-or-missing');
  assert.equal(validate(voucher(vanguard,{shareClass:'USD Acc'})).reason,'share-class-conflict');
  assert.equal(validate(voucher(vanguard),{currency:'EUR'}).reason,'expected-isin-unverified');
});
test('NAV without a reliable complete date is withheld even if fetched today',()=>{
  assert.equal(validate(voucher(vanguard,{navDate:'19.10.'})).reason,'nav-date-unverified');
  assert.equal(validate(voucher(vanguard,{navDate:''})).reason,'nav-date-unverified');
  assert.equal(validate(voucher(vanguard,{navDate:null})).reason,'nav-date-unverified');
});
test('future dates, impossible calendar dates and invalid years are withheld',()=>{
  for(const day of ['2027-10-19','2026-02-30','2025-02-29','not-a-date','1998-10-19']){
    assert.equal(navDay(day,now),null,day);
  }
  assert.equal(navDay('2024-02-29',now)?.day,'2024-02-29');
});
test('unreviewed and unknown source kind does not claim trusted evidence',()=>{
  assert.equal(validate(voucher(vanguard,{provider:''})).reason,'source-not-proven');
  assert.equal(validate(voucher(vanguard,{sourceKind:'scraped-public-link'})).reason,'source-not-proven');
});
test('nonpositive and nonnumeric NAV are withheld',()=>{
  for(const v of [0,-2.15,'unknown',null]){
    assert.equal(validate(voucher(vanguard,{nav:v})).reason,'invalid-nav');
  }
});
test('older NAV is marked stale, never assigned the fetch day',()=>{
  const r=validate(voucher(vanguard,{navDate:'2026-09-18'}));
  assert.equal(r.status,'stale');
  assert.equal(r.quote.navDate,'2026-09-18');
});
test('newest exact identity+currency valid dated NAV wins',()=>{
  const options={now},q=chooseFundNavEvidence([
    voucher(vanguard,{nav:56.2,navDate:'2026-10-17'}),
    voucher(vanguard,{nav:56.3,navDate:'2026-10-19'}),
    voucher(vanguard,{currency:'USD',nav:78.5})
  ],vanguard,options);
  assert.equal(q.status,'eligible');
  assert.equal(q.quote.nav,56.3);
});
test('same-day conflicting providers with different NAV cannot silently win',()=>{
  const q=chooseFundNavEvidence([
    voucher(vanguard,{nav:56.2,provider:'Fictional source A'}),
    voucher(vanguard,{nav:90.3,provider:'Fictional source B',sourceKind:'licensed-feed'})
  ],vanguard,{now});
  assert.equal(q.status,'conflict');
  assert.equal(q.quote,null);
});
test('only unavailable/mismatched sources return no overwrite candidate',()=>{
  const q=chooseFundNavEvidence([
    voucher(vanguard,{navDate:'19.10.',provider:'Fictional source A'}),
    voucher(vanguard,{isin:storebrand.isin,provider:'Fictional source B'})
  ],vanguard,{now});
  assert.equal(q.status,'unavailable');
  assert.equal(q.quote,null);
});
test('old observed date cannot overwrite an already newer portfolio NAV',()=>{
  const q=chooseFundNavEvidence([voucher(vanguard,{navDate:'2026-10-19'})],
    vanguard,{now,previous:{navDate:'2026-10-20',nav:58}});
  assert.equal(q.status,'not-newer');
  assert.equal(q.quote,null);
});
test('empty candidate set leaves instrument unsupported, not priced at zero',()=>{
  assert.deepEqual(chooseFundNavEvidence([],storebrand,{now}),{
    status:'unavailable',quote:null,checked:[],reason:'no-providers'
  });
});
