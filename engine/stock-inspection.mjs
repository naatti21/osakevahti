import {listingSymbol,validateStockQuote,observationTime,QUOTE_MAX_AGE} from './instrument-data.mjs';

// Source-agnostic, side-effect-free evaluation of ONE instrument observation.
// Never fills missing fundamentals, dividends or identity with guesses.
export const STOCK_INSPECTION_VERSION='0.1.0';
const validStatus=s=>s==='ok'||s==='stale';
const num=x=>typeof x==='number'&&Number.isFinite(x);
const unavailable=reason=>({status:'unavailable',reason});
const invalid=reason=>({status:'error',reason});
function dated(status,observedAt,source,now){
 if(!validStatus(status)||!observationTime(observedAt,now)||typeof source!=='string'||!source.trim())
  return invalid('missing-or-invalid-source-date');
 return {status:now-observedAt>QUOTE_MAX_AGE?'stale':status,observedAt,source};
}
function has(x){return x&&typeof x==='object'&&!Array.isArray(x)}
export function inspectStock({symbol,observation,now=Date.now()}={}){
 const exact=listingSymbol(symbol);
 if(!exact)return {status:'invalid',reason:'Anna kelvollinen pörssitunnus.',symbol:''};
 if(!has(observation)||observation.symbol!==exact)
  return {status:'unavailable',reason:'Lähteen instrumenttitunnus puuttuu tai on ristiriitainen.',symbol:exact};
 if(observation.instrumentType&&observation.instrumentType!=='EQUITY')
  return {status:'unsupported',reason:'Tämä listaus ei ole lähteen mukaan pörssiosake.',symbol:exact,
    instrumentType:observation.instrumentType};
 const raw=observation.quote;
 let quote=unavailable(raw?.reason||'Kurssia ei saatu luotettavasti.');
 if(raw?.status==='error')quote=invalid(raw?.reason||'Kurssilähteen virhe.');
 else if(raw?.value){
  const check=validateStockQuote(raw.value,{symbol:exact},now);
  if(validStatus(check.status)){
   const v=check.value;
   quote={status:check.status,price:v.price,currency:v.currency,observedAt:v.observedAt,
     source:v.source,exchange:v.exchange||'',delayed:v.delayed===true};
  }else quote=check.status==='error'?invalid(check.reason):unavailable(check.reason);
 }
 const m=observation.momentum;
 let momentum=unavailable(m?.reason||'Riittävää 1/3/6 kk kurssihistoriaa ei saatavilla.');
 if(m?.status==='error')momentum=invalid(m.reason||'Kurssihistoriassa ristiriita.');
 else if(validStatus(m?.status)){
  const basis=dated(m.status,m.observedAt,m.source,now);
  if(basis.status==='error'||![m.m1,m.m3,m.m6].every(x=>num(x)&&x>-100)||
    !Number.isInteger(m.samples)||m.samples<127||
    (quote.observedAt&&m.observedAt>quote.observedAt+86400000))
    momentum=invalid('Kurssihistorian mittarit, lähde tai havaintopäivä ovat puutteellisia.');
  else momentum={...basis,m1:m.m1,m3:m.m3,m6:m.m6,samples:m.samples,
    basis:String(m.basis||'Kurssimuutos ilman osinkoja.')};
 }
 const d=observation.dividends;
 let dividends=unavailable(d?.reason||'Todennettua osinkohistoriaa ei saatavilla.');
 if(d?.status==='error')dividends=invalid(d.reason||'Osinkotiedoissa ristiriita.');
 else if(validStatus(d?.status)){
  const basis=dated(d.status,d.observedAt,d.source,now);
  if(basis.status==='error'||!validStatus(quote.status)||
    !num(d.amount)||d.amount<=0||!num(d.yieldPct)||d.yieldPct<0||
    !Number.isInteger(d.eventCount)||d.eventCount<1||d.eventCount>100||
    d.currency!==quote.currency||Math.abs(d.amount/quote.price*100-d.yieldPct)>0.05)
    dividends=invalid('Osinkotapahtumat eivät täsmää havaittuun kurssiin tai valuuttaan.');
  else dividends={...basis,amount:d.amount,currency:d.currency,yieldPct:d.yieldPct,
    eventCount:d.eventCount,basis:String(d.basis||'Lähteen raportoimat 365 päivän tapahtumat.'),
    verifiedFiveFiscalYears:false,paymentStatus:'provider-reported-not-independent-issuer-proof'};
 }
 const gaps=[];
 if(!validStatus(quote.status))gaps.push('Kurssi ja valuutta');
 if(!validStatus(momentum.status))gaps.push('1/3/6 kk kurssihistoria');
 if(!validStatus(dividends.status))gaps.push('Lähteen raportoimat 12 kk osingot');
 gaps.push('Viiden tilikauden yhtiökohtaisesti vahvistetut osingot');
 gaps.push('Kassavirta, tulos ja velkaantuminen');
 gaps.push('Yhtiön verotuksellinen kotipaikka ja OST-kelpoisuus');
 if(!observation.instrumentType)gaps.push('Instrumenttilajin riippumaton tunnistus');
 return {version:STOCK_INSPECTION_VERSION,symbol:exact,status:validStatus(quote.status)?'partial':'unavailable',
   name:typeof observation.name==='string'?observation.name.slice(0,120):'',
   instrumentType:observation.instrumentType||'unverified',
   quote,momentum,dividends,
   fiveYearDividends:unavailable('Edellyttää vahvistettua tilikausihistoriaa.'),
   financials:unavailable('Tulos, rahavirta ja nettovelka eivät sisälly nykyiseen lähteeseen.'),
   accountSuitability:unavailable('OST/AOT-tilisuositus vaatii kotipaikka-, verotus- ja tilitiedot.'),
   qualityScore:null,recommendation:'Tieto ei riitä',gaps,
   warning:'Ei automaattista ostosuositusta. Lähteen raportoimat osingot eivät ole varmistettuja osinkopäätöksiä.'};
}
