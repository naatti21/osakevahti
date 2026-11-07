# v0.2 bounded delivery

## Implemented, not full product acceptance

Branch 1 `feature/radar-v02-evidence-contracts`, base `refactor/private-quote-safety`: listing registry permission/identity gate and dividend event aggregation. Adapters and scheduling deliberately absent until legal/free source evidence exists. A reviewed policy object is an internal adapter contract, not a way to trust arbitrary downloaded metadata. No live universe or new Rocket score is published.

Branch 2 `feature/local-ost-aot-scenarios`, base branch 1: pure local Finnish tax functions and an expandable scenario calculator in the existing dividend panel. Explicit user inputs, 30/34% alternatives, final liquidation, per-acquisition-lot AOT cost allowance, reinvested cost basis and whole-account OST withdrawal math. No portfolio writes, no assumption transmission, no new home cards. Existing data gateway, holdings and backups unchanged. Offline module is precached; cache-version and test-server resource allowlists updated without relaxing assertions.

Scenario convention: annual end-of-year price movement followed by dividend, immediate reinvestment or withdrawal. Zero fees/intermediate trades; initial price normalized to one solely for hypothetical unit math. Constant marginal-rate comparisons are not annual tax assessments; separate capitalTax function covers bracket crossing. A hypothetical new account is explicitly labelled and must never be mistaken for the actual user's OST. No instrument eligibility, tax domicile, foreign withholding or personal concentration verdict is invented. No account recommendation beyond insufficient information is made.

Dividend evidence rejects inconsistent identities, currencies, dates, share bases and economic duplicates. Missing events stay unknown, not zero. Multiple installments aggregate by fiscal year. Capital returns/extra dividends remain separate from ordinary continuity. Completeness certificates require identity, basis, source and matching annual amount. Solvency/growth classification remains unavailable, not automatically “stable”. Supplied numeric corporate examples are not copied as verified live facts; tests use fictional instruments.

## Still blocked / incomplete

NO-GO for publication. The 100 listings/two markets/10 new companies acceptance target has **not** been met. No verified free licensed registry/history/benchmark provider, real two-market ranking, full Rocket scoring, five-year solvency dataset, sector concentration UI, personal eligibility/robust recommendation model or automated issuer evidence ingestion was delivered. Existing legacy screening is still explicitly its old bounded version, not Rocket 2.0. Source policy probes are documented in data-gate.md. Official Vero recheck remains blocked by proxy. No claim of tax/legal certification or physical Android acceptance.

Tests use synthetic data. Targeted scenario browser case covers explicit input rejection, both rates, unchanged localStorage, no transmitted amount, 320/360/412px, and calculation offline after initial load. Full existing PWA suite checks install/update/offline/backup separately. Test results and exact SHA are reported in delivery message. API restriction may prevent Draft PR creation even though Git push works.

Initial full Chromium run: 218 PASS / 2 FAIL. Both failures were strict locator ambiguity after the calculator reused the glossary's `learnHelp` class. Calculator now has its own `accountComparison` component class; original glossary tests and all assertions remain unchanged. This is not a waived regression.
