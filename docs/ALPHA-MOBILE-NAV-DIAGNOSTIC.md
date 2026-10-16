# Alpha mobile navigation: reproduced risk-tab overflow

Starting branch: `qa/alpha-main-dashboard-content-overflow-20261014`.
Starting commit: `d216bbe26d3e24bbb7140edac973a48ed6566cd1` (PR #48).
The latest diagnostic audit in PR #48 was read before implementation.
Application identity remains Alpha v2.17.6 with the v2.17.1 rollback design.

## Finding and scope

A fresh mobile Chromium context with synthetic holdings renders the dashboard
within its viewport. Tapping **Riski** produces horizontal document overflow and
moves the fixed bottom navigation below the visible screen, at scale 1 without
editing viewport metadata. The existing dashboard-only tests do not enter this
populated tab and remain green.

The intrinsic width of `.riskHead .name` propagates through its flex title
container into the risk card's implicit grid track. The name is already styled
to ellipsize, but the surrounding card grows before that truncation can work.
The enlarged mobile layout viewport then moves the fixed navigation below the
visual viewport. A temporary browser-only isolation probe removed each risk-card
section in turn: removing the heading/name restored the 320px document width;
removing the decision, action, metrics, explanation or details sections did not.
No application DOM or CSS was changed by the regression test itself.

The only application correction is:

```css
#risks .riskHead>div{width:0;flex-grow:1}
```

This makes the title take its available flex space while preserving the existing
name ellipsis, badge and risk-card layout. No financial JavaScript, storage,
imports, credentials, viewport metadata, navigation positioning, global grid
rules, production configuration or release identity changed. The broad grid,
wrapping and VisualViewport patches from the rejected history were inspected,
not restored.

## RED → GREEN evidence

Local runner: Playwright 1.57.0, real system Chromium 154.0.8037.57, mobile/touch
contexts with synthetic data, 740px visible height, scale 1. This is not a
physical Android or installed-PWA run.

| CSS width | Before: document / nav bottom | After: document / nav bottom |
| --- | --- | --- |
| 320 | 423 / 979 px | 320 / 740 px |
| 360 | 423 / 870 px | 360 / 740 px |
| 393 | 423 / 797 px | 393 / 740 px |

On the unchanged starting application, all three new portfolio/tab scenarios
failed after the touch-driven transition to Riskivahti. The separate zoom/reset
observation also failed when it subsequently entered Riskivahti at scale 1.
These are genuine assertion failures, distinct from an earlier harness-only
duplicate-tracing setup error that was corrected before the RED run.

With the scoped correction, all four new diagnostics and all four existing
dashboard/rollback checks passed (8/8). Native JSON results, screenshot/trace
paths and the final tested SHA are reported in the task handoff; no earlier
commit's green CI is claimed for this change.

The new scenarios exercise actual application rendering of 7 synthetic stocks
and 6 synthetic funds, delayed-quote labels, synthetic asynchronous quote/NAV
refresh, expanded holdings/target details, raw touchscreen tab navigation,
quick-info dialog dismissal, middle/bottom scrolling, 480px-height resize,
landscape and portrait restoration, reload, and unchanged position IDs,
quantities and purchase prices. They record visual/layout viewport geometry,
nav bounds, hit-testing and internal row overflow. Screenshots and traces retain
the visible state; no real portfolio or external financial data is used.

The separate 2× visual-zoom probe is observational. Pinch zoom can clip fixed
layout content by design; that observation alone is not a layout regression or
evidence of the user's zoom setting. Navigation is asserted again after reset.

## Reproduce

Use the repository's pinned Playwright dependency and its existing configuration:

```bash
npx playwright test tests/e2e/alpha-mobile-nav-diagnostic.spec.mjs \
  tests/e2e/alpha-original-layout-rollback.spec.mjs \
  tests/e2e/alpha-real-content-overflow-red.spec.mjs --workers=1 --retries=0
```

The new tests retain traces even when green and attach geometry JSON. For the
local diagnostic a temporary configuration outside the repository selected
`/usr/bin/chromium`, wrote artifacts under `/tmp/osakevahti-mobile-*`, and left
the repository configuration unchanged. CI's Playwright-managed Chromium version
has not been run here. RED can be reproduced by applying only the new test file
to the starting commit, leaving its `index.html` unchanged.

## Limits / next gate

This proves one concrete path to missing navigation, not that it explains every
physical-device complaint. The 320px dashboard `.moveRow` internal mismatch
remains a separate observation: the document and navigation stayed in bounds in
that state. No dashboard patch is justified by that mismatch alone.

Physical Android, installed-PWA/browser-toolbar behavior, keyboard/gesture
occlusion, real OS text scaling, the device's zoom settings and cached
service-worker/update state remain unverified. A fresh privacy-safe device
screenshot with app/Chrome version, mode, zoom and exact steps is still useful
for matching the original complaint. Independent QA, merge and deployment are
not authorized by these automated results. Next: independently review this
commit and verify the Riskivahti transition on the affected Android device.
