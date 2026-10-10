const CACHE_TTL_SECONDS = 60;
const RESOLVER_CACHE_SECONDS = 300;

const YAHOO_SYMBOLS = {
  FORTUM: "FORTUM.HE",
  "NDA-FI": "NDA-FI.HE",
  VERK: "VERK.HE",
  METSO: "METSO.HE",
  FRAMERY: "FRAMERY.HE",
  IQMX: "IQMX.HE",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

async function yahooQuote(ticker) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?range=1d&interval=1m&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 Osakevahti/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo ${ticker}: HTTP ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${ticker}: no chart result`);

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  let barPrice = null;
  let barTs = null;

  for (let i = Math.min(timestamps.length, closes.length) - 1; i >= 0; i--) {
    const c = closes[i];
    const t = timestamps[i];
    if (Number.isFinite(c) && Number.isFinite(t)) {
      barPrice = c;
      barTs = t;
      break;
    }
  }

  const metaPrice = Number.isFinite(meta.regularMarketPrice)
    ? meta.regularMarketPrice
    : null;
  const metaTs = Number.isFinite(meta.regularMarketTime)
    ? meta.regularMarketTime
    : null;

  const candidates = [
    Number.isFinite(barPrice) && Number.isFinite(barTs)
      ? { price: barPrice, ts: barTs, point: "1m-bar" }
      : null,
    Number.isFinite(metaPrice) && Number.isFinite(metaTs)
      ? { price: metaPrice, ts: metaTs, point: "regularMarketPrice" }
      : null,
  ]
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts);

  const freshest = candidates[0];
  if (!freshest) throw new Error(`Yahoo ${ticker}: price missing`);

  const prev = meta.chartPreviousClose ?? meta.previousClose;
  const dayChangePct =
    Number.isFinite(prev) && prev !== 0
      ? ((freshest.price - prev) / prev) * 100
      : null;

  return {
    ticker,
    price: freshest.price,
    day_change_pct: dayChangePct,
    quote_timestamp: freshest.ts * 1000,
    currency: meta.currency || "EUR",
    source: "Yahoo Finland",
    delayed: null,
    data_point: freshest.point,
  };
}

async function yahooSearch(query) {
  const q = String(query || "").trim().slice(0, 120);
  if (!q) throw new Error("resolver query missing");

  const url =
    "https://query2.finance.yahoo.com/v1/finance/search?" +
    new URLSearchParams({
      q,
      quotesCount: "10",
      newsCount: "0",
      listsCount: "0",
      enableFuzzyQuery: "true",
    }).toString();

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 Osakevahti-InstrumentResolver/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo search: HTTP ${res.status}`);

  const data = await res.json();
  const raw = Array.isArray(data?.quotes) ? data.quotes : [];
  return raw
    .filter((x) => x?.symbol && ["EQUITY", "ETF", "MUTUALFUND"].includes(String(x.quoteType || "").toUpperCase()))
    .slice(0, 8)
    .map((x) => ({
      symbol: String(x.symbol || ""),
      shortname: String(x.shortname || ""),
      longname: String(x.longname || ""),
      exchange: String(x.exchange || ""),
      exchange_display: String(x.exchDisp || ""),
      quote_type: String(x.quoteType || ""),
    }));
}

async function yahooInstrumentMeta(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    "?range=1d&interval=1d&includePrePost=false";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 Osakevahti-InstrumentResolver/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo meta ${symbol}: HTTP ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta || {};
  return {
    currency: String(meta.currency || ""),
    exchange_name: String(meta.exchangeName || ""),
    full_exchange_name: String(meta.fullExchangeName || ""),
    instrument_type: String(meta.instrumentType || ""),
  };
}

async function resolveInstrument(query) {
  const candidates = await yahooSearch(query);
  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return { ...candidate, ...(await yahooInstrumentMeta(candidate.symbol)) };
      } catch {
        return {
          ...candidate,
          currency: "",
          exchange_name: "",
          full_exchange_name: "",
          instrument_type: "",
        };
      }
    })
  );
  return {
    schema_version: "instrument-resolver-v1",
    generated_at: new Date().toISOString(),
    provider: "Yahoo Finance search + chart metadata",
    query: String(query || "").trim(),
    candidates: enriched,
    privacy: {
      accepted_fields: ["company name", "ticker", "ISIN"],
      portfolio_positions_received: false,
    },
  };
}

async function finnhubQuote(symbol, apiKey) {
  if (!apiKey) throw new Error("FINNHUB_API_KEY secret missing");

  const url =
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}` +
    `&token=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Finnhub ${symbol}: HTTP ${res.status}`);

  const q = await res.json();
  if (!Number.isFinite(q?.c) || q.c <= 0) {
    throw new Error(`Finnhub ${symbol}: quote missing`);
  }

  return {
    ticker: symbol,
    price: q.c,
    day_change_pct: Number.isFinite(q.dp) ? q.dp : null,
    quote_timestamp: Number.isFinite(q.t) ? q.t * 1000 : Date.now(),
    currency: "USD",
    source: "Finnhub",
    delayed: false,
  };
}

async function runInBatches(tasks, batchSize = 5) {
  const out = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    out.push(...(await Promise.allSettled(batch.map((fn) => fn()))));
  }
  return out;
}

async function buildStatus(env) {
  const assets = {};
  const errors = {};
  const entries = Object.entries(YAHOO_SYMBOLS);

  const tasks = entries.map(([symbol, ticker]) => async () => ({
    symbol,
    quote: await yahooQuote(ticker),
  }));

  tasks.push(async () => ({
    symbol: "AMD",
    quote: await finnhubQuote("AMD", env.FINNHUB_API_KEY),
  }));

  const results = await runInBatches(tasks, 5);

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      assets[r.value.symbol] = r.value.quote;
    } else {
      const key = i < entries.length ? entries[i][0] : "AMD";
      errors[key] = String(r.reason?.message || r.reason || "unknown error");
    }
  });

  return {
    schema_version: "worker-v1.2",
    generated_at: new Date().toISOString(),
    cache_ttl_seconds: CACHE_TTL_SECONDS,
    assets,
    errors,
    health: {
      ok: Object.keys(assets).length,
      failed: Object.keys(errors).length,
    },
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);

    if (url.pathname === "/resolve") {
      const q = String(url.searchParams.get("q") || "").trim();
      if (!q || q.length > 120) {
        return jsonResponse(
          { error: "Invalid resolver query" },
          400,
          { "Cache-Control": "no-store" }
        );
      }
      try {
        const payload = await resolveInstrument(q);
        return jsonResponse(payload, 200, {
          "Cache-Control": `public, max-age=${RESOLVER_CACHE_SECONDS}`,
        });
      } catch (err) {
        return jsonResponse(
          {
            error: "Instrument resolution failed",
            message: String(err?.message || err),
            generated_at: new Date().toISOString(),
          },
          502,
          { "Cache-Control": "no-store" }
        );
      }
    }

    if (url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          service: "osakevahti-market-worker",
          version: "worker-v1.1",
          time: new Date().toISOString(),
        },
        200,
        { "Cache-Control": "no-store" }
      );
    }

    const cacheKey = new Request(`${url.origin}/status`, { method: "GET" });
    const cache = caches.default;

    if (url.searchParams.get("fresh") !== "1") {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    try {
      const payload = await buildStatus(env);
      const response = jsonResponse(payload);
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return jsonResponse(
        {
          error: "Market data fetch failed",
          message: String(err?.message || err),
          generated_at: new Date().toISOString(),
        },
        502,
        { "Cache-Control": "no-store" }
      );
    }
  },
};
