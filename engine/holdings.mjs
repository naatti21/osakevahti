/** Isolated CSV holdings adapter: no market resolver or persistence. */
import {parseDelimited} from './csv.mjs';
import {parseNumber} from './numbers.mjs';

const ALIASES={
 name:['name','nimi','company','yhtiö'],ticker:['ticker','symbol','tunnus','osaketunnus'],
 quantity:['quantity','qty','shares','kpl','määrä'],buyPrice:['buy price','avg price','average cost','gav','keskihinta','hankintahinta'],
 currency:['currency','valuutta'],isin:['isin'],mic:['mic'],account:['account','tili'],
 accountType:['account type','tilityyppi'],broker:['broker','välittäjä']
};
const headerKey = s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const HEADERS = new Map(Object.entries(ALIASES).flatMap(([name,list])=>[name,...list].map(h=>[headerKey(h),name])));
function validIsin(s) {
  if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s)) return false;
  const digits=[...s].map(ch=>/[A-Z]/.test(ch)?String(ch.charCodeAt(0)-55):ch).join('');
  let sum=0;
  for(let i=digits.length-1,pos=0;i>=0;i--,pos++){
    let d=Number(digits[i]);
    if(pos%2===1){d*=2;if(d>9)d-=9;}
    sum+=d;
  }
  return sum%10===0;
}

export function parseHoldingsCsv(input) {
  const table = typeof input === 'string' ? parseDelimited(input) : input;
  const issues=[...(table.issues??[])],records=[];
  const headerNames=table.rows[0].values.map(h=>HEADERS.get(headerKey(h)) ?? null);
  if (new Set(headerNames.filter(Boolean)).size !== headerNames.filter(Boolean).length)
    issues.push({code:'DUPLICATE_SEMANTIC_HEADER'});
  if (!headerNames.includes('quantity') || !headerNames.some(h=>['ticker','name','isin'].includes(h)))
    issues.push({code:'REQUIRED_HEADERS_MISSING'});
  for (let ri=1;ri<table.rows.length;ri++) {
    const row=table.rows[ri];
    const fields={};
    const localIssues=[];
    row.values.forEach((raw,ci)=>{
      const observationId=`csv-r${ri+1}-c${ci+1}`;
      const key=headerNames[ci];
      if(!key) {
        if(String(raw).trim()) localIssues.push({code:'UNMAPPED_NONEMPTY_CELL',observationId});
        return;
      }
      // Keep every observation, including duplicate semantic columns.
      const val={raw,observationId,value:null,status:'unverified'};
      if(key==='quantity' || key==='buyPrice') Object.assign(val,parseNumber(raw));
      else if(!String(raw).trim()) val.status='missing';
      else {val.status='valid';val.value=String(raw).trim();}
      if(['ticker','isin','mic','currency','accountType'].includes(key) && val.status==='valid')
        val.value=val.value.toUpperCase();
      if(key==='quantity' && val.status==='valid' && val.value<=0) val.status='invalid';
      if(key==='buyPrice' && val.status==='valid' && val.value<0) val.status='invalid';
      if(key==='mic' && val.status==='valid' && !/^[A-Z0-9]{4}$/.test(val.value)) val.status='invalid';
      if(key==='isin' && val.status==='valid' && !validIsin(val.value)) val.status='invalid';
      if(fields[key]) {localIssues.push({code:'MULTIPLE_CELLS_FOR_FIELD',role:key}); fields[key].alternatives=[...(fields[key].alternatives??[]),val];}
      else fields[key]=val;
      if(val.status==='invalid' || val.status==='ambiguous') localIssues.push({code:'INVALID_FIELD',role:key,observationId,status:val.status});
    });
    if(!['name','ticker','isin'].some(k=>fields[k]?.status==='valid')) localIssues.push({code:'MISSING_INSTRUMENT_ID'});
    if(fields.quantity?.status!=='valid') localIssues.push({code:'QUANTITY_NOT_VERIFIED'});
    if(!fields.buyPrice || fields.buyPrice.status==='missing') localIssues.push({code:'BUY_PRICE_MISSING_REVIEW'});
    if(fields.buyPrice?.status==='ambiguous') localIssues.push({code:'PRICE_AMBIGUOUS_REVIEW'});
    // Currency is mandatory: absent, empty and malformed codes require review.
    // Do not infer currency from the ticker, broker or market.
    if(!fields.currency || fields.currency.status==='missing')
      localIssues.push({code:'CURRENCY_MISSING_REVIEW',role:'currency'});
    else if(fields.currency.status!=='valid' || !/^[A-Z]{3}$/.test(fields.currency.value))
      localIssues.push({code:'CURRENCY_INVALID_REVIEW',role:'currency',observationId:fields.currency.observationId});
    records.push({sourceRow:ri+1,fields,issues:localIssues,status:localIssues.length?'review-required':'candidate-only'});
  }
  if(!records.length) issues.push({code:'NO_HOLDINGS_ROWS'});
  if(records.some(r=>r.issues.length)) issues.push({code:'AT_LEAST_ONE_UNVERIFIED_RECORD'});
  return {
    schemaVersion:1,adapter:'holdings-csv-experiment',
    records,issues,observationCount:table.observations.length,
    unusedObservations:table.observations.filter(t => t.row>1 && !headerNames[t.column-1]),
    canAutoAccept:issues.length===0 && records.length>0,
    status:issues.length===0?'candidate-only':'review-required',
    source:table
  };
}
