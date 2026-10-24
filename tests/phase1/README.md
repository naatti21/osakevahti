# Issue #77 repair verification

These branches start at Alpha `5a343e61d7dd35b11ed37f2e03ddd07f36f736b7`; PR #79 is not merged. `phase1.spec.mjs` is the unchanged original 27-case application regression oracle, with its synthetic fixtures/helpers. Additive storage, identity, valuation and SW tests cover the repairs. No expected failures, retries or skipped safety tests.

From repository root (Node 22 recommended):

```sh
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
node scripts/build-alpha-pages.mjs
node --test tests/*.test.mjs
npm run test:qa-import
npx playwright test --config=tests/phase1/full.config.mjs
```

The local build only prepares `dist-alpha`; it does not deploy. The package guard pins the exact SW version. Playwright starts its own loopback server from repository root (4173 for existing tests that require that origin). `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` supports installed system Chromium. `PHASE1_JSON` / `PHASE1_OUTPUT` set evidence locations.

`full.config.mjs` isolates deterministic application checks from three live FX/public-feed connectivity checks. Run the latter with `external.config.mjs`; report their actual FAIL/NOT RUN independently, not as passing application coverage. CDN/OCR stress remains available through `npm run test:ocr`; it is NOT RUN unless explicitly executed. Existing default `npm test` is unchanged and is not represented as equivalent to the deterministic profile.

For actual local fictional PNG → Tesseract fin+eng → application review/save:

```sh
PHASE1_LOCAL_OCR_ASSETS=/path/to/verified/ocr-assets npx playwright test --config=tests/phase1/ocr.config.mjs
```

Assets: Tesseract 5.1.0 `tesseract.min.js`, `worker.min.js`, `core/tesseract-core*.wasm.js` and accompanying WASM; `lang/fin.traineddata`, `lang/eng.traineddata`. This environment reuses existing local Import Engine assets without modifying that repository. Original model pin: tessdata_fast `87416418657359cb625c412a48b6e1d6d41c29bd`. The test records actual OCR TSV/text, PNG and review screenshot; no OCR result is substituted. The ordinary suite explicitly uses synthetic OCR-boundary doubles, so it is not an OCR accuracy measurement.

Every profile uses isolated synthetic browser storage. No personal financial documents or user storage are accessed. New CI is non-deploying, permissions contents:read; external checks retain their own actual job status. Independent review and physical Android acceptance remain separate.
