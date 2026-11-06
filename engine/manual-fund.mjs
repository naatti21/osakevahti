import {attachReviewedIdentity,validateFundReviewBackup} from './fund-review.mjs';
// Local-only review/commit boundary. A name and user confirmation are not
// independent evidence of a financial identity or an automatic source binding.
const clean=v=>String(v??'').trim();
const key=v=>clean(v).normalize('NFKC').toLocaleLowerCase('fi').replace(/\s+/g,' ');
export function validManualNav(observation,now=Date.now()){
  const o=observation;
  if(!o||o.sourceKind!=='manual'||!Number.isFinite(o.price)||o.price<=0||
     !/^[A-Z]{3}$/.test(o.currency)||!clean(o.sourceDescription)||
     !/^\d{4}-\d{2}-\d{2}$/.test(o.navDate))return false;
  const ms=Date.parse(o.navDate+'T00:00:00Z');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Helsinki',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===o.navDate&&o.navDate>='2000-01-01'&&o.navDate<=today;
}
export function prepareManualFund(input,holdings,{id,now=Date.now(),supportedCurrency}={}){
  if(input.confirmed!==true)throw Error('Vahvista nimi, osuuslaji, valuutta ja lähde.');
  const name=clean(input.name),shareClass=clean(input.shareClass),broker=clean(input.broker),accountLabel=clean(input.accountLabel),currency=clean(input.currency);
  if(!name||name.length>160||!broker||!accountLabel||broker.length>80||accountLabel.length>80||shareClass.length>80)throw Error('Täytä rahaston nimi, palveluntarjoaja ja tilin nimi.');
  if(!supportedCurrency?.(currency))throw Error('Valuutta ei ole tuettu.');
  const number=(raw,positive)=>{if(clean(raw)==='')throw Error('Määrä, keskihinta ja NAV ovat pakollisia.');const v=Number(raw);if(!Number.isFinite(v)||(positive?v<=0:v<0))throw Error('Määrä tai hinta on virheellinen.');return v;};
  const quantity=number(input.quantity,true),buyPrice=number(input.buyPrice,false);
  const quoteObservation={sourceKind:'manual',price:number(input.nav,true),currency,navDate:clean(input.navDate),sourceDescription:clean(input.sourceDescription),recordedAt:now};
  if(!validManualNav(quoteObservation,now))throw Error('Anna positiivinen NAV, todellinen päivä vuosineen ja lähteen kuvaus. Tulevaa päivää ei hyväksytä.');
  if(!id)throw Error('Omistuksen tunniste on virheellinen.');
  if(holdings.some(h=>h.id!==id&&h.assetType==='fund'&&key(h.name)===key(name)&&key(h.broker)===key(broker)&&key(h.accountLabel)===key(accountLabel)))throw Error('Samanniminen rahasto on jo tällä tilillä. Tarkista ja muokkaa olemassa olevaa omistusta.');
  const holding={id,symbol:'',providerSymbol:'',assetType:'fund',name,currency,quantity,buyPrice,
    legacyAccount:broker+' · '+accountLabel,account:broker+' · '+accountLabel,accountType:'FUND',broker,accountLabel,accountDetailsConfirmed:true,accountOriginDerived:true,
    instrument:{schemaVersion:1,companyName:name,isin:'',listingTicker:'',providerSymbol:'',mic:'',exchange:'',dataKey:'',currency,shareClass,assetType:'fund',source:'manual-review',identification:'unverified'},
    sourceBinding:null,quoteObservation,manualPrice:quoteObservation.price,navDate:quoteObservation.navDate,
    quoteSource:'MANUAL_NAV',quoteProvider:quoteObservation.sourceDescription,quoteHealth:{status:'manual_nav',reason:'Käyttäjän syöttämä NAV, ei riippumattomasti varmennettu'},
    trailingPct:12,riskClass:'medium'};
  const reviewed=attachReviewedIdentity(holding,input,now);
  if(reviewed.instrument.isin&&holdings.some(h=>h.id!==id&&h.instrument?.isin===reviewed.instrument.isin&&key(h.broker)===key(broker)&&key(h.accountLabel)===key(accountLabel)))throw Error('Sama ISIN on jo tällä tilillä.');
  const sameInstrument=reviewed.instrument.isin?holdings.find(h=>h.instrument?.isin===reviewed.instrument.isin):null;
  if(sameInstrument&&(key(sameInstrument.name)!==key(name)||sameInstrument.currency!==currency||key(sameInstrument.instrument?.shareClass)!==key(shareClass)))throw Error('ISINin nimi, osuuslaji tai valuutta on ristiriidassa aiemman omistuksen kanssa.');
  const previous=holdings.find(h=>h.id===id);
  const samePreviousIdentity=previous&&(previous.instrument?.isin||'')===(reviewed.instrument.isin||'');
  reviewed.instrument.id=(samePreviousIdentity?previous.instrument?.id:null)||sameInstrument?.instrument?.id||crypto.randomUUID();
  reviewed.accountId=holdings.find(h=>h.accountType==='FUND'&&key(h.broker)===key(broker)&&key(h.accountLabel)===key(accountLabel))?.accountId||crypto.randomUUID();
  return reviewed;
}
export function validateManualFundBackup(h,now=Date.now()){
  validateFundReviewBackup(h);
  if(h.quoteSource!=='MANUAL_NAV')return;
  if(!validManualNav(h.quoteObservation,now)||h.quoteObservation.currency!==h.currency||h.quoteObservation.price!==h.manualPrice||h.quoteObservation.navDate!==h.navDate||h.currentPrice!=null&&h.currentPrice!==h.manualPrice)
    throw Error('Käsin syötetyn NAV:n tiedot ovat ristiriidassa.');
}
