import {test} from "node:test";
import assert from "node:assert/strict";
import {parsePublicFundRows,validatePublicFundBackup,shouldUseFundBackup} from "../engine/public-fund-fallback.mjs";

const now=Date.parse("2026-10-26T13:00:00Z");
const good="Storebrand Global All Countries A EUR | 22.10.2026 | 271.31 | EUR | 223.67 | 278.44";
const sibling="Storebrand Global All Countries B EUR | 22.10.2026 | 199.35 | EUR | 187.00 | 205.00";
const binding={confirmed:true,sourceId:"rahastoraportti-public",
  sourceHost:"www.rahastoraportti.fi",isin:"SE0013801453",
  exactShareClassName:"Storebrand Global All Countries A EUR",currency:"EUR"};
const expected={nav:271.31,navDate:"2026-10-22"};
const parsed=text=>parsePublicFundRows(text).rows;

test("parse public human-visible price table with no instrument-specific code",()=>{
  const out=parsePublicFundRows("SHARE CLASS | DATE | PRICE | CURRENCY\n"+good+"\n"+sibling);
  assert.equal(out.error,null);
  assert.equal(out.rows.length,2);
  assert.equal(out.rows[0].nav,271.31);
  assert.equal(out.rows[0].navDate,"2026-10-22");
  assert.equal(out.rows[1].name,"Storebrand Global All Countries B EUR");
});

test("same fund different share classes must never be silently combined",()=>{
  const out=validatePublicFundBackup(parsed(good+"\n"+sibling),binding,{now});
  assert.equal(out.status,"backup_candidate");
  assert.equal(out.nav,271.31);
  assert.equal(out.currency,"EUR");
  assert.equal(out.identityEvidence,"user-confirmed-exact-share-class-label");
  assert.equal(out.portfolioWriteAllowed,false);
  assert.equal(out.automaticPortfolioWriteAllowed,false);
});

test("public name similarity alone cannot create a binding",()=>{
  const rows=parsed(good);
  for(const bad of [
    {...binding,confirmed:false},
    {...binding,exactShareClassName:"Storebrand Global All Countries"},
    {...binding,exactShareClassName:"Storebrand Global All Countries B EUR"},
    {...binding,currency:"USD"},
    {...binding,sourceId:"unknown"},
    {...binding,sourceHost:"attacker.example"}
  ]){
    assert.equal(validatePublicFundBackup(rows,bad,{now}).status,"withheld");
  }
});

test("public NAV date must be complete, real and within age limit",()=>{
  const invalid=[
    "22.10. | 271.31 | EUR | 220 | 280",
    "Storebrand Global All Countries A EUR | 31.02.2026 | 271.31 | EUR",
    "Storebrand Global All Countries A EUR | 27.10.2028 | 271.31 | EUR"
  ];
  for(const row of invalid){
    const out=validatePublicFundBackup(parsed(row),binding,{now});
    assert.equal(out.status,"withheld");
  }
  assert.equal(validatePublicFundBackup(parsed(
    "Storebrand Global All Countries A EUR | 16.10.2026 | 271.31 | EUR"),
    binding,{now}).reason,"nav_outdated");
});

test("large NAV jump and inconsistent source high-low range stop automatic acceptance",()=>{
  const rows=parsed(good);
  assert.equal(validatePublicFundBackup(rows,binding,{
    now,previous:{nav:125,navDate:"2026-10-21"}
  }).reason,"unusually_large_nav_change");
  const weird=parsed("Storebrand Global All Countries A EUR | 22.10.2026 | 2713.1 | EUR | 220 | 280");
  assert.equal(validatePublicFundBackup(weird,binding,{now}).reason,"year_range_inconsistent");
});

test("duplicate source share-class labels are ambiguous even if numeric prices match",()=>{
  const out=validatePublicFundBackup(parsed(good+"\n"+good),binding,{now});
  assert.equal(out.reason,"ambiguous_share_class_rows");
});

test("backup never overwrites a newer known NAV date",()=>{
  const out=validatePublicFundBackup(parsed(good),binding,{
    now,previous:{nav:272,navDate:"2026-10-23"}
  });
  assert.equal(out.reason,"backup_older_than_existing");
});

test("backup only runs after a missing/stale source and at most daily",()=>{
  assert.deepEqual(shouldUseFundBackup({primary:{navDate:"2026-10-23"},now}),
    {trigger:false,reason:"primary_fresh"});
  assert.equal(shouldUseFundBackup({primary:{navDate:""},now}).trigger,true);
  assert.equal(shouldUseFundBackup({primary:{navDate:"2026-10-15"},now}).trigger,true);
  assert.equal(shouldUseFundBackup({primary:{navDate:"2026-10-15"},
    now,lastAttemptAt:now-3600000}).reason,"daily_cooldown");
});

test("unrelated funds or missing public rows yield explicit no-coverage",()=>{
  const out=validatePublicFundBackup(parsed(sibling),binding,{now});
  assert.equal(out.reason,"matching_share_class_not_found");
});
