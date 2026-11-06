const upper=v=>String(v??" ").trim().toUpperCase();
export function validIsin(raw) {
  const s=upper(raw);
  if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s))return false;
  const digits=[...s].map(c=>/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c).join("");
  let sum=0,twice=false;
  for(let i=digits.length-1;i>=0;i--){
    let n=Number(digits[i]);if(twice){n*=2;if(n>9)n-=9;}
    sum+=n;twice=!twice;
  }
  return sum%10===0;
}
