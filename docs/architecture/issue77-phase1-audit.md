# Issue #77 — Phase 1 architecture audit and regression baseline

Scope: audit, executable regression oracles and an ordered proposal only. No application changes, migration execution, provider registration, merge or publication.

Issue: https://github.com/naatti21/osakevahti/issues/77

## Locked inputs and preservation

- Isolated Alpha: `deploy/osakevahti-alpha-20261013`, `32c38f12c58e1ccc55bce68b54615a14542cf69b`.
- PR #76: `fix/alpha-fund-data-source-link-health-20261023`, `9da5bf1691be2fc0d2955b41c7f4cff6d07b0040`. This audit branch descends from this head, preserving its source-selection, fund cost editing, health and PWA work.
- Installed Engine bridge: PR #33, `8c785bd501a760fbb395d003cd8c41a0e584ad85`. Four vendored pure modules (`engine/*`) and `alpha-import-engine.mjs`; not the latest research adapter.
- Reviewed Engine PR #68: `445712c37f881085f7f4b41955beec5e3d1ef2b7`, read directly from its Git ref, without merging or modifying that repository.
- `tests/phase1/baseline-lock.json` records SHA-256 for existing application, provider, Engine and test files. They must remain byte-identical in this Phase 1 PR. New tests are additive.

Source locations below refer to the locked PR #76 tree. Function names are more stable anchors than line numbers.

## End-to-end flow and ownership today

| Stage | Actual implementation / dependency | Consequence |
|---|---|---|
| Image acquisition | `index.html:3480` `extractScreenshotOcr` calls `image-reader.js:144` `extractImageText`; Tesseract 5.1.0 fin+eng, CDN worker/core/languages; TSV grouped into lines with coordinates | Local recognition, but cold-start availability depends on several external asset hosts. Installed PWA shell does not precache OCR models. General OCR test hook is also present in application code. |
| General screenshot parsing | `runOcrCandidateImport`, `parseScreenshotHoldings`; source rows/identifiers and validation errors collected; `inspectOcrHolding` adds Engine evidence report | Parsing and semantic roles live largely in the application. Adapter matches numeric token values; a token match is not proof of its financial role. |
| Fund screenshot diversion | `isFundOverviewOcr` diverts to `populateFundTrialFromOcr`; `fundTrialHints` scans up to ten previous text rows, removes metric-like text and takes last two name parts | Separate parser discards geometry/source IDs from its review rows. Its name cleaner and decimal parser duplicate research Engine responsibilities. It does not use Engine source-linked fund review. |
| CSV/TSV | `importTableText` runs BOTH Engine `inspectCsvText` and application `parseImportTable`/`holdingFromImportRow` | Two parsers can disagree on aliases, numbers, requirements and row roles. Engine output is advisory; it is not the sole canonical parse or persistence gate. Missing cost becomes numeric zero plus a `provided` flag in the application. |
| Instrument search | `fetchInstrumentCandidates` → Worker `/resolve` → Yahoo search + chart metadata. Browser `scoreInstrumentCandidate`, `instrumentIdentityConflict` and ISIN checks decide candidate status | Search and chart metadata do not supply a universally verified ISIN. Currency/market/type/score guards exist, but names, listings and instrument identity remain conflated. No new fund data source follows automatically from resolver success. |
| Existing holding match | `holdingIdentityKey`, `holdingFallbackKey`, `findExistingHoldingMatch`, `mergeImportedHoldings` | Composite textual account + ISIN/listing/company + venue + currency. Useful conflict guards exist, but display labels carry identity and aliases/data keys overlap. Fund trial instead offers explicit holding IDs, ranked by name. |
| New holding | Generic import uses merged records; fund trial creates UUID holding, blank ticker/ISIN, user-confirmed name/account/quantity/cost and `identification:'unverified'` | Unknown fund creation already works without a listing ticker. It requires entered cost in this Alpha flow. Instrument and position still live in the same record; no reusable instrument registry is created. |
| Account | `migrateAccountDetails`, `derivedAccountName`, `confirmAccountReview` | Legacy raw `account` preserved; type/broker suggestions are not verification. Good safeguards. Yet account identity is still mutable human text; no independent account UUID or authoritative broker namespace. |
| Source binding | Seven hardcoded `<option>` entries in `fundPriceSource`; fuzzy name check in `saveHolding` around line 2014; `h.fundQuoteKey || h.symbol` used at refresh | Separate source selection is an improvement in PR #76. Still no persisted class/ISIN/provider-identity evidence; changed mapping check accepts two shared meaningful name tokens. Existing mappings are not revalidated at refresh. |
| Feed production | `.github/workflows/pages.yml:236` `FUND_PAGES` has six hardcoded URLs; Nordnet regex reads day/month, Nordea branch no NAV date; returned `timestamp` is fetch time | UI's seventh option depends on separate feed PR #75. Alpha code and published main feed can disagree. Source parser omits currency/ISIN/class proof from its payload. No arbitrary URL is currently exposed to users; preserve this restriction. |
| Refresh | `refreshMarket` around line 2248 checks positive numeric quote/currency/time, preserves prior verified price if new date missing/older; quote date and health check time separated | Good failure preservation and no fabricated NAV year. However `quotedCurrencyMatches` accepts a missing quote currency, and same-key quotes ignore contradictory instrument metadata. Multiple async consumers mutate shared `state`. |
| Valuation | `render` around line 1183 selects current/manual price, quantity and FX; `valuationIncomplete` only checks positive price/FX; `portfolioValue` around line 1316 | Missing prices block totals, but a positive yearless/stale NAV yields an apparently exact aggregate. Item-level health notice does not propagate completeness to totals. Acquisition cost is per-unit, not NAV. |
| Persistence | `save` replaces one `osakevahti.single.v1` JSON value. Generic import sets memory before `save`; fund trial rolls back on storage error; restore validates, writes then adopts memory | Three transaction styles. No repository revision check or atomic multi-tab conflict guard. Memory/storage divergence on generic save failure is a code-level risk; fund rollback is tested. |
| Backup/restore | `exportBackup` excludes `apiKey`; `validateBackupForRestore` validates numbers/duplicate supplied IDs; `importBackup` merges envelope then runs migration | Valid roundtrip works; negative numbers are rejected. Holding currencies are not checked against a supported set and absent position IDs are accepted without assigning stable IDs. No top-level schema/versioned migration plan. |
| PWA | `sw.js` versioned own-prefix caches, `skipWaiting`/`clients.claim`, offline shell fallback, same-origin JSON network-only | Existing update/offline/failure tests use real Service Workers. Financial data is not made fresh by shell caching. Multi-tab unsaved-review update policy is untested. OCR offline capability differs from shell offline capability. |

