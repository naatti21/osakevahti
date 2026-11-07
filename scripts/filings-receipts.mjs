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
   // xBRL-JSON entity is an SQName. The *prefix* is arbitrary ("scheme",
   // "lei", etc.); its canonical URI defines the identifier scheme.
   // Never accept a prefix alone without consulting documentInfo.namespaces.
   const namespaces=doc.documentInfo?.namespaces||{};
   const LEI_NS=new Set(['http://standards.iso.org/iso/17442',
      'http://standard.iso.org/iso/17442']);
   const tokens=allIdentifiers.map(value=>{
    if(typeof value!=='string')return {prefix:null,id:null,namespace:null};
    const m=value.match(/^([A-Za-z][\w.-]*):([A-Z0-9]{20})$/);
    return m?{prefix:m[1],id:m[2],namespace:namespaces[m[1]]||null}:
     {prefix:null,id:null,namespace:null};
   });
   r.entityNamespacesUsed=tokens.map(t=>({prefix:t.prefix,namespace:t.namespace}));
   r.identityMethod='xbrl-entity-dimension';
   r.entityMatched=facts.length>0&&allIdentifiers.length>=1&&
    tokens.every(t=>t.id===lei&&LEI_NS.has(t.namespace));
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
