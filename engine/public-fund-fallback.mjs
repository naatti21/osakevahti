/**
 * Public fund NAV backstop. No HTTP, user portfolio writes or provider-specific
 * fund names. Works with a human-visible public table exported as plain rows.
 *
 * Rahastoraportti.fi currently shows NAME / DATE / PRICE / CURRENCY / low / high.
 * Its table does not prove the ISIN. A locally confirmed exact name+class mapping
 * is required; labels must never be matched loosely by token or substring.
 *
 * Source terms and availability must be qualified before automation.
 */
const clean=v=>String(v??"").normalize("NFKC").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
const key=v=>clean(v).toLocaleLowerCase("fi");
const positive=v=>Number.isFinite(v)&&v>0;
function calendarDay(raw){
  const s=clean(raw);
  const m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!m)return null;
  const day=+m[1],month=+m[2],year=+m[3];
  const t=Date.UTC(year,month-1,day,12),d=new Date(t);
  if(year<2000||d.getUTCFullYear()!==year||
     d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
  return {date:[year,String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-"),time:t};
}
function numeric(raw){
  const s=clean(raw).replace(/\s/g,"");
  if(!/^\d{1,10}(?:[.,]\d{1,8})?$/.test(s))return null;
  const v=Number(s.replace(",","."));
  return positive(v)?v:null;
}
function lineFields(line){
  const s=String(line??"");
  // Human-readable pipe-delimited public price table: no scraping here.
  const fields=s.split("|").map(clean);
  if(fields.length<4)return null;
  const [name,date,price,currency,low,high]=fields;
  if(!name||name.length>180||!calendarDay(date)||
     !positive(numeric(price))||!/^[A-Z]{3}$/.test(currency))return null;
  return {name,navDate:calendarDay(date).date,
    nav:numeric(price),currency,yearLow:numeric(low),yearHigh:numeric(high)};
}
export function parsePublicFundRows(snapshot,{maxRows=12000}={}){
  if(typeof snapshot!=="string"||snapshot.length>1500000)return {rows:[],error:"invalid_snapshot_size"};
  const rows=[];
  for(const line of snapshot.split(/\r?\n/)){
    if(rows.length>=maxRows)return {rows:[],error:"row_limit_exceeded"};
    const r=lineFields(line);
    if(r)rows.push(r);
  }
  return {rows,error:null};
}

export function validatePublicFundBackup(rows,binding,{
  now=Date.now(),maxAgeDays=7,previous=null,maxUnreviewedMovePct=20
}={}) {
  const stop=(reason,extra={})=>({status:"withheld",reason,portfolioWriteAllowed:false,...extra});
  if(!binding || binding.confirmed!==true ||
     binding.sourceId!=="rahastoraportti-public" ||
     binding.sourceHost!=="www.rahastoraportti.fi" ||
     !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(binding.isin||"").toUpperCase()) ||
     !clean(binding.exactShareClassName)||
     !/^[A-Z]{3}$/.test(String(binding.currency||"")))
    return stop("user_binding_not_confirmed");
  const matches=(rows||[]).filter(r=>
    key(r?.name)===key(binding.exactShareClassName)&&
    r?.currency===binding.currency);
  if(matches.length===0)return stop("matching_share_class_not_found");
  if(matches.length!==1)return stop("ambiguous_share_class_rows");
  const r=matches[0],day=calendarDay(
    r.navDate.slice(8,10)+"."+r.navDate.slice(5,7)+"."+r.navDate.slice(0,4));
  if(!day||day.time>now+86400000)return stop("invalid_or_future_nav_date");
  const age=Math.max(0,Math.round((now-day.time)/86400000));
  if(age>maxAgeDays)return stop("nav_outdated",{ageDays:age});
  if(!positive(r.nav))return stop("nav_not_positive");
  if(previous?.navDate && previous.navDate>r.navDate)
    return stop("backup_older_than_existing");
  // Some publicly displayed tables have inconsistent year-low/high numeric
  // scales. They must not automatically justify/override a suspect NAV.
  if(positive(r.yearLow)&&positive(r.yearHigh)&&
     (r.yearLow>r.yearHigh||r.nav<r.yearLow*0.75||r.nav>r.yearHigh*1.25))
    return stop("year_range_inconsistent");
  const prior=Number(previous?.nav);
  if(positive(prior)&&Math.abs((r.nav-prior)/prior*100)>maxUnreviewedMovePct)
    return stop("unusually_large_nav_change",{needsReview:true});
  return {
    status:"backup_candidate",
    // Public rows don't show ISIN; it comes from the user's locally
    // confirmed source binding, and must NEVER be presented as issuer proof.
    identityEvidence:"user-confirmed-exact-share-class-label",
    isin:binding.isin,nav:r.nav,navDate:r.navDate,currency:r.currency,
    name:r.name,sourceId:binding.sourceId,sourceHost:binding.sourceHost,
    sourceLink:"https://www.rahastoraportti.fi/",
    ageDays:age,confidence:"secondary-manually-bound",
    automaticPortfolioWriteAllowed:false,portfolioWriteAllowed:false
  };
}

/** Query needed only if primary fund NAV missing or more than 7 days old. */
export function shouldUseFundBackup({primary,now=Date.now(),lastAttemptAt=0,minIntervalHours=24}={}){
  if(lastAttemptAt && now-lastAttemptAt<minIntervalHours*3600000)
    return {trigger:false,reason:"daily_cooldown"};
  if(!primary||!primary.navDate)
    return {trigger:true,reason:"primary_undated"};
  const raw=String(primary.navDate);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return {trigger:true,reason:"primary_unverified_date"};
  const t=Date.parse(raw+"T12:00:00Z");
  if(!Number.isFinite(t)||t>now+86400000)
    return {trigger:true,reason:"primary_invalid_date"};
  if(now-t>7*86400000)
    return {trigger:true,reason:"primary_stale"};
  return {trigger:false,reason:"primary_fresh"};
}
