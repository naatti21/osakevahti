import {fundJsonRow,indexPublicFundJson} from "../../workers/providers/rahastoraportti-public.mjs";

/**
 * ONE read-only GET of the JSON URL actually fetched by the public website.
 * Output schema metadata only. No instrument names, NAV prices, secret headers,
 * entire JSON dumps, user holdings, file persistence or redistribution.
 */
const url="https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
const report={probe:"public-browser-linked-json-shape",available:false,sourceHost:new URL(url).hostname};
try{
  const r=await fetch(url,{signal:controller.signal,redirect:"error",
    headers:{Accept:"application/json,text/plain;q=0.9"}
  });
  report.status=r.status;
  report.contentType=(r.headers.get("content-type")||"").split(";")[0];
  if(!r.ok)throw Error("HTTP_"+r.status);
  const length=Number(r.headers.get("content-length")||0);
  if(length>6500000)throw Error("too_large");
  const reader=r.body.getReader(),decoder=new TextDecoder();
  let raw="",size=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.length;
    if(size>6500000){await reader.cancel();throw Error("too_large");}
    raw+=decoder.decode(value,{stream:true});
  }
  const j=JSON.parse(raw+decoder.decode());
  const typeOf=x=>Array.isArray(x)?"array":x===null?"null":typeof x;
  const describe=x=>{
    const shape={type:typeOf(x)};
    if(Array.isArray(x)){
      shape.count=x.length;
      const first=x.find(y=>y&&typeof y==="object");
      if(first)shape.itemKeys=Object.keys(first).slice(0,35).map(k=>({key:k,type:typeOf(first[k])}));
    }else if(x&&typeof x==="object"){
      shape.keys=Object.keys(x).slice(0,40).map(k=>({key:k,type:typeOf(x[k])}));
      for(const [k,v] of Object.entries(x)){
        if(Array.isArray(v)){
          shape.firstArrayKey=k;
          shape.firstArray=describe(v);
          break;
        }
      }
    }
    return shape;
  };
  report.available=true;report.bytes=size;report.shape=describe(j);
  if(Array.isArray(j)){
    report.fieldsPresent={
      ISIN:j.filter(x=>typeof x?.ISIN==="string"&&x.ISIN.length>0).length,
      closePrice:j.filter(x=>x?.closePrice!=null&&String(x.closePrice).trim()!=="").length,
      closePriceDate:j.filter(x=>x?.closePriceDate!=null&&String(x.closePriceDate).trim()!=="").length,
      currency:j.filter(x=>x?.currency!=null&&String(x.currency).trim()!=="").length,
    };
    report.dateFormats={};
    for(const item of j){
      const value=String(item?.closePriceDate||"").trim();
      const format=/^\d{2}\.\d{2}\.\d{4}$/.test(value)?"DD.MM.YYYY":
        /^\d{4}-\d{2}-\d{2}$/.test(value)?"YYYY-MM-DD":
        /^\d{4}-\d{2}-\d{2}T/.test(value)?"ISO_TIME":
        !value?"missing":"other";
      report.dateFormats[format]=(report.dateFormats[format]||0)+1;
    }
    report.classObjectKeys=Object.keys(j.find(x=>x?.class&&typeof x.class==="object")?.class||{}).slice(0,15);
    report.isinFormatValidCount=j.filter(x=>/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(x?.ISIN||""))).length;
    const now=Date.now();
    report.liveAdapterValidatedRecords=j.filter(x=>!!fundJsonRow(x,now)).length;
    const indexed=indexPublicFundJson(j,now);
    report.liveAdapterUniqueIsins=indexed.index?.size||0;
    report.liveAdapterAmbiguousIsins=[...(indexed.index||new Map()).values()].filter(x=>x===null).length;
    report.liveAdapterStatus=report.liveAdapterValidatedRecords>500?"format-compatible":"format-incompatible";
    report.dateFormatMasks=[...new Set(j.map(x=>String(x?.closePriceDate||"").slice(0,35)
      .replace(/[0-9]/g,"#").replace(/[A-Za-z]/g,"A")))].slice(0,12);
    report.priceFormatMasks=[...new Set(j.map(x=>String(x?.closePrice||"").slice(0,30)
      .replace(/[0-9]/g,"#")))].slice(0,12);
    report.priceTypeHistogram=Object.fromEntries(
      [...new Set(j.map(x=>typeof x?.closePrice))].map(type=>[type,j.filter(x=>typeof x?.closePrice===type).length])
    );
  }
  // Never output/source raw data, values or names from the downloaded report.
}catch(err){
  report.error=String(err?.message||err||"source_failure").slice(0,100);
}finally{clearTimeout(timer);}
process.stdout.write(JSON.stringify(report,null,2)+"\n");
