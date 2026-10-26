# Osakevahti Alpha — Universal Market Gateway / Stage 2

Status 2026-10-26: **DRAFT / NOT DEPLOYED / NOT CONNECTED TO THE APP**.

## API

Worker-compatible source: workers/universal-market-gateway.mjs.
Provider: workers/providers/yahoo-experimental.mjs.
No hardcoded instrument allowlist.

- GET /v1/search?q=... discovers possible matches by name, ISIN or ticker. Any Yahoo result is explicitly a **candidate**, not independently verified ISIN/MIC.
- POST /v1/quotes with { "instruments": [{ "ticker": "SAMPLE.HE", "currency": "EUR", "type": "stock" }] }.
- Request data consists ONLY of instrument identities, never quantities, account labels, holdings, transaction history, cost basis, images or API keys.
- Batch <= 8, body <= 12 KiB, origin limited to the known Alpha origin, exact symbol/asset/currency validation, no-store, strict upstream host.
- Response status "candidate" does **not** mean a verified position price. The client must compare to previously user-confirmed source binding. Unsupported / bad upstream is "unavailable" / "rejected"; no zero-price or current-time fabrication.
- For a market quote, quote_at = actual observed trade time or null. fetched_at = read time. These are NOT interchangeable. A fund NAV requires a dated ISIN/share-class-valid provider, not the Yahoo stock candle.
- Search result from Yahoo alone does not verify ISIN, market MIC or share class. No automatic binding based on name or symbol.

## Provider reality

Yahoo search/chart are undocumented/unofficial public endpoints: can return 403/429, can change, and do not prove market-data licensing or long-term quality. Current adapter is an architecture and deterministic mock-test vehicle; it does **not** justify a release or a "universal NAV works" claim. Before any public market display, verify data redistribution/use permissions.

Known older GitHub Pages static SYMBOLS/FUND_PAGES lists and deployed Cloudflare Worker are deliberately unchanged. The new endpoint has not been provisioned or exposed on Cloudflare. The old Alpha index.html remains unchanged and does not reference this gateway.

**Fund coverage remains the biggest open task:** qualify at least one authorized, stable, ISIN-accurate source that supplies fund share class, currency, numeric NAV and actual valuation date. Do not guess Nordea NAV day or hardcode exceptions for new fund names.

## Next integration gate

1. Replace the experimental provider or authorize its limited intended use; qualify exchange/company identity and legal use.
2. Configure a separate staging Worker, with proper platform rate limiting and network timeout, never overwrite the existing production worker. A generic provider adapter can be substituted or added without editing a ticker allowlist.
3. Wire the Alpha client behind an opt-in diagnostic feature: GET candidate search + POST quote candidates. Confirm each uncertain mapping, save only source binding locally; never transmit holdings. Do not force old users through migration, and do not swap old quote values silently.
4. Verify a newly added non-hardcoded stock and ETF, fund when NAV provider exists, wrong ISIN/MIC/currency, provider outage/429, market opening, FX, DST, NAV date, stale price, offline and Android PWA upgrade. Compare against current portfolio, preserving localStorage.
5. Release only when full CI and explicit user acceptance are complete. Keep main and the live Alpha deploy branch untouched until then.

## Tests

tests/universal-gateway.test.mjs covers arbitrary ticker, private-field rejection, candidate-only status, exact provider symbol/currency, full-date NAV requirement, upstream failure, event vs fetch time, bounded search and batch, origin restriction. npm run test:market-gateway is in Quality gate. All external fetches are mocked; passing does NOT establish live provider availability.
