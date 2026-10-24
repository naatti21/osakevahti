# Issue #77 repair 3: valuation quality

One fund-quality predicate checks price, complete NAV date, age, source binding and failed refresh. It qualifies portfolio value, profit and fund rows as estimates while retaining the last known price. Missing price/FX remains unavailable, never substituted with acquisition cost. Uncertain NAV disables portfolio weights, scenario calculations, account aggregates and risk budgets that would otherwise imply verified precision. The existing five-day NAV age policy is reused, not relaxed.

All 27 original audit application cases now PASS, including the six original deterministic failures. Added valuation counterexamples: stale, yearless and missing dates were RED on the prior branch; current dated NAV positive control stays green. Combined run: 31 PASS / 0 FAIL / 0 SKIP.

No stored price, date, cost or quantity changes are made by rendering. An estimate is not a validated new quote. No new market service or calendar assumptions are introduced. Full existing-suite and CI results are in the delivery handoff.

## Independent review follow-up (#82): indicative analytics

The previous blanket disabling of analytics for uncertain NAV has been replaced by a single three-level policy shared by rows, total/profit, accounts, structure, risk and what-if. Complete current dates with a compatible source allow normal calculations. Usable prices with yearless/stale dates, unknown legacy source identity, stale FX or failed refresh of retained prices allow explicitly labelled `≈` indicative calculations. Missing/invalid price or FX and a contradictory stored source binding still block aggregate calculations. No NAV year is synthesized.

The former added policy test that required yearless NAV to disable risk has been updated to the explicitly requested labelled-indicative behavior, with new mixed Nordnet/AOT/OST arithmetic and unavailable controls. The six original audit safety assertions are untouched. Source uncertainty warnings are visible in every affected analysis view; last valid data and acquisition costs are retained.
