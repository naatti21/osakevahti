// Alpha-only read-only adapter for pinned Äppejä Import Engine research core.
// Pinned source: naatti21/appeja-import-engine PR #33 @ 8c785bd501a760fbb395d003cd8c41a0e584ad85.
// A matched source value is not independent proof of the correct financial role.
// This module NEVER writes storage, selects instruments, or grants persistence.
import {evaluateImportCandidate} from './engine/acceptance.mjs';
import {parseNumber} from './engine/numbers.mjs';
import {parseHoldingsCsv} from './engine/holdings.mjs';

const MONEY_OR_NUMBER = /[+\-−]?(?:\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)/g;
const TOKEN = /[A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö0-9.^_-]*|[+\-−]?(?:\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)/g;
const CURRENCIES = new Set(['EUR','USD','SEK','NOK','GBP','CHF','DKK','CAD','JPY','AUD']);
const norm = v => String(v ?? '').trim().toUpperCase();

function makeObservations(rows) {
  const observations=[];
  for (let ri=0;ri<rows.length;ri++) {
    const original=String(rows[ri]?.text ?? '');
    const rowNumber=Number.isInteger(rows[ri]?.line)?rows[ri].line:ri+1;
    const id='ocr-row-'+ri;
    // Whole row preserves actual OCR words. Only token-level items are material
    // in the audit, so a label itself cannot certify an unrelated amount.
    observations.push({id,raw:original,material:false,row:rowNumber,method:'ocr-line'});
    const re=new RegExp(TOKEN.source,'g');
    let m,ti=0;
    while((m=re.exec(original))) {
      const raw=m[0];
      const val=parseNumber(raw);
      observations.push({
        id:id+'-token-'+ti++,raw,material:val.status!=='invalid'&&val.status!=='missing' || CURRENCIES.has(norm(raw)),
        row:rowNumber,column:m.index+1,method:'ocr-token',parentId:id
      });
    }
  }
  return observations;
}
function sourcesFor(observations,kind,value) {
  if(value===null||value===undefined||String(value).trim()==='')return [];
  if(kind==='number') {
    return observations.filter(o=>o.method==='ocr-token' && parseNumber(o.raw).status==='valid'
      && Math.abs(parseNumber(o.raw).value-value)<1e-8).map(o=>o.id);
  }
  if(kind==='currency'||kind==='ticker') {
    return observations.filter(o=>o.method==='ocr-token'&&norm(o.raw)===norm(value)).map(o=>o.id);
  }
  return observations.filter(o=>o.method==='ocr-line'&&norm(o.raw)===norm(value)).map(o=>o.id);
}
function field(value,kind,observations,required=true) {
  const exists=value!==null&&value!==undefined&&String(value).trim()!=='';
  if(!exists)return {status:'missing',value:null,sourceIds:[]};
  const refs=sourcesFor(observations,kind,value);
  return {status:refs.length?'verified':'unverified',value,sourceIds:refs};
}
const LABELS={
  MISSING_FIELD:'Tieto puuttuu kuvasta',
  UNVERIFIED_FIELD:'Arvolle ei löytynyt riittävää lähdetodistetta',
  MISSING_SOURCE_EVIDENCE:'Lähdeviite puuttuu',
  UNSUBSTANTIATED_FIELD:'Lähdetieto ei todista arvoa',
  SOURCE_VALUE_MISMATCH:'Lähteen arvo ja kentän arvo poikkeavat',
  UNACCOUNTED_MATERIAL:'Kuvassa on selvittämätön numero tai valuutta',
  INVALID_FIELD:'Virheellinen arvo',
  BLOCKING_SOURCE_ISSUE:'Kuvanlukijan ilmoittama ristiriita',
  NO_INSTRUMENT_ID:'Instrumentin nimi tai ticker puuttuu'
};
export function inspectOcrHolding(holding) {
  const rawRows=holding?.importMeta?.sourceRows;
  const rows=Array.isArray(rawRows)?rawRows:[];
  const observations=makeObservations(rows);
  const i=holding?.instrument||{};
  const meta=holding?.importMeta||{};
  const name=String(holding?.name||'').trim();
  const ticker=norm(i.listingTicker||holding?.symbol);
  const currency=norm(holding?.currency);
  const hasPrice=meta.provided?.buyPrice===true&&Number.isFinite(Number(holding?.buyPrice));
  const quantity=Number(holding?.quantity);
  const fields={
    name:field(name,'text',observations),
    ticker:field(ticker,'ticker',observations),
    quantity:field(quantity>0?quantity:null,'number',observations),
    buyPrice:field(hasPrice?Number(holding.buyPrice):null,'number',observations),
    currency:field(currency||null,'currency',observations)
  };
  // A missing alias must not force a failure when the other identifier is verified.
  if(!name)delete fields.name;
  if(!ticker)delete fields.ticker;
  const issues=(meta.validationErrors||[]).map(code=>({level:'blocking',code:String(code)}));
  if(rows.length===0)issues.push({level:'blocking',code:'MISSING_OCR_SOURCE_ROWS'});
  const decision=evaluateImportCandidate({
    app:'osakevahti',documentType:'holdings',fields,observations,issues,
    accountedEvidenceIds:[]
  });
  const codes=[...new Set(decision.problems.map(p=>p.code))];
  return {
    source:'Äppejä Import Engine PR33 / Alpha OCR bridge',
    status:decision.status,
    canPersist:false,
    readyForReview:decision.status==='candidate-ready',
    problems:decision.problems,
    messages:codes.map(c=>LABELS[c]||c),
    observationCount:observations.length,
    originalRowCount:rows.length
  };
}
export function inspectCsvText(text) {
  // The same LAB research parser is used as a separate read-only quality report.
  // Actual portfolio parsing and the user's explicit commit remain in Osakevahti.
  const result=parseHoldingsCsv(String(text??''));
  return {
    source:'Äppejä Import Engine PR33 / Alpha CSV bridge',
    status:result.status,
    canPersist:false,
    rowCount:result.records.length,
    problems:result.issues.map(x=>({code:x.code})),
    messages:[...new Set(result.issues.map(x=>x.code))],
    originalObservationCount:result.observationCount
  };
}
