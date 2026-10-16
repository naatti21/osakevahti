/** Strict money/quantity number parser. Preserve empty, invalid, ambiguous and 0. */
export function parseNumber(raw) {
  const original = String(raw ?? '');
  const s = original.trim().replace(/\u2212/g, '-').replace(/[\u00a0\u202f ]/g, '');
  if (!s) return { status: 'missing', raw: original, value: null };
  if (!/^[+-]?[\d.,]+$/.test(s)) return {status:'invalid', raw:original, value:null};
  let canonical = s;
  if (s.includes('.') && s.includes(',')) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    const digits = s.replace(/^[+-]/, '');
    const [integer, fraction, ...extras] = digits.split(decimal);
    if (extras.length || !/^\d{1,2}$/.test(fraction ?? '') ||
      !new RegExp(`^\\d{1,3}(?:\\${group}\\d{3})+$`).test(integer))
      return {status:'invalid',raw:original,value:null};
    canonical = s.replaceAll(group,'').replace(decimal,'.');
  } else if (s.includes(',') || s.includes('.')) {
    const mark = s.includes(',') ? ',' : '.';
    const digitPart = s.replace(/^[+-]/, '');
    const pieces = digitPart.split(mark);
    if (pieces.length === 2) {
      if (!/^\d+$/.test(pieces[0]) || !/^\d+$/.test(pieces[1]))
        return {status:'invalid',raw:original,value:null};
      if (pieces[1].length === 3 && pieces[0].length <= 3)
        return {status:'ambiguous',raw:original,value:null,reason:'tuhaterotin vai desimaali'};
      if (pieces[1].length > 2) return {status:'invalid',raw:original,value:null};
      canonical = s.replace(mark,'.');
    } else if (pieces.length >= 3 && pieces[0].length >= 1 && pieces[0].length <= 3 &&
      pieces.slice(1).every(p => /^\d{3}$/.test(p))) {
      canonical = s.replaceAll(mark,'');
    } else return {status:'invalid',raw:original,value:null};
  }
  const val = Number(canonical);
  if (!Number.isFinite(val)) return {status:'invalid',raw:original,value:null};
  return {status:'valid',raw:original,value:val};
}