### Hardcoded registries and hidden dependencies

In addition to `FUND_PAGES` and the fund selector, inspect `LEGACY_DATA_KEYS`, `migrateState.targetDefaults`, `isHelsinkiHolding`, `finnhubSymbol`, Worker `YAHOO_SYMBOLS` and its AMD-specific fetch, plus the lists embedded in Pages' data scripts. They mix compatibility aliases, investment-policy defaults and provider routing. Preserve legacy aliases as migration metadata, but stop using them as a requirement for onboarding new instruments.

`index.html` owns rendering, parsing, matching, price policy, persistence and orchestration. Shared mutable `state`, startup refresh after 500ms, minute refresh, visibility refresh, global pending drafts and global source caches are hidden dependencies of tests and editing flows. The new tests wait for real startup refresh to finish before comparing data; they do not disable it or relax financial comparisons.

The repository has no committed lockfile in this baseline. Top-level test dependencies are exact versions, but transitive installation reproducibility needs its own scoped PR. Public Pages data and Alpha deployment have distinct branches/origins but runtime data is still linked. The reported Pages rerun error (`Multiple artifacts named github-pages`) is an issue-supplied incident; it was NOT independently reproduced or fixed here. `pages.yml` combines fetching, artifact upload and publication. Split that operational concern in a separate future PR.

## Risk register

Priority meanings: P0 = potential loss/corruption of saved financial state; P1 = incorrect financial interpretation, source identity or unusable holding; P2 = maintainability/coverage/operational fragility. A code risk is not labelled a proven user incident.

