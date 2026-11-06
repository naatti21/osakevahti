/**
 * Personal-only, explicit NAV tracking for existing fund positions.
 * No portfolio migration. Identity choices and NAV quotes are additive;
 * position ids, quantities, acquisition cost, account and legacy quote stay.
 */
export const NAV_LINK_SOURCE="rahastoraportti-public-experiment";
const positive=v=>typeof v==="number"&&Number.isFinite(v)&&v>0;
const up=v=>String(v??"").trim().toUpperCase();
function validDay(day){
 if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const d=new Date(day+"T12:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
}
export function navAgeDays(day,now=Date.now()){
 if(!validDay(day))return null;
 const today=new Intl.DateTimeFormat("sv-SE",{
  timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit"
 }).format(now);
 const d=Math.round((Date.parse(today)-Date.parse(day))/86400000);
 return d>=0?d:null;
}
export function navConsentForHolding(h,c){
 if(!h||h.assetType!=="fund"||!h.id)throw Error("Valitse ensin olemassa oleva rahasto.");
 if(!c||typeof c.isin!=="string"||!(/^[A-Z]{2}[A-Z0-9]{10}$/).test(up(c.isin)))
  throw Error("Ehdokkaalla ei ole kelvollisen muotoista ISINiä.");
 if(!c.name||typeof c.name!=="string")throw Error("Rahaston nimi puuttuu.");
 if(up(c.currency)!==up(h.currency))throw Error("Osuuslajin valuutta ei vastaa vanhaa omistusta.");
 const oldId=up(h.instrument?.isin||h.isin);
 if(oldId&&oldId!==up(c.isin))throw Error("Vanhalla omistuksella on ristiriitainen ISIN. Korjaa tunnus ennen NAV-kytkentää.");
 return {
  ...h,navOptIn:true,
  navBinding:{
   sourceId:NAV_LINK_SOURCE,isin:up(c.isin),currency:up(c.currency),
   publishedName:c.name.trim().slice(0,160),
   shareClass:String(c.shareClass||"").trim().slice(0,60),
   evidence:"user-confirmed-published-name-and-currency",acceptedAt:Date.now()
  },
  navObservation:undefined,navDiagnostic:undefined
 };
}
export function removeNavConsent(h){
 if(!h)return h;
 const copy={...h};delete copy.navOptIn;delete copy.navBinding;
 delete copy.navObservation;delete copy.navDiagnostic;return copy;
}
export function usableNavObservation(h,now=Date.now()){
 const b=h?.navBinding,o=h?.navObservation;
 if(h?.assetType!=="fund"||h?.navOptIn!==true||b?.sourceId!==NAV_LINK_SOURCE||
    o?.sourceId!==NAV_LINK_SOURCE||!b?.acceptedAt||
    !b.isin||up(b.currency)!==up(h.currency)||
    up(o.isin)!==up(b.isin)||up(o.currency)!==up(h.currency)||
    !positive(o.price)||!validDay(o.navDate))return null;
 const oldId=up(h.instrument?.isin||h.isin);
 if(oldId&&oldId!==up(b.isin))return null;
 const days=navAgeDays(o.navDate,now);
 if(days===null||days>7)return null;
 return {price:o.price,navDate:o.navDate,ageDays:days};
}
export function effectiveFundPrice(h,now=Date.now()){
 const q=usableNavObservation(h,now);
 if(q)return q.price;
 if(positive(h?.currentPrice))return h.currentPrice;
 if(positive(h?.manualPrice))return h.manualPrice;
 return 0;
}
export function updateNavQuote(h,quote,now=Date.now()){
 const b=h?.navBinding;
 if(h?.navOptIn!==true||b?.sourceId!==NAV_LINK_SOURCE)return h;
 if(quote?.status!=="candidate"||up(quote.isin)!==up(b.isin)||
    up(quote.currency)!==up(h.currency)||!positive(quote.price)||!validDay(quote.navDate))
  return {...h,navDiagnostic:{reason:quote?.reason||"no_candidate",checkedAt:now}};
 const days=navAgeDays(quote.navDate,now);
 if(days===null||days>7)return {...h,navDiagnostic:{reason:"stale_nav",checkedAt:now}};
 if(validDay(h?.navObservation?.navDate)&&quote.navDate<h.navObservation.navDate)
  return {...h,navDiagnostic:{reason:"older_than_previous",checkedAt:now}};
 const base=usableNavObservation(h,now)?.price||
  (positive(h?.currentPrice)?h.currentPrice:positive(h?.manualPrice)?h.manualPrice:null);
 if(base&&Math.abs(quote.price/base-1)>0.5){
  return {...h,navDiagnostic:{reason:"large_nav_change_needs_review",checkedAt:now}};
 }
 return {...h,navObservation:{
  sourceId:NAV_LINK_SOURCE,isin:b.isin,currency:h.currency,
  price:quote.price,navDate:quote.navDate,checkedAt:now
 },navDiagnostic:undefined};
}
