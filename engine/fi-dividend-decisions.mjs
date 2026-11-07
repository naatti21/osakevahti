// Curated issuer source excerpts, reviewed 2026-11-07. Not live market data.
// Amounts are AGM decisions for FINANCIAL years, not calendar-year cash receipts.
export const REVIEW_DAY="2026-11-07";
const fortumShare="https://www.fortum.com/investors/share-information";
const fortumAGM="https://www.fortum.com/en/media/2026/03/decisions-fortum-corporations-annual-general-meeting-2026";
const keskoAGM="https://www.kesko.fi/sijoittaja/osaketieto/osinkopolitiikka-ja-osinko/";
const keskoHistory="https://www.kesko.fi/sijoittaja/osaketieto/osinkopolitiikka-ja-osinko/osinkohistoria/";
const metsoAGM="https://www.metso.com/corporate/investors/governance/agm/2026/";
const metsoPaid="https://www.metso.com/corporate/media/news/2026/10/record-date-and-payment-date-of-metsos-second-dividend-instalment-of-eur-0.20";
export const FI_ISSUER_DIVIDENDS=[
 {issuer:"Fortum Oyj",listing:"FORTUM.HE",exchangeTicker:"FORTUM",shareClass:"yksi osakesarja",
  currency:"EUR",sourceHost:"www.fortum.com",reviewedAt:REVIEW_DAY,
  decision:{fiscalYear:2025,decidedOn:"2026-03-31",amount:0.74,sourceUrl:fortumAGM},
  history:[[2021,1.14,fortumShare],[2022,.91,fortumShare],[2023,1.15,fortumShare],
   [2024,1.40,fortumShare],[2025,.74,fortumShare]],
  installments:[[.74,"2026-04-02","2026-04-14",fortumAGM]]},
 {issuer:"Kesko Oyj B",listing:"KESKOB.HE",exchangeTicker:"KESKOB",shareClass:"B / FI0009000202",
  currency:"EUR",sourceHost:"www.kesko.fi",reviewedAt:REVIEW_DAY,
  decision:{fiscalYear:2025,decidedOn:"2026-03-26",amount:.90,sourceUrl:keskoAGM},
  history:[[2021,1.06,keskoHistory],[2022,1.08,keskoHistory],[2023,1.02,keskoHistory],
   [2024,.90,keskoAGM],[2025,.90,keskoAGM]],
  installments:[[.23,"2026-03-30","2026-04-08",keskoAGM],
   [.22,"2026-07-16","2026-07-23",keskoAGM],
   [.23,"2026-10-15","2026-10-22",keskoAGM],
   [.22,"2027-01-14","2027-01-21",keskoAGM]]},
 {issuer:"Metso Oyj",listing:"METSO.HE",exchangeTicker:"METSO",shareClass:"yksi osakesarja",
  currency:"EUR",sourceHost:"www.metso.com",reviewedAt:REVIEW_DAY,
  decision:{fiscalYear:2025,decidedOn:"2026-04-22",amount:.40,sourceUrl:metsoAGM},
  history:[
   [2021,.24,"https://www.metso.com/corporate/investors/governance/agm/2022/"],
   [2022,.30,"https://www.metso.com/corporate/investors/governance/agm/2023/"],
   [2023,.36,"https://www.metso.com/corporate/media/news/2024/4/resolutions-of-metso-corporations-annual-general-meeting/"],
   [2024,.38,"https://www.metso.com/corporate/investors/governance/agm/2025/"],
   [2025,.40,metsoAGM]],
  installments:[[.20,"2026-04-24","2026-05-04",metsoAGM,"2026-10-21",metsoPaid],
   [.20,"2026-10-23","2026-10-30",metsoPaid]]}
];