| ID | Priority | Evidence / status | Required future boundary |
|---|---|---|---|
| R77-01 | P1 | **Reproduced RED:** `Storebrand Japan B EUR` can select `STOREBRAND_JAPAN_A_EUR`; name overlap is accepted despite different class. PR #76's completely-different-name and wrong-currency controls still PASS. | Exact reviewed instrument/class/currency binding, not fuzzy-name approval. |
| R77-02 | P1 | **Reproduced RED (two cases):** yearless and stale NAV retain item warnings but total is neither missing, incomplete nor approximate. | Quote eligibility/coverage must be shared by every aggregate and performance calculation. |
| R77-03 | P0 | **Reproduced RED:** malformed backup holding currency `NOT-A-CURRENCY` replaces the existing synthetic portfolio. This proves invalid import replacement, not spontaneous loss or physical-user impact. | Validate the whole candidate and preview replacement before one atomic commit; keep rollback snapshot. |
| R77-04 | P1 | **Reproduced RED:** legacy restore accepts missing holding ID and does not assign one. | Reject or explicitly migrate with persisted stable internal IDs; never infer instrument identity. |
| R77-05 | P1 | **Reproduced RED:** same-key quote carrying a contradictory synthetic instrument ID/name updates price. Current feed omits those fields, so this is a boundary counterexample, not evidence that the live provider currently sends bad identity. | Source adapter must authenticate supported binding and reject contradictions; unsupported proof stays unverified. |
| R77-06 | P0 | **Code risk, not crash-tested here:** `commitPendingImport` mutates memory before storage and lacks fund trial's rollback. Shared state also lacks concurrent revision fencing. | Pure commit plan, validate current revision, single storage transaction, adopt only after success. |
| R77-07 | P1 | **Observed architecture:** fund review loses source geometry and bypasses Engine review; CSV parses twice. | One pinned parse/evidence contract, separate application commit gate. |
| R77-08 | P1 | **Observed architecture:** finite fund catalog and ticker/data-key aliases; no general dated manual NAV capture. | Dynamic instrument registration and labelled manual quote path, provider capability registry. |
| R77-09 | P2 | Existing quote-health tests mutate state while startup refresh may still run; fresh run results vary. They use mocks, so failures must not be called live-provider outages. | Fix harness synchronization in a separate test-only PR, retain existing oracles. |
| R77-10 | P2 | Live FX endpoint inaccessible in this environment; production feed/CDN readiness not established. Pages rerun incident remains unverified. | Separate deterministic gates and observable live-provider diagnostics; data publication separate from app deployment. |

No inference that every fund can get free automated NAV. No generic scraping endpoint or user-supplied arbitrary URL should be introduced to hide source coverage gaps.

## What the tests do and do not establish

`tests/phase1/phase1.spec.mjs` drives actual browser UI, storage and refresh. Generated fictional PNGs use a declared deterministic OCR-boundary double in the main matrix; this isolates application errors from OCR variability. A separate opt-in test drives the actual `image-reader.js`, real locally served Tesseract and generated pixels, then explicit user review and persisted synthetic holding. That one image is not general OCR accuracy.

The main matrix covers unknown named fund creation (public compatibility name and an unseen fictional name), repeated update, two accounts, cost-only editing, missing/invalid/stale/yearless NAV, HTTP 503 preservation, currencies/class/source contradictions, JSON roundtrip and legacy migration, storage quota failure, mobile tabs/geometry. Existing PR #76 source guards and real Service Worker offline/update/failed-install tests are reused unchanged. A downloaded backup is compared to its original synthetic holdings and restored through the file picker.

All new tests use isolated browser profiles and synthetic records. Remote financial requests are fulfilled by deterministic test responses; no live provider response is asserted as truth. Frozen application files and previous tests remain unchanged. Red assertions are ordinary failures, not `test.fail`, skips or expected failures.

See `tests/phase1/README.md` for commands and `issue77-phase1-results.md` for actual counts, setup errors, red test names and limitations. Physical Android/PWA behavior, real bank screenshots, broad OCR-language coverage, public feed correctness, live provider availability and PR #68 production integration remain unverified.
