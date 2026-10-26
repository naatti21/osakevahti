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
  // Never output/source raw data, values or names from the downloaded report.
}catch(err){
  report.error=String(err?.message||err||"source_failure").slice(0,100);
}finally{clearTimeout(timer);}
process.stdout.write(JSON.stringify(report,null,2)+"\n");
