// Diagnostic only: checks whether a dated, exact-ISIN, EUR NAV can be read
// in a sustainable, independently verifiable way. No saved portfolio data.
const endpoints=[
 ["official-fundlist","https://storebrand.fondlista.se/details/SE0013801479/2"],
 ["official-fund-report","https://api.fund.storebrand.no/open/funddata/document?currencyCode=EUR&documentOrigin=WOLF&documentType=MONTHLY_FUND_REPORT&isin=SE0013801479&languageCode=en-GB"],
 ["ycharts-nav","https://ycharts.com/mutual_funds/M%3ASE0013801479/net_asset_value"],
 ["nordnet-fund","https://www.nordnet.fi/rahastot/lista/storebrand-japan-a-eur-dbe9644c"]
];
for(const [name,url] of endpoints){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch(url,{headers:{"Accept":"text/html,application/json;q=0.8","User-Agent":"OsakevahtiPersonalResearch/1.0 (+noncommercial test)"},redirect:"follow",signal:controller.signal});
  const type=r.headers.get("content-type")||"",cors=r.headers.get("access-control-allow-origin")||"";
  const content=type.includes("pdf")?"":(await r.text()).slice(0,350000);
  const strictIsin=content.includes("SE0013801479");
  const match=content.match(/(?:209[.,]34|Fondkurs.{0,65}|Nov(?:ember)? 0?[4-6].{0,12}2026|2026-11-0[4-6])/i);
  if(name==="official-fundlist"){
    const idAt=content.indexOf("SE0013801479");
    const area=content.slice(Math.max(0,idAt-14000),idAt+12000);
    const tagText=area.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ")
      .replace(/\s+/g," ").trim();
    const loc=tagText.indexOf("Fondkurs");
    console.log("STOREBRAND_OFFICIAL_LOCAL_CONTEXT",JSON.stringify({
      isinPosition:idAt,
      afterIsin:tagText.slice(Math.max(0,tagText.indexOf("SE0013801479")-130),tagText.indexOf("SE0013801479")+450),
      priceAround:tagText.slice(Math.max(0,loc-120),loc+260)
    }));
  }
  console.log("STOREBRAND_CANDIDATE_PROBE",JSON.stringify({
   name,status:r.status,type,cors,htmlBytes:content.length,hasExactISIN:strictIsin,
   datedText:match?.[0]||null,containsPriceCandidate:content.includes("209.34"),
   finalHost:(new URL(r.url)).hostname
  }));
 }catch(e){console.log("STOREBRAND_CANDIDATE_PROBE",JSON.stringify({name,error:String(e?.message||e)}))}
 finally{clearTimeout(timeout)}
}
