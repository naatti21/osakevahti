# Phase 1 developer results — not release approval

Application baseline: PR #76 `9da5bf1691be2fc0d2955b41c7f4cff6d07b0040`; all application files and existing tests stay byte-identical. Final audit commit SHA and rerun results are supplied in the delivery handoff and CI `phase1-tested-sha.txt`; this document does not invent its own containing commit hash.

## Measured development runs (2026-10-23)

| Run | PASS | FAIL | SKIP | Classification |
|---|---:|---:|---:|---|
| Existing Node/Engine/package, after required local build | 15 | 0 | 0 | Pinned bridge and local package checks |
| Existing QA8 guards | 15 | 0 | 0 | Production AST functions, synthetic resolver/save double |
| Broad legacy browser baseline | 191 | 5 | 0 | Four mocked quote-health timing failures + one live FX network failure |
| Unchanged quote-health file, isolated diagnostic rerun | 12 | 0 | 0 | Confirms timing-sensitive baseline; does not erase first failures |
| New Phase 1 profile incl. reused PWA/source checks | 34 | 6 | 0 | Six ordinary deterministic RED assertions |
| Separate real local PNG/Tesseract/application test | 1 | 0 | 0 | One fictional image, no OCR text substitution |
| Preservation guard | 48 files unchanged | — | — | Byte-for-byte SHA-256 check |

Six current deterministic RED tests:

1. `uncertain NAV must label aggregate valuation as incomplete or estimated: yearless` (R77-02).
2. Same aggregate test with `stale` NAV (R77-02).
3. `different share class cannot bind to A EUR NAV using name overlap` (R77-01).
4. `invalid backup must preserve existing data atomically: invalid-currency` (R77-03).
5. `quote refresh must reject a conflicting instrument identity in a same-key feed record` (R77-05).
6. `legacy backup without position ID must be rejected or acquire a stable unique internal ID` (R77-04).

The positive controls prove unknown fund creation and repeated updates, same-name account separation, cost-only editing, last-price preservation under failed/invalid/older refresh, missing price handling, no invented NAV year, currency rejection, valid backup roundtrip, migration idempotence, fund-commit quota rollback, three mobile viewport widths and existing PWA offline/upgrade behavior. The 34 PASS count includes 13 unchanged source/PWA tests and 21 new application cases. It is not an OCR accuracy percentage or evidence that wrong-class binding is safe.

## Existing-suite failures and setup corrections

The direct FX browser call (`api.frankfurter.dev`) failed with `TypeError: Failed to fetch`. That destination is absent from this environment's enforced network allowlist; classify provider reachability **UNVERIFIED / environment-blocked**, not a deterministic financial calculation bug. No claim that the provider was down for users.

Four initial legacy `alpha-quote-health.spec.mjs` failures: six-fund summary colour, failed-source escalation, reported day/month retention, and verified-date detail display. They use stubbed responses and directly mutate state after calling refresh while the app schedules another refresh at 500ms. All 12 tests in that unchanged file passed on an isolated one-worker rerun. This supports a startup-refresh isolation race, not a live API outage; it is still a coverage reliability issue. Keep the initial red logs and do not report the broad suite as fully green.

Two setup mistakes were diagnosed and corrected without app changes: external config initially served the wrong directory (404 before any browser tests ran), and package tests initially ran before local `build-alpha-pages` produced `dist-alpha` (11 PASS / 4 ENOENT FAIL). Correct cwd and required local build fixed those prerequisites. The first Phase 1 harness also compared state before startup refresh settled and tried to click a collapsed backup panel. Synchronizing with the real refresh and opening the panel corrected those harness defects; financial assertions were not weakened. All initial logs remain in the evidence archive.

## NOT RUN / not proven

- Two unmocked public-feed tests and the `@ocr-stress`/CDN-online suite are excluded from the broad local baseline when their external prerequisites are unavailable; this is an explicit scope limitation, not SKIP/PASS. The ordinary original npm suite is not claimed fully passed.
- No physical Android device, installed mobile-OS PWA, real bank screenshot or personal backup used.
- No full bank/OCR language/contrast corpus accuracy measurement; one real local OCR positive case only.
- No live fund NAV identity proof, paid-provider availability, market-calendar coverage, complete free-data coverage or publication rerun reproduction.
- Proposed model, migration crash recovery, multi-tab concurrency and Engine PR #68 integration are design only, not implemented or tested as working.
- PR #68 adapter contracts were inspected at a locked Git SHA. The current app remains on PR #33; no claim of an Engine upgrade.

## Gate

Phase 1 audit is suitable for independent review. **NO-GO for deployment or everyday-use reliability claims while the RED financial/source/restore cases remain open.** The next action is review of this baseline and approval of a separately scoped first repair PR. Do not start Phase 2 automatically.

## OCR harness timing follow-up

The concurrent final run on audit commit `838eb7d1e9b457ba3a7e64fb63090aba44e5c52a` failed the OCR test at the default five-second element wait. The failure snapshot already contains the correct fictional name and `0,37` quantity. The separate real-OCR profile now waits up to 60 seconds for actual OCR completion; no OCR substitution or financial assertion changed. This failed run is retained, and the delivery handoff records the subsequent exact-commit result.
