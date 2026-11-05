# Issue #77 — bounded PWA lifecycle repair

Base: `2078ff2de7e4a290d5e9989335474e86691e3c03`, branch `fix/issue77-fund-onboarding-e2e`.
Working branch: `fix/issue77-pwa-lifecycle`; intended Draft PR base is the preceding development branch, **not main or deploy/Alpha**.

## Proven causes

1. Playwright 1.57.0's `waitForFunctionExpression` calls the predicate and checks the returned object for truthiness before resolving it. An `async` predicate returns a truthy Promise even when its eventual result is false. The former installation/update waits therefore did not enforce controller ownership or completed cache cleanup. This explains the premature `controller:false` assertion and some premature old-cache observations. All four async PWA readiness waits now use `expect.poll(() => page.evaluate(async ...)).toBe(true)`: same predicates and time limits, actual resolved value. The final controller, ownership, offline and data assertions remain unchanged.
2. Independently, the old worker called `caches.open(CACHE)` for every same-origin fetch. If a retired worker handles a late request after deletion, this recreates its obsolete namespace. Two new tests execute the real worker handler in that retired-cache state, online and offline: **2 FAIL before / 2 PASS after**. Existing in-flight deletion and wrong-cache isolation tests remain intact.

## Runtime fix

The versioned application shell is written only by successful install `cache.addAll(SHELL)`. Runtime reads use non-creating `caches.match(...,{cacheName:CACHE})`. Network responses are returned without updating an installed version's immutable offline shell. Failed HTTP responses cannot poison it; cache read failures still permit online operation. Financial JSON stays network-only. Activation still deletes only Osakevahti-owned obsolete caches and claims clients. No localStorage or financial application code changed.

The cache version advances to `osakevahti-shell-v2.17.9-alpha-pwa-lifecycle1`. Future application releases must continue updating the worker/cache revision so the new complete shell is installed. Online HTML can come from the network; offline assets come from a fully installed version rather than a mixture accumulated by runtime writes.

The upgrade fixture now runs a frozen copy of the **actual preceding worker** (from base 2078ff2), rather than synthesizing the old worker from the newly corrected implementation. It verifies legacy holdings survive successful update, offline reload and failed installation, and sibling application caches survive. This fixture is synthetic test infrastructure, never a deployable asset.

## Evidence available before final full-suite run

- Existing real Chromium PWA baseline: **3 PASS / 2 FAIL**. The controller failure varies by scheduling; the upgrade/legacy-cache failure reproduced.
- New retired-worker RED tests: **2 FAIL**; corrected handler: **2 PASS**.
- PWA plus manual fund user flow: **12 PASS**.
- Five repeated runs of all seven PWA lifecycle/HTTP-error tests: **35 PASS**, zero retries.
- Full Node suite after build: **127 PASS / 0 FAIL / 0 SKIP**.
- Import QA8: **15 PASS**.
- Static Alpha build: PASS, local only.

Full deterministic browser command (live provider tests and OCR stress are separately scoped, not disabled in their source):

```
npx playwright test --workers=2 --retries=0 --grep-invert '@ocr-stress|browser fetch from official direct FX|Alpha3 browser gets all six live|Alpha3 original refresh dependencies'
```

Local verification uses Playwright 1.57.0, Node 24.19.0 and installed Chromium 154.0.8037.57 through a temporary config; GitHub uses Node 22 and Playwright's own Chromium. The test cache mock was corrected to implement the real CacheStorage `cacheName` option and simulate read failures, while preserving the wrong-cache and online-response assertions. Package source guards now require install-only writes instead of the obsolete runtime `res.ok` cache-put pattern. Real Chromium HTTP 404/503 preservation assertions are unchanged.

## GitHub execution and scope

`.github/workflows/issue77-pwa-deterministic.yml` runs on pushes to this one development branch, with contents:read only. It builds locally, runs all Node tests, QA8, the complete deterministic browser suite and five repeated PWA runs without retries. It has no deployment steps or secrets. Existing Alpha deployment workflows target the deploy branch or explicit manual dispatch; this branch/base does not satisfy those conditions. No merge/deploy was requested or performed.

Final GitHub job outcome and exact pushed SHA must be checked in the delivery message; workflow presence or a successful push alone does not prove a CI pass. API access may remain blocked. No physical Android test or independent acceptance is claimed. External source/identity, OCR network dependencies and other Issue #77 work are explicitly outside this PWA-only repair.
