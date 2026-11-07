// Research evidence gate for annual filing facts. It does NOT equate a source
// observation, checksum or parsed fact with an independently verified financial
// statement or make investment recommendations. Source receipts must be made
// from fetched bytes at the collection boundary (not from the normalized facts).

export const AUDIT_METRICS=['revenue','netIncome','operatingCashflow','interestBearingDebt'];
export const AUDIT_YEARS=[2021,2022,2023,2024,2025];
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const safeUrl=s=>{
 try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.hostname?u:null}catch{return null}
};
const readDays=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
const identityOK=identity=>typeof identity==='string'&&
 (/^LEI:[A-Z0-9]{20}$/.test(identity)||/^CIK:\d{10}$/.test(identity));
const receiptDate=s=>typeof s==='string'&&!Number.isNaN(Date.parse(s))&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
const verifiedHex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
function periodOK(fact,metric,year,format){
 if(format==='issuer-html')return fact.fiscalYear===year;
 if(!fact.period||typeof fact.period!=='string')return false;
 const d=fact.period.split('/');
 if(metric==='interestBearingDebt')return d.length===1&&d[0]===year+'-12-31';
 if(d.length!==2||!iso(d[0])||!iso(d[1])||d[1]!==year+'-12-31')return false;
 return readDays(d[0],d[1])>=335&&readDays(d[0],d[1])<=390;
}
function scopeSource(url,identity,format,allowedHosts){
 const u=safeUrl(url);
 if(!u||!allowedHosts.includes(u.hostname))return false;
 if(format==='xbrl-json'){
  return u.hostname==='filings.xbrl.org'&&
    u.pathname.includes('/'+identity.slice(4)+'/')&&u.pathname.endsWith('.json');
 }
 if(format==='issuer-html'){
  const fromCik=identity.startsWith('CIK:')?identity.slice(4):null;
  // Issuer-hosted IR may not expose CIK in its URL; this is weaker
  // identity evidence and must be reviewed independently.
  return !fromCik||!u.pathname.includes('CIK-')||
   u.pathname.includes('CIK-'+fromCik);
 }
 return false;
}
function receiptQuality(receipt,fact,identity,allowedHosts,asOf){
 if(!receipt)return 'no-matching-source-receipt';
 if(!scopeSource(receipt.sourceUrl,identity,receipt.format,allowedHosts))
  return 'source-host-or-identifier-mismatch';
 if(receipt.issuerId!==identity)return 'receipt-issuer-mismatch';
 if(!verifiedHex(receipt.sha256))return 'source-fingerprint-missing';
 if(!receiptDate(receipt.fetchedAt)||Date.parse(receipt.fetchedAt)>Date.parse(asOf)+300000)
  return 'invalid-source-collection-date';
 if(receipt.format==='xbrl-json'){
  if(receipt.identityMethod!=='xbrl-entity-dimension'||receipt.entityMatched!==true)
   return 'xbrl-entity-identity-unverified';
 }else if(receipt.format==='issuer-html'){
  if(!['issuer-host-name','cik-in-publisher-path'].includes(receipt.identityMethod)||
   receipt.entityMatched!==true)return 'html-issuer-identity-unverified';
 }
 if(receipt.sourceUrl!==fact.sourceUrl)return 'source-receipt-url-mismatch';
 return null;
}
export function auditFilingEvidence(matrix,{identity,currency,receipts=[],years=AUDIT_YEARS,
 allowedHosts=['filings.xbrl.org','www.microsoft.com','d18rn0p25nwr6d.cloudfront.net'],
 asOf=new Date().toISOString()}={}){
 if(!identityOK(identity)||!['USD','EUR'].includes(currency)||
  !receiptDate(asOf)||!Array.isArray(years)||!years.every(y=>Number.isInteger(y)&&y>=2000&&y<=2100)||
  !Array.isArray(receipts)||!Array.isArray(allowedHosts))
  throw new TypeError('invalid-audit-scope');
 const receiptIndex=new Map();
 for(const receipt of receipts){
  const key=receipt?.sourceUrl;
  if(typeof key!=='string')continue;
  if(!receiptIndex.has(key))receiptIndex.set(key,[]);
  receiptIndex.get(key).push(receipt);
 }
 const cells={};const counts={total:0,sourceConsistent:0,needsReview:0,missing:0,blocked:0,independentlyVerified:0};
 for(const year of years){
  cells[year]={};
  for(const metric of AUDIT_METRICS){
   counts.total++;
   const fact=matrix?.years?.[year]?.[metric];
   if(!fact||fact.status==='missing'||fact.status==='unavailable'){
    cells[year][metric]={status:'missing',reason:fact?.reason||'not-collected'};
    counts.missing++;continue;
   }
   const reject=reason=>{counts.blocked++;return {status:'blocked',reason}};
   if(fact.status!=='ok'||typeof fact.value!=='number'||!Number.isFinite(fact.value)||
    !['revenue','interestBearingDebt'].includes(metric)&&!['netIncome','operatingCashflow'].includes(metric)||
    (['revenue','interestBearingDebt'].includes(metric)&&fact.value<0)||
    fact.unit!==currency||typeof fact.concept!=='string'||!fact.concept.trim()){
    cells[year][metric]=reject('fact-conflict-value-unit-or-concept');continue;
   }
   const records=receiptIndex.get(fact.sourceUrl)||[];
   if(records.length!==1){cells[year][metric]=reject('missing-or-ambiguous-source-receipt');continue}
   const receipt=records[0];
   const sourceError=receiptQuality(receipt,fact,identity,allowedHosts,asOf);
   if(sourceError){cells[year][metric]=reject(sourceError);continue}
   if(!periodOK(fact,metric,year,receipt.format)){
    cells[year][metric]=reject('fiscal-period-not-proven');continue;
   }
   if(receipt.format==='xbrl-json'&&!fact.concept.startsWith('ifrs-full:')){
    cells[year][metric]=reject('unexpected-xbrl-taxonomy');continue;
   }
   if(receipt.format==='issuer-html'&&fact.sourceTier!=='issuer-html-not-xbrl'&&
      matrix?.quality!=='issuer-html-not-sec'){
    cells[year][metric]=reject('html-source-tier-ambiguous');continue;
   }
   const base={sourceUrl:fact.sourceUrl,sourceSha256:receipt.sha256,
    value:fact.value,unit:fact.unit,fiscalYear:year,concept:fact.concept,
    evidenceClass:receipt.format==='xbrl-json'?'structured-source':'issuer-html'};
   if(receipt.format==='issuer-html'){
    // Never graduate issuer HTML to independently verified just because
    // a monetary scale was read from the actual statement heading.
    const proof=fact.scaleEvidence;
    const sourceScaleProven=proof?.status==='ok'&&proof.sourceUrl===fact.sourceUrl&&
     proof.tableIndex===fact.tableIndex&&
     ['adjacent-statement-heading','inside-statement-table'].includes(proof.scope)&&
     [1,1000,1000000,1000000000].includes(proof.multiplier)&&
     typeof proof.declaration==='string'&&/^\((?:amounts?\s+)?in\s+(dollars|thousands|millions|billions)\b/i.test(proof.declaration);
    cells[year][metric]={...base,status:'needs-review',
      scaleEvidence:sourceScaleProven?proof:null,
      reason:sourceScaleProven?'html-scale-proven-issuer-currency-and-independent-review-pending':
       'html-scale-not-proven-from-statement'};
    counts.needsReview++;
   }else{
    cells[year][metric]={...base,status:'source-consistent',
      reason:'xbrl-entity-unit-and-period-structurally-consistent-not-independently-checked'};
    counts.sourceConsistent++;
   }
  }
 }
 return {schema:'filings-evidence-gate/0.1',identifier:identity,currency,asOf,
  counts,cells,investmentUse:'NO_GO',
  explanation:'A source SHA-256 fingerprints fetched bytes; it is not an authenticity signature. No independent accountancy check has been completed.'};
}
