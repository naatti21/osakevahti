import {test} from "node:test";
import assert from "node:assert/strict";
import {parseFundBackupSnapshot,assessFundBackup,shouldTryFundBackup,
  createFundBackup,FUND_BACKUP_STORAGE_KEY,FUND_BACKUP_URL
} from "../engine/public-nav-backup.mjs";

const NOW=Date.parse("2026-10-26T12:00:00Z");
const isin="IE00B03HD191",other="SE0013801453";
const fund=(extra={})=>({assetType:"fund",name:"Unknown Fund A",currency:"EUR",
  instrument:{isin},currentPrice:10,navDate:"",...extra});
const item=(extra={})=>({ISIN:isin,closePrice:"10.50",currency:"EUR",
  closePriceDate:"20261023",...extra});
const mem=()=>{let data={};return {
  getItem:key=>data[key]??null,setItem:(key,value)=>{data[key]=value},
  removeItem:key=>{delete data[key]}
}};
const fetcher=(rows,records)=>async(url,opts)=>{
  records.push({url,opts});
  return new Response(JSON.stringify(rows),{status:200,
    headers:{"Content-Type":"application/octet-stream"}});
};

test("arbitrary ISINs and YYYYMMDD daily NAV snapshot, no hardcoded fund names",()=>{
  const result=parseFundBackupSnapshot([item(),
    item({ISIN:other,closePrice:"133.145",closePriceDate:"20261022"})],NOW);
  assert.equal(result.ok,true);
  assert.equal(result.entries[isin].price,10.5);
  assert.equal(result.entries[other].navDate,"2026-10-22");
});

test("same ISIN duplicates invalidate the mapping, not first-match-wins",()=>{
  const result=parseFundBackupSnapshot([item(),item({closePrice:"90"}),item({ISIN:other})],NOW);
  assert.equal(result.ok,true);
  assert.equal(result.entries[isin],undefined);
  assert.equal(result.duplicates,1);
});

test("invalid day, price, FX, ISIN or incomplete records do not become NAV",()=>{
  const input=[item(),item({ISIN:other,closePriceDate:"20260230"}),
    item({ISIN:other,closePrice:"-1"}),
    item({ISIN:other,currency:""}),
    item({ISIN:other,closePriceDate:""}),
    item({ISIN:other,ISIN:"ZZ0000000000"})];
  const result=parseFundBackupSnapshot(input,NOW);
  assert.equal(result.ok,true);
  assert.equal(Object.keys(result.entries).length,1);
});

test("different currency and older NAV cannot overwrite a verified position",()=>{
  const row=parseFundBackupSnapshot([item()],NOW).entries[isin];
  assert.equal(assessFundBackup(fund({currency:"USD"}),row,NOW).reason,"currency_mismatch");
  assert.equal(assessFundBackup(fund({navDate:"2026-10-24"}),row,NOW).reason,"older_than_existing_nav");
});

test("large jump or same day price conflict requires review",()=>{
  const row=parseFundBackupSnapshot([item()],NOW).entries[isin];
  assert.equal(assessFundBackup(fund({currentPrice:2}),row,NOW).status,"review");
  assert.equal(assessFundBackup(fund({currentPrice:10.0,navDate:"2026-10-23"}),row,NOW).status,"review");
});

test("fresh full-date NAV does not trigger fallback; failed/yearless does",()=>{
  assert.equal(shouldTryFundBackup(fund({navDate:"2026-10-23"}),NOW),false);
  assert.equal(shouldTryFundBackup(fund({navDate:"23.10."}),NOW),true);
  assert.equal(shouldTryFundBackup(fund({navDate:"2026-10-23",
    quoteHealth:{status:"failed"}}),NOW),true);
  assert.equal(shouldTryFundBackup(fund({navDate:"2026-10-01"}),NOW),true);
  assert.equal(shouldTryFundBackup(fund({assetType:"stock"}),NOW),false);
});

test("free reader fetches only fixed global public URL, never portfolio identifiers",async()=>{
  const calls=[],store=mem();
  const fallback=createFundBackup({
    fetchImpl:fetcher([item(),item({ISIN:other})],calls),
    storage:store,now:()=>NOW
  });
  const found=await fallback.lookup(fund({quantity:123.12,account:"Super secret account",buyPrice:5}));
  assert.equal(found.status,"candidate");
  assert.equal(found.navDate,"2026-10-23");
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,FUND_BACKUP_URL);
  assert.equal(calls[0].opts.credentials,"omit");
  assert.equal(calls[0].opts.mode,"cors");
  assert.equal(JSON.stringify(calls).includes("Super secret account"),false);
  assert.equal(JSON.stringify(store.getItem(FUND_BACKUP_STORAGE_KEY)).includes("Super secret account"),false);
  const next=await fallback.lookup(fund({instrument:{isin:other},currentPrice:10}));
  assert.equal(next.status,"candidate");
  assert.equal(calls.length,1);
});

test("cached global snapshot survives a new reader instance without repeat GET",async()=>{
  const calls=[],storage=mem(),a=createFundBackup({now:()=>NOW,storage,
    fetchImpl:fetcher([item()],calls)});
  await a.lookup(fund());
  const b=createFundBackup({now:()=>NOW+3600000,storage,
    fetchImpl:fetcher([item()],calls)});
  const result=await b.lookup(fund());
  assert.equal(result.status,"candidate");
  assert.equal(calls.length,1);
});

test("no ISIN means no HTTP call and no guessed fund name mapping",async()=>{
  const calls=[],reader=createFundBackup({now:()=>NOW,storage:mem(),
    fetchImpl:fetcher([item()],calls)});
  assert.equal((await reader.lookup(fund({instrument:{isin:""}}))).reason,"isin_missing_or_invalid");
  assert.equal(calls.length,0);
});

test("old or unavailable published NAV is not treated as current",async()=>{
  const row=parseFundBackupSnapshot([item({closePriceDate:"20260920"})],NOW).entries[isin];
  assert.equal(assessFundBackup(fund(),row,NOW).reason,"public_nav_outdated");
  const calls=[],reader=createFundBackup({now:()=>NOW,storage:mem(),
    fetchImpl:fetcher([item({closePriceDate:"20260920"})],calls)});
  assert.equal((await reader.lookup(fund())).status,"unavailable");
});

test("upstream 429 gracefully fails without zero price and honours one-hour cooldown",async()=>{
  let calls=0;
  const reader=createFundBackup({now:()=>NOW,storage:mem(),fetchImpl:async()=>{
    calls++;return new Response("Too many requests",{status:429});
  }});
  assert.equal((await reader.lookup(fund())).status,"unavailable");
  assert.equal((await reader.lookup(fund())).reason,"public_nav_retry_cooldown");
  assert.equal(calls,1);
});
