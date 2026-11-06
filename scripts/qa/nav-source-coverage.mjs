// Read-only source coverage diagnosis. Queries exactly the same public fund JSON
// used in the Android PWA. No portfolio, user data, or ISIN query is sent.
const URL="https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
const target=["FI4000602453","SE0013801479"];
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),20000);
try{
 const r=await fetch(URL,{cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}});
 if(!r.ok)throw Error("HTTP "+r.status);
 const data=await r.json();
 if(!Array.isArray(data))throw Error("Unexpected public feed shape");
 const matches=target.map(id=>{
   const x=data.find(row=>String(row?.ISIN||"").toUpperCase()===id);
   return {isin:id,found:!!x,name:x?.companyNameFi||x?.companyNameEn||x?.companyNameSv||null,
      currency:x?.currency||null,navDate:x?.closePriceDate||null,
      navPresent:!!x?.closePrice};
 });
 console.log("NAV_SOURCE_TARGET_COVERAGE",JSON.stringify({
  total:data.length,entries:matches,brandMentions:{
   nordea:data.filter(x=>JSON.stringify(x).toLowerCase().includes("pohjoismaat indeksi")).length,
   japan:data.filter(x=>JSON.stringify(x).toLowerCase().includes("storebrand japan")).length
  }
 }));
}catch(e){console.log("NAV_SOURCE_COVERAGE_UNAVAILABLE",String(e?.message||e))}
finally{clearTimeout(timeout)}
