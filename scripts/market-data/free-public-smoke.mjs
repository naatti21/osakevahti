/**
 * Read-only public endpoint smoke: no API keys, portfolios, user data or paid plans.
 * Advisory only, errors are surfaced and NEVER interpreted as a qualified feed.
 */
import {openFigiFree,frankfurterFreeFx} from "../../workers/providers/free-foundation.mjs";
const report={checkedAt:new Date().toISOString(),free:true,identity:null,fx:null};
const mask=e=>String(e?.message||e||"error").replace(/https?:\/\/\S+/g,"[URL]").slice(0,100);
async function run(){
  const now=Date.now();
  const fx=frankfurterFreeFx({timeoutMs:12000,now:()=>now});
  try{
    const r=await fx.rate("USD","EUR");
    if(r.status!=="dated_reference"||r.date>"2026-10-26"||
       !Number.isFinite(r.rate)||r.rate<=0)
      throw Error("FX contract mismatch");
    report.fx={status:"ok",date:r.date,source:r.provider,ratePositive:true};
  }catch(e){report.fx={status:"failed",reason:mask(e)};}
  const figi=openFigiFree({timeoutMs:12000});
  try{
    // Public security sample, not a user holding: IBM ISIN.
    const r=await figi.lookupIsin("US4592001014");
    if(!["candidates","unavailable"].includes(r.status)||!Array.isArray(r.candidates))
      throw Error("FIGI contract mismatch");
    if(r.candidates.some(c=>c.automaticBindingAllowed!==false||c.verifiedPrice!==false))
      throw Error("FIGI provenance flag invalid");
    report.identity={status:r.status==="candidates"?"ok":"no_match",
      candidateCount:r.candidates.length,marketPriceSupplied:false};
  }catch(e){report.identity={status:"failed",reason:mask(e)};}
  process.stdout.write(JSON.stringify(report,null,2)+"\n");
  const success=report.fx.status==="ok"&&report.identity.status==="ok";
  if(process.env.GITHUB_STEP_SUMMARY){
    const fs=await import("node:fs/promises");
    const summary=[
      "### Keyless public source smoke (advisory, 0 €/kk)",
      "Frankfurter: "+report.fx.status+(report.fx.date?" ("+report.fx.date+")":""),
      "OpenFIGI: "+report.identity.status+
        (Number.isInteger(report.identity.candidateCount)?" ("+report.identity.candidateCount+" candidates)":""),
      "These are identifier and daily-FX probes, NOT universal stock or NAV live-data validation.",
      "No user holdings or paid API token used."
    ].join("\n")+"\n";
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
  }
  if(!success)process.exitCode=1;
}
run().catch(e=>{console.error("Probe fatal:",mask(e));process.exitCode=1;});
