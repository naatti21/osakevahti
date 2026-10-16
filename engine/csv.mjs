/** RFC-4180-like comma / semicolon / tab tokenizer with strict quote handling. */
const DELIMITERS = ['\t',';',','];
function parseWithDelimiter(source, delimiter) {
  const rows = [];
  let cells = [], field = '', inQuotes = false, quoteClosed = false, started = false;
  let line = 1, rowLine = 1;
  const finishCell = () => { cells.push(field); field=''; started=false; quoteClosed=false; };
  const finishRow = () => {
    finishCell();
    if (cells.some(c => c.trim() !== '')) rows.push({sourceLine:rowLine,cells});
    cells = []; rowLine=line;
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"' && source[i+1] === '"') {field += '"';i++;}
      else if (ch === '"') {inQuotes = false; quoteClosed=true;}
      else if (ch === '\r' && source[i+1] === '\n') {field += '\n'; i++; line++;}
      else {field += ch; if (ch === '\n' || ch === '\r') line++;}
      continue;
    }
    if (ch === '"') {
      if (started || quoteClosed) throw new Error(`Virheellinen lainausmerkki rivillä ${line}`);
      inQuotes = true; started=true;
    } else if (ch === delimiter) finishCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i+1] === '\n') i++;
      line++; finishRow();
    } else if (quoteClosed && !/\s/.test(ch)) throw new Error(`Merkkejä sulkevan lainausmerkin jälkeen rivillä ${line}`);
    else if (!quoteClosed) { field += ch; started = true; }
  }
  if (inQuotes) throw new Error('Sulkematon lainausmerkki CSV-kentässä');
  if (started || quoteClosed || field.length || cells.length) finishRow();
  return rows;
}

export function parseDelimited(text, {delimiter = 'auto'} = {}) {
  const source = String(text ?? '').replace(/^\uFEFF/,'');
  let selected = delimiter;
  if (delimiter === 'auto') {
    const options = [];
    for (const d of DELIMITERS) {
      try {
        const rows = parseWithDelimiter(source,d);
        if (rows.length < 2 || rows[0].cells.length < 2) continue;
        const width = rows[0].cells.length;
        const irregular = rows.slice(1).filter(r => r.cells.length !== width).length;
        options.push({d,width,irregular,rows,score:width * 10 - irregular * 20});
      } catch { /* try the next separator */ }
    }
    options.sort((a,b)=>b.score-a.score || a.irregular-b.irregular);
    if (!options.length || (options[1] && options[0].score === options[1].score))
      throw new Error('CSV-erotinta ei voitu tunnistaa yksiselitteisesti');
    selected = options[0].d;
  }
  if (!DELIMITERS.includes(selected)) throw new Error('Tuntematon kenttäerotin');
  const rows = parseWithDelimiter(source,selected);
  if (rows.length < 2) throw new Error('Tarvitaan otsikkorivi ja vähintään yksi tietuerivi');
  const observations=[], issues=[];
  const width = rows[0].cells.length;
  rows.forEach((row, ri) => {
    if (row.cells.length !== width) issues.push({code:'INCONSISTENT_CSV_WIDTH',sourceLine:row.sourceLine,expected:width,actual:row.cells.length});
    row.cells.forEach((raw, ci) => observations.push({
      id:`csv-r${ri+1}-c${ci+1}`,kind:'cell',raw,table:'main',row:ri+1,column:ci+1,
      sourceLine:row.sourceLine,method:'delimited-text',status:'observed',ocrConfidence:null,box:null
    }));
  });
  return {schemaVersion:1,sourceKind:'delimited-text',delimiter:selected,
    observations,rows:rows.map((r,ri)=>({id:`csv-r${ri+1}`,sourceLine:r.sourceLine,values:[...r.cells]})),issues};
}