const day=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  !Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const amount=n=>typeof n==="number"&&Number.isFinite(n)&&n>0&&n<=1000;
const official=(u,host)=>{try{const x=new URL(u);return x.protocol==="https:"&&x.hostname===host&&x.pathname.length>1}catch{return false}};
const missing=reason=>({status:"unavailable",reason});
const rounded=n=>Math.round(n*10000)/10000;
export function assessFiIssuerDecision(row,asOf=REVIEW_DAY){
 if(!row||!day(asOf)||!row.issuer||!row.shareClass||row.currency!=="EUR"||
  !["www.fortum.com","www.kesko.fi","www.metso.com"].includes(row.sourceHost)||
  !/^[A-Z0-9-]+\.HE$/.test(row.listing||"")||
  row.listing!==row.exchangeTicker+".HE"||!day(row.reviewedAt)||row.reviewedAt>asOf)
  return missing("identity-or-review-invalid");
 const d=row.decision;
 if(!d||d.fiscalYear!==2025||!day(d.decidedOn)||d.decidedOn>row.reviewedAt||
   !amount(d.amount)||!official(d.sourceUrl,row.sourceHost))return missing("decision-invalid");
 if(!Array.isArray(row.history)||!Array.isArray(row.installments)||!row.installments.length)
  return missing("history-or-schedule-missing");
 const years=new Set(),hist=[];
 for(const [year,value,url] of row.history){
  if(!Number.isInteger(year)||year>2025||year<1900||years.has(year)||!amount(value)||
    !official(url,row.sourceHost))return missing("history-invalid");
  years.add(year);hist.push({year,amount:value,sourceUrl:url});
 }
 if(!years.has(2025)||Math.abs(hist.find(x=>x.year===2025).amount-d.amount)>1e-6)
  return missing("history-and-decision-disagree");
 const dates=new Set(),installments=[];
 for(const raw of row.installments){
  if(!Array.isArray(raw))return missing("installment-invalid");
  const [n,recordDate,payDate,sourceUrl,confirmedPaidOn,paidProofUrl]=raw;
  if(!amount(n)||!day(recordDate)||!day(payDate)||recordDate>payDate||
     recordDate<d.decidedOn||!official(sourceUrl,row.sourceHost)||dates.has(payDate))
   return missing("installment-invalid");
  dates.add(payDate);
  if((confirmedPaidOn||paidProofUrl)&&(!day(confirmedPaidOn)||confirmedPaidOn<payDate||
      confirmedPaidOn>row.reviewedAt||!official(paidProofUrl,row.sourceHost)))
   return missing("paid-proof-invalid");
  installments.push({amount:n,recordDate,payDate,sourceUrl,confirmedPaidOn,paidProofUrl,
    state:confirmedPaidOn&&confirmedPaidOn<=asOf?"payment-confirmed":
      payDate>asOf?"approved-future":"approved-past-unconfirmed"});
 }
 if(Math.abs(rounded(installments.reduce((sum,x)=>sum+x.amount,0))-d.amount)>1e-6)
  return missing("installment-total-disagrees");
 hist.sort((a,b)=>a.year-b.year);
 const fullFive=[2021,2022,2023,2024,2025].every(y=>years.has(y));
 const earlier=hist.find(x=>x.year===2024);
 return {status:"ok",issuer:row.issuer,listing:row.listing,shareClass:row.shareClass,
  decision:{...d},history:hist,installments,fullFive,reviewedAt:row.reviewedAt,
  needsReview:Date.parse(asOf)-Date.parse(row.reviewedAt)>120*86400000,
  changeSince2024:earlier?rounded(d.amount-earlier.amount):null,
  confirmedPaid:rounded(installments.filter(x=>x.state==="payment-confirmed").reduce((s,x)=>s+x.amount,0)),
  pendingFuture:rounded(installments.filter(x=>x.state==="approved-future").reduce((s,x)=>s+x.amount,0)),
  sustainability:"Ei arvioitu – vertailukelpoinen kassavirta- ja velkariskiaineisto puuttuu."};
}
