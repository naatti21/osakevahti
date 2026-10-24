# Issue #77 repair 1: storage integrity

Base: current Alpha `5a343e61d7dd35b11ed37f2e03ddd07f36f736b7`. PR #79 tests were copied, not merged. Its 27 application oracles are unchanged; no audit preservation guard is applied to repairs.

CSV and generic OCR shared final commit previously adopted holdings before localStorage succeeded. It now stages a deep candidate, validates all holdings, persists once and only then adopts memory; failure preserves the review draft for retry. Fund-specific rollback remains intact.

Backup restoration rejects unsupported ISO holding currencies, including malformed/pseudo codes, before any write. It preserves supported currencies beyond the editor's five choices (CHF/JPY/CAD controls). Historical missing internal position IDs acquire unique IDs in the staged candidate only; existing IDs, financial identity and account metadata remain unchanged. Numeric legacy IDs remain accepted. No ticker, ISIN, date or price is generated.

No schema rewrite or deployed storage migration. Runtime needs `Intl.supportedValuesOf`, already available in tested Chromium; older browsers need separate compatibility review. User backups and Palkka are untouched.

Current Alpha reproduction: original 27 audit cases = 21 PASS / 6 FAIL; both added CSV/OCR quota counterexamples fail before repair. Subsequent targeted results are recorded in the delivery handoff. The remaining source/valuation RED cases are repaired in separate stacked branches.

## Independent review follow-up (#80)

Currency validation now uses a pinned code catalogue rather than requiring `Intl.supportedValuesOf`. Candidate cloning has a JSON-compatible fallback after validation. Browser tests remove both newer APIs and verify CHF/JPY/CAD restoration plus rejection of ZZZ. Missing historical currency remains missing (including instrument metadata); the row stays visible and unvalued with an actionable edit warning, rather than guessing EUR. Restore accepts this explicitly incomplete legacy state, while new imports still require currency. Unchanged incomplete rows no longer block unrelated valid imports. The editor preserves additional legitimate currencies and requires explicit currency selection for incomplete rows. Quota/ID/metadata guarantees remain unchanged.
