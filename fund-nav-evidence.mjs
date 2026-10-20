// Research-only boundary for future dynamic fund NAV adapters.
// Does NOT fetch external data or write portfolio positions.
const datePattern=/^(\d{4})-(\d{2})-(\d{2})$/;
export function validIsin(value){
  const isin=String(value??'').trim().toUpperCase();
  if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin))return false;
  const digits=[...isin].map(c=>/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c).join('');
  let checksum=0,double=false;
  for(let i=digits.length-1;i>=0;i--){
    let n=Number(digits[i]);if(double){n*=2;if(n>9)n-=9}
    checksum+=n;double=!double;
  }
  return checksum%10===0;
}
export function navDay(raw,now=Date.now()){
  const s=String(raw??'').trim(),p=s.match(datePattern);
  if(!p)return null;
  const [y,m,d]=p.slice(1).map(Number),epoch=Date.UTC(y,m-1,d,12);
  const dt=new Date(epoch);
  if(y<2000||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||
    dt.getUTCDate()!==d||epoch>now+86400000)return null;
  return {day:s,epoch};
}
export function validateFundNavEvidence(raw,expected,{now=Date.now(),maxAgeDays=7}={}){
  const no=(reason)=>({status:'withheld',reason,quote:null});
  if(!validIsin(expected?.isin))return no('expected-isin-unverified');
  const isin=String(raw?.isin??'').toUpperCase().trim();
  if(!validIsin(isin)||isin!==String(expected.isin).toUpperCase().trim())
    return no('isin-mismatch-or-missing');
  const expectedCurrency=String(expected.currency??'').trim().toUpperCase();
  const currency=String(raw.currency??'').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(expectedCurrency)||currency!==expectedCurrency)
    return no('currency-mismatch-or-missing');
  const series=String(expected.shareClass??'').trim().toLowerCase();
  const candidateSeries=String(raw.shareClass??'').trim().toLowerCase();
  if(series&&candidateSeries&&series!==candidateSeries)
    return no('share-class-conflict');
  // Provider adapter must be explicitly reviewed and named. A URL alone is
  // not trusted evidence; sourceKind distinguishes distinct feeds vs mirrors.
  const provider=String(raw.provider??'').trim();
  const sourceKind=String(raw.sourceKind??'').trim();
  if(!provider||!['issuer','licensed-feed','broker'].includes(sourceKind))
    return no('source-not-proven');
  const nav=Number(raw.nav);
  if(!Number.isFinite(nav)||nav<=0)return no('invalid-nav');
  const date=navDay(raw.navDate,now);
  if(!date)return no('nav-date-unverified');
  const ageDays=Math.max(0,(now-date.epoch)/86400000);
  const quote={isin,shareClass:raw.shareClass??null,currency,nav,
    navDate:date.day,provider,sourceKind,
    // fetchedAt is only diagnostic, NEVER substituted for navDate.
    fetchedAt:Number.isFinite(raw.fetchedAt)?raw.fetchedAt:null};
  return {status:ageDays>maxAgeDays?'stale':'eligible',
    reason:ageDays>maxAgeDays?'nav-valuation-too-old':null,quote};
}
export function chooseFundNavEvidence(observations,expected,options={}){
  const checked=(observations||[]).map((observation,index)=>({
    index,...validateFundNavEvidence(observation,expected,options)
  }));
  const accepted=checked.filter(x=>x.status==='eligible');
  if(!accepted.length)return {status:'unavailable',quote:null,
    checked,reason:checked.length?'no-eligible-nav':'no-providers'};
  accepted.sort((a,b)=>b.quote.navDate.localeCompare(a.quote.navDate));
  const top=accepted[0];
  const same=accepted.filter(x=>x.quote.navDate===top.quote.navDate);
  // A same-day conflict must be reviewed, even if one source returned 200.
  const inconsistent=same.some(x=>
    Math.abs(x.quote.nav-top.quote.nav)>Math.max(.005,top.quote.nav*.005));
  if(inconsistent)return {status:'conflict',quote:null,checked,
    reason:'same-day-nav-disagreement'};
  const previous=options.previous;
  if(previous?.navDate && previous.navDate>top.quote.navDate)
    return {status:'not-newer',quote:null,checked,reason:'older-than-known-nav'};
  return {status:'eligible',quote:top.quote,checked,
    // Different delivery paths can share the same origin; never claim
    // independent verification just because a second transport succeeded.
    observedSources:same.map(x=>x.quote.provider)};
}
