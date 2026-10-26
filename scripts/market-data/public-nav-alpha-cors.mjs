// Advisory CORS smoke from the actual Alpha origin; no portfolio or prices saved.
const url="https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json";
const origin="https://osakevahti-alpha-naatti21.pages.dev";
const controller=new AbortController(),t=setTimeout(()=>controller.abort(),12000);
try{
 const r=await fetch(url,{headers:{Origin:origin,Accept:"application/json"},
   redirect:"error",signal:controller.signal});
 const allow=r.headers.get("access-control-allow-origin");
 const pass=r.ok&&(allow==="*"||allow===origin);
 process.stdout.write(JSON.stringify({status:r.status,
   corsAllowedForAlpha:pass,accessControlAllowOrigin:allow,
   contentType:r.headers.get("content-type")})+"\n");
 if(r.body)await r.body.cancel();
 if(!pass)process.exitCode=1;
}catch(e){console.error("CORS probe failed:",String(e?.message||e));process.exitCode=1;}
finally{clearTimeout(t);}
