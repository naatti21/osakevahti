# Private-use structural repair — implementation and test plan

Base: current Alpha `1123b107cb181f7980fb5cc08c77dd3ce0411348`, fetched 2026-11-07. Do not merge the divergent earlier issue77 branches into it. Existing untracked dist-alpha is preserved. No deployment, main changes, portfolio migration, or Larko integration.

## Current flow / audit

- `index.html` is the application coordinator (over 4,000 lines): localStorage state, manual/OCR/CSV review, quote refresh, FX, risk, news, watchlists and rendering. `engine/` contains active import and NAV consent modules; `image-reader.js` is the active local OCR path. Existing source-confirmation gates must remain intact.
- `worker/worker.js` + `worker/wrangler.toml` are the deployed Worker source. `/resolve` searches arbitrary Yahoo instruments, but the default status route quotes six hardcoded Helsinki symbols plus AMD. Search and quote capabilities disagree. Unknown routes also return this status payload. `yahooQuote` defaults missing currency to EUR and Finnhub substitutes request time for missing quote time: neither proves a financial observation.
- `.github/workflows/pages.yml` is simultaneously production deployment and a public data pipeline: fixed quote/fund registry, ten dividend candidates, thirty Radar candidates (only top eight published), seven named news companies, fixed risk metrics and market context. Its four-hour insight and two-hour news reuse are distinct from its five-minute scheduled trigger. Public static feeds cannot learn a private browser's portfolio. They remain bounded screening/fallback inputs, never the ownership authority.
- Alpha's static packaging references production public feeds. The Worker deploys on main worker changes; Alpha/Pages deployment workflows have separate release gates. Feature-branch CI must not trigger them. Live remote deployment contents/credentials are not established by repository code alone.
- `renderWatch` explicitly reports no analysis for custom symbols. `renderNews` takes public feed or saved news wholesale without intersecting holdings. `loadSharedStatus` can overwrite quotes via fixed-key snapshots and generated timestamps. Several legacy direct Finnhub helpers coexist with the newer shared refresh path. Retain helpers until call-site and regression evidence allows removal.
- Risk/FX: the existing valuation-quality guard blocks missing prices/FX and labels estimates. `ownerDecision` still contains an AMD benchmark exception, absent changes become zero through `n()`, and missing quote timestamps do not set `dataStale`. These are follow-up safety repairs, not investment-model expansion.
- The current Alpha does not contain the earlier experimental universal gateway modules. Do not resurrect a second gateway from an unmerged branch. Extend the actual Worker and share pure observation validation with the browser.

## Ordered small review units

1. **Instrument observations**: shared exact symbol/currency/date validation; bounded per-symbol Worker endpoint using existing Yahoo source, explicit statuses and source metadata. Preserve old routes for compatibility. No portfolio/account/quantity/cost sent upstream. Synthetic Worker and contract tests.
2. **Private watch/news flow**: client uses the shared endpoint for user-added supported listings; bounded concurrency, coalescing and request expiry. Separate private additions from public screening; show source time, unavailable/stale/error instead of zero analytics. News must explicitly identify a current holding. Do not invent dividend sustainability scores or label an incomplete dividend event response as zero dividends.
3. **Quality/UI integration**: use validated observations in stock refresh, retain newer good prices on error/older responses; correct missing-date risk handling and remove single-company benchmark exception. Move operational diagnostics to settings, preserve portfolio/backup shape. Regressions and review handoff.

## Tests before acceptance

- New fictional symbols outside all registries; same symbol/different currency rejection; exact provider listing versus ambiguous display names; unsupported instrument types.
- Real provider-shaped synthetic chart/news payloads through Worker → application; null/negative/NaN/Infinity prices, absent/future/old timestamps, currency and symbol mismatch, malformed payload, HTTP failure, timeout, rate limits.
- Momentum minimum history and dividend event integrity/currency/date; missing events are unavailable, never proof of no dividend; older observation cannot overwrite a newer valid price.
- News strict related-symbol matching, safe URLs, removed holdings, empty result versus failure, partial provider support. Bounded static screening counts and publication truncation remain visible.
- Independent per-account holdings, localStorage preservation, historical JSON restore, failed storage commit, FX inversion/missing/stale rates, risk missing timestamps, offline/PWA update, 320/360/412 px.
- Run complete deterministic Node and Chromium suites plus relevant OCR checks. External connectivity is a separate result; mocks and CI do not prove Yahoo availability, redistribution rights, market coverage or Android performance.

Success is a new supported company progressing from explicit user selection to dated quote, available historical analyses and attributable news without a source-code edit. No all-market or guaranteed-provider-availability claim. All release and Worker integration decisions require review.
