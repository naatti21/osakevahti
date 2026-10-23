# Phase 1 audit regression profile

Issue #77, stacked on PR #76. **RED is expected as a finding, but remains an actual failing test/exit code.** No `test.fail`, retries, weakening, test removal or deployment. Application code and prior tests are locked by `baseline-lock.json`.

From repository root, Node 22:

```sh
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
node tests/phase1/verify-baseline.mjs
node scripts/build-alpha-pages.mjs
node --test tests/*.test.mjs
npm run test:qa-import
npx playwright test --config=tests/phase1/playwright.config.mjs
```

The build above only creates local allowlisted `dist-alpha` assets so package tests can execute; it does not publish. Existing repo has no committed npm lockfile: don't mistake this installation for transitive dependency reproducibility.

For a system Chromium set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Optional `PHASE1_JSON` and `PHASE1_OUTPUT` select output files/directories. Tests run on a loopback server at 4182; the config sets repository cwd explicitly. They use new isolated browser profiles, never a user's browser data. PWA tests own their temporary servers, caches and synthetic storage.

The standard Phase 1 profile has 40 tests: 27 new application cases plus 13 reused PR #76/PWA cases. New tests stub financial endpoints and the OCR boundary with declared synthetic observations, while exercising application parsing, review, matching and storage. The generated PNG is NOT represented as having been recognized in this profile. Fixed browser time and awaiting startup refresh make data comparisons deterministic; app refresh itself is not replaced.

## Separate real local OCR

`real-ocr.spec.mjs` is a separate opt-in profile, not skipped inside the main suite. It requires locally prepared Tesseract **5.1.0** assets:

```text
$PHASE1_LOCAL_OCR_ASSETS/tesseract.min.js
$PHASE1_LOCAL_OCR_ASSETS/worker.min.js
$PHASE1_LOCAL_OCR_ASSETS/core/tesseract-core*.wasm.js (+ accompanying wasm files)
$PHASE1_LOCAL_OCR_ASSETS/lang/fin.traineddata
$PHASE1_LOCAL_OCR_ASSETS/lang/eng.traineddata
```

Reuse the Import Engine's documented `scripts/prepare-local-ocr.mjs` assets from a separately verified checkout/cache; do not copy models into this repository or depend on user documents. This session reused existing local Engine assets (Tesseract 5.1.0, tessdata_fast pin `87416417357359cb625c412a48b6e1d6d41c29bd`). Preparing/downloading them is a setup prerequisite, not the test's automatic external dependency. The path can point to a standalone local asset directory.

```sh
PHASE1_LOCAL_OCR_ASSETS=/path/to/verified/ocr-assets npx playwright test --config=tests/phase1/ocr.config.mjs
```

This uses actual application `image-reader.js` + Tesseract fin+eng and the real upload/review/save UI. Only asset locations are routed locally; no recognized text is substituted. The test saves PNG hash, raw OCR TSV/text and a screenshot. Synthetic images/results are ephemeral test artifacts. One successful image establishes that path, not general bank compatibility, class identity verification or OCR accuracy.

## Result interpretation

- `phase1.spec.mjs`: actual application failures under deterministic synthetic responses. Six current RED assertions are audit findings, not transient provider availability.
- Existing `alpha-fund-source-setup` and PWA tests: reused without edits.
- General browser suite still has live-dependent tests. Do not label a failed direct FX HTTP call an application regression. Report those results separately from mocked contract cases.
- CDN online OCR/stress and live public-feed tests require outside network policy/provider availability. If not run, record NOT RUN, not PASS or SKIP.
- Four existing quote-health failures in the broad baseline also involve startup refresh racing direct test state changes; preserve them and investigate in a separate PR. They are not external API outages because their requests are mocked.

`docs/architecture/issue77-phase1-results.md` records actual results and limitations. Independent review and real Android acceptance remain separate gates.

To reproduce the broad existing-suite baseline (including its separately classified LIVE FX test):

```sh
npx playwright test --config=tests/phase1/baseline.config.mjs
```

This uses port 4173 and keeps existing tests unchanged. It does not run the two `alpha-public-live-feeds` cases or `@ocr-stress`/CDN cases; report them NOT RUN. The isolated Phase 1 CI workflow has no external financial API requirement and publishes evidence even when its real RED assertions fail.
