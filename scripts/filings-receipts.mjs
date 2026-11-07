// Node-only research provenance receipts from the actual downloaded bytes.
// SHA-256 is a reproducibility fingerprint, NOT source authenticity proof.
import {createHash} from 'node:crypto';
const strongUrl=sourceUrl=>{
 try{const u=new URL(sourceUrl);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash}
 catch{return false}
};
export function createFilingsReceipt({sourceUrl,body,format,issuerId,issuerName}={}){
 if(!strongUrl(sourceUrl)||typeof body!=='string'||body.length<32||
    !['xbrl-json','issuer-html'].includes(format))
  throw new TypeError('Cannot fingerprint invalid source');
 const u=new URL(sourceUrl);
 const r={sourceUrl,sha256:createHash('sha256').update(body,'utf8').digest('hex'),
  fetchedAt:new Date().toISOString(),issuerId,format,
  identityMethod:null,entityMatched:false};
 if(format==='xbrl-json'){
  const lei=issuerId?.startsWith('LEI:')?issuerId.slice(4):null;
  if(lei&&u.hostname==='filings.xbrl.org'&&u.pathname.includes('/'+lei+'/')){
   const doc=JSON.parse(body);
   const facts=Object.values(doc.facts||{}).filter(f=>
    f?.dimensions?.concept&&f?.dimensions?.unit&&typeof f.value!=='object');
   const allIdentifiers=[...new Set(facts.map(f=>f?.dimensions?.entity))];
   r.dimensionFactCount=facts.length;
   r.entityDimensions=allIdentifiers.slice(0,12).map(x=>typeof x==='string'?x:'(missing)');
   r.identityMethod='xbrl-entity-dimension';
   r.entityMatched=facts.length>0&&allIdentifiers.length===1&&
     String(allIdentifiers[0]).toUpperCase()==='LEI:'+lei;
  }
 }else{
  const normalizedBody=body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').toLowerCase();
  const nameOK=typeof issuerName==='string'&&issuerName.length>3&&
   normalizedBody.includes(issuerName.toLowerCase())&&normalizedBody.includes('form 10-k');
  const cik=issuerId?.startsWith('CIK:')?issuerId.slice(4):null;
  r.identityMethod=cik&&u.pathname.includes('CIK-'+cik)?
   'cik-in-publisher-path':'issuer-host-name';
  r.entityMatched=nameOK;
 }
 return r;
}
