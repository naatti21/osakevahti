# Structural repair — review handoff (2026-11-07)

## Review order

1. `refactor/private-market-data-contract` → `deploy/osakevahti-alpha-20261013`: shared observation contract and exact-listing Worker route.
2. `refactor/private-watch-news-flow` → `refactor/private-market-data-contract`: bounded/coalesced browser client, own watch analysis, holdings-filtered news, offline dependency closure and test-server updates.
3. `refactor/private-quote-safety` → `refactor/private-watch-news-flow`: dated/currency-checked stock integration, source ordering, missing-data risk guards, public screening validation and explicit live-test separation.

No migrations or new financial storage schema. Portfolio key, holdings, IDs, account metadata, quantities, costs, JSON export/restore and NAV consent remain unchanged. Watch preference shape is unchanged; quota errors no longer mutate it in memory. Private analysis is an ephemeral cache. Only selected listing symbols leave the device: no quantities, account names, costs or portfolio documents. The user-visible watch notice explains the request.

## Proven defects and repairs

- Resolver accepts arbitrary listings but the old quote/status source is a fixed list. `/instrument?symbol=...` now requests the actual listing from the same existing Yahoo provider, with exact returned symbol, currency, price and actual observation time checks. Old `/` and `/status` routes remain compatible; unknown routes return 404. Missing old-route currency/date no longer become EUR/request time.
- Own watch additions previously had no data lookup. They now show available reported trailing dividends and 21/63/126-observation momentum, with source date and ok/stale/unavailable/error states. No invented score, dividend sustainability or future payment is inferred. Missing/invalid history is not zero return.
- Public news was shown regardless of holdings. Dynamic news requires explicit provider related-ticker attribution; public fallback must match a current holding. Removed holdings' news disappears. Unsafe URLs, invalid/future news dates and unrelated symbols are discarded; old news is labelled and excluded from current risk-trigger interpretation.
- Stock refresh now uses the exact-listing route plus compatible legacy fallbacks, rejects explicit currency/listing contradictions, refuses generated-time substitution and retains a newer valid stored quote when a provider is older or fails. Missing price time marks risk data uncertain. Company-specific thesis text and the AMD-only benchmark exception were removed; unknown market context remains unavailable.
- Public screening previously turned missing dividend events into zero dividends and could calculate against invalid history. Actual embedded Python functions now reject invalid symbol/currency/history/events, require adequate history, publish per-row observation dates and record failures. Universe remains **30 configured Radar names / 10 dividend names, at most 8 published rows each**, not all-market discovery. Existing four-hour reuse and explicit UI refresh remain; counts/errors/date are visible. Some sparse provider series will correctly become unavailable rather than receive a score.
- Settings already contains technical feed diagnostics on this Alpha baseline. Home/navigation/theme were preserved instead of unnecessarily rearranged. New analysis lives in the existing Market watch tabs. Removed uncalled `refreshNews`, `companyNews`, `candle` and `atr` helpers after repository-wide call-site search; the used Finnhub key diagnostic remains.

## Test evidence and migrations

Initial full Chromium run: 211 PASS / 5 FAIL. Three failures were external connectivity; two came from the controlled PWA test server omitting the newly added offline module paths. Explicit resource lists were extended, without removing install/update/offline assertions.

A pre-existing Node CacheStorage mock ignored `cacheName`, unlike the real browser API. It was corrected to respect scope while preserving the old-cache rejection assertion.

After making currency mandatory in stock fallbacks, four successful-response fixtures lacked currency. Explicit EUR was added only to those success fixtures (and the timestamp-negative fixture); price, freshness and source-precedence assertions are unchanged. A separate negative test proves absent currency and a fresh generated_at cannot update a holding.

Full deterministic browser run after these corrections: 217 PASS. A further contradictory-identity regression brings the final suite to 218 cases; final SHA checks are reported with delivery. Node contracts include actual embedded screening Python execution (five Python cases), not a mirror implementation. Targeted private/watch UI suite: 10 PASS. QA8 source guards: 15 PASS. 320/360/412 px are covered by existing mobile/PWA tests and new own-analysis layout assertions.

Local browser: system Chromium 154; pinned Playwright 1.57. Dependency versions verified with npm ls. Initial OCR setup could not download traineddata through Node's direct network path. Official English data was downloaded with inherited HTTPS proxy/TLS, cached only locally, then real synthetic pixels → Tesseract tests passed **7/7**; the separate browser CDN-loader check still failed (**1 FAIL**, not skipped). No OCR/application assertion was weakened. Local external suite: **3 FAIL** (FX, public feeds, Worker/live fallback fetches). No local live-source or real Android acceptance is claimed.

## Release blockers / limits

- **NO-GO for deployment until independent review and live integration QA.** New browser functionality requires the separately reviewed Worker `/instrument` deployment. The existing deployed Worker may not offer this route. Old-version schema is rejected visibly and old valid prices remain.
- Existing Yahoo endpoints are reused; availability, exchange coverage, delays and redistribution rights are not guaranteed by synthetic tests. No new provider or paid service was introduced. Dividend events are explicitly reported observations, not an independently certified complete dividend ledger.
- Current 72-hour daily-analysis freshness boundary is conservative, not a full international exchange-calendar service. Intraday valuation/risk still uses the application's existing market-session guards. Existing static risk/market snapshots remain limited; no unsupported issuer is assigned a sector benchmark.
- `index.html` remains a large coordinator, and production data generation still lives in a large Actions workflow. This is a bounded functional repair, not a claim that all architectural debt is gone. Existing manual-edit/save paths were not comprehensively rewritten.
- GitHub API access in this environment returned proxy CONNECT 403. Git push and HTML Actions access are distinct and work. Draft PR creation must not be reported as successful unless an actual PR URL is returned.

Next independent review: verify the three diffs in order, then exercise a permitted live Yahoo listing across two markets/currencies and an installed Android PWA with a synthetic backup. No merges or deployments are authorized by these test results.

Additional RED → GREEN boundary: exactly 253 valid daily observations previously labelled a 200-observation change as “12 kk”. The independent synthetic counterexample returned 131.58% instead of the expected 252.00%. With the now-required 253 observations, the calculation always uses the actual 252-observation interval; the five Python cases pass. This is a demonstrated financial-period correction, not a score-tuning change.
