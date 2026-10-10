const TESSERACT_VERSION = "5.1.0";
const TESSERACT_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/+esm`;

let tesseractPromise;

export async function getTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import(TESSERACT_URL).then(mod => {
      const api = typeof mod?.createWorker === "function"
        ? mod
        : typeof mod?.default?.createWorker === "function"
          ? mod.default
          : null;
      if (!api) throw new Error("OCR-moottorin createWorker-rajapintaa ei löytynyt.");
      return api;
    });
  }
  return tesseractPromise;
}

function cleanOcrText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function tsvToLines(tsv, fallbackText = "") {
  const rows = String(tsv || "").split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) {
    return String(fallbackText || "").split(/\r?\n/)
      .map((text, i) => ({ text: cleanOcrText(text), confidence: null, top: i * 20, bottom: i * 20 + 18, left: 0, right: 0 }))
      .filter(row => row.text);
  }

  const header = rows[0].split("\t");
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const grouped = new Map();

  for (const row of rows.slice(1)) {
    const cols = row.split("\t");
    if (cols[index.level] !== "5") continue;
    const text = cleanOcrText(cols[index.text]);
    if (!text) continue;

    const key = [cols[index.page_num], cols[index.block_num], cols[index.par_num], cols[index.line_num]].join(":");
    const left = Number(cols[index.left]) || 0;
    const top = Number(cols[index.top]) || 0;
    const width = Number(cols[index.width]) || 0;
    const height = Number(cols[index.height]) || 0;
    const confidence = Number(cols[index.conf]);
    const word = { text, left, top, right: left + width, bottom: top + height, confidence: Number.isFinite(confidence) ? confidence : null };

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(word);
  }

  return [...grouped.values()].map(words => {
    words.sort((a, b) => a.left - b.left);
    const confidences = words.map(w => w.confidence).filter(Number.isFinite);
    return {
      text: words.map(w => w.text).join(" "),
      confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
      left: Math.min(...words.map(w => w.left)),
      right: Math.max(...words.map(w => w.right)),
      top: Math.min(...words.map(w => w.top)),
      bottom: Math.max(...words.map(w => w.bottom))
    };
  }).sort((a, b) => a.top - b.top || a.left - b.left);
}

export async function extractImageText(file, { onProgress } = {}) {
  if (!(file instanceof Blob)) throw new Error("Kuvatiedosto puuttuu.");

  const { createWorker } = await getTesseract();
  let worker;
  try {
    worker = await createWorker(["fin", "eng"], 1, {
      logger: message => {
        if (typeof onProgress === "function") {
          onProgress({
            status: String(message?.status || ""),
            progress: Number.isFinite(message?.progress) ? message.progress : null
          });
        }
      }
    });

    const result = await worker.recognize(file, {}, { text: true, tsv: true });
    const text = String(result?.data?.text || "").trim();
    const tsv = String(result?.data?.tsv || "");
    return { text, lines: tsvToLines(tsv, text) };
  } finally {
    if (worker) await worker.terminate();
  }
}
