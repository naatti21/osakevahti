# Issue #77 phase 2 — identity review and manual SourceBinding

Implements the 5 November 2026 assignment on reviewed Draft PR #95, exact base `f18250812b2b08cd3843ac610c604942cd04bd0d`. Head branch: `feat/issue77-fund-identity-review`. Intended Draft PR base: `fix/issue77-pwa-lifecycle`. No merge/deploy or production data changes.

## Delivered path and trust boundaries

`+ Lisää rahasto` now accepts a name/ISIN search and an optional explicitly reviewed ISIN. Search uses the existing universal gateway `/v1/search` interface. It sends only the query, omits credentials and refuses redirects. The app does not accept user-entered endpoint URLs. Bad ISIN checksum, unrelated ISIN results, incomplete fund metadata and conflicting rows for the same ISIN are rejected. Candidates display full name, class, ISIN, currency, provider and source claims, explicitly **not independent verification**. Changing identity fields resets review; cancelling/reopening invalidates pending requests.

Candidate selection is separate from identity confirmation, source-route confirmation and final position commit. Modified candidate name/class/currency/ISIN cannot be committed by simply ticking the checkboxes again. Users can clear the ISIN and continue name-only without an invented ticker.

Manual NAV remains the actually usable fallback: exact full date, price, currency and source description, KÄSIN and ≈. A valid user-confirmed ISIN is stored as `identification:user-confirmed`, **never externally verified**. Its SourceBinding records `mode:manual`, `automatic:false` and the accepted identity snapshot. Instrument UUID, position UUID, account UUID, SourceBinding and QuoteObservation have separate roles; a new fund on two accounts shares its instrument UUID but has different position/account IDs. Legacy fields and unrelated old records remain intact. Duplicate ISIN on one account is rejected, including a renamed duplicate. Contradictory identity for an existing ISIN is rejected.

Storage still writes the candidate before adopting it in memory. Restore validates manual observation and source-binding consistency before touching storage. The real E2E exports a file, changes cost basis, restores the file and rejects a corrupted binding while preserving the previous holdings. Existing quota-failure tests remain.

## Reuse and automatic-source limitation

- The existing Worker NAV contract is moved to `engine/fund-nav-contract.mjs` and re-exported at its old Worker path. Its ISIN checksum function is shared through `engine/isin.mjs`; no duplicate price parser was introduced.
- Local review uses `engine/gateway-preview.mjs`, the existing source capability registry and shared NAV contract. The gateway candidate retains `requiresManualReview`; the reviewed candidate is not a portfolio write.
- Source eligibility requires locally qualified provider permissions/capability, exact ISIN/class/currency/provider evidence and a valid dated observation. A response flag or user checkbox cannot grant usage rights.
- **No currently registered generic fund-NAV provider meets those production requirements.** The automatic option stays unavailable. Rahastoraportti's existing feature flag and manual-review requirement are not enabled or removed. No new provider is deployed.
- The existing deployed gateway's name/ISIN fund-search coverage has **not been established**. It may return unavailable/503/404 depending on deployment. Search UI and contract behavior are proven with synthetic provider responses; manual ISIN/name entry works without a provider. This is **PARTIAL / NO-GO for verified live identity and automatic NAV**, not a claim that all funds can now be resolved automatically.

## Tests and evidence

RED: the first 360px browser test failed because the identity-search input/path did not exist. GREEN targeted run: **6 PASS**, covering candidate evidence, separate source acceptance, .37 shares, cost vs NAV, valuation, real JSON download/file restore, corrupted-backup rejection, offline reload, a second 4.3-share account, duplicate, cancellation, 429/503 and altered class.

Node suite after the build: **131 PASS / 0 FAIL / 0 SKIP**. New independent Node cases cover invalid/missing/conflicting identity, privacy, provider failures, rights gating, wrong ISIN/class/currency/provider, missing/full NAV dates, explicit confirmation and restore integrity. Prior tests retain 8/14-day and feed-wide stale diagnostics, FX and legacy migration guards. QA8 remains 15 cases. A full deterministic browser run before the final additional class test was **214 PASS**; final whole-suite and GitHub outcomes must be read from the delivery report/linked runs, not inferred from this intermediate result.

PWA cache revision is advanced; all new local dependencies are included in the install-only shell and build allowlist. PR #95's frozen old worker, controller waits and safety assertions are preserved. Only resource allowlists/cache revision were updated in its browser tests. Existing financial assertions were not relaxed. In the two-account test, the pre-existing refresh is awaited before comparing full saved records, so legitimate FX-refresh metadata is not confused with a cancelled import write.

Local live probes on 6 November: OpenFIGI/FX script returned `fetch failed`; gateway HTTPS CONNECT was rejected by the environment proxy with HTTP 403 (no upstream HTTP status). This is an environment limitation, not evidence of provider downtime or data permission. GitHub advisory live smoke is requested separately. No private portfolio or full financial feed is logged.

## CI and release boundary

Test-only workflows are enabled for this exact feature branch: full Quality gate, deterministic suite plus repeated PWA, OCR stress, real CDN OCR, Alpha static package, and advisory public identity/FX smoke. Permissions remain contents:read. No deployment workflow is changed. Production Pages requires a successful Quality gate **on main**; Worker deploy requires main; Alpha deploy requires the dedicated deploy branch. This branch does not satisfy them. No deployment dispatch is made.

No physical Android acceptance, independent financial QA, licensed live-source qualification, or release GO is claimed. Next review must distinguish the working explicit manual fallback from the still-unqualified automatic/source-identity capability. Issue #77 remains open.
