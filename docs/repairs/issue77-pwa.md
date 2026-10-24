# Issue #77 repair 4: PWA and regression reliability

Old workers opened caches only after a network response; a response arriving after activation cleanup could recreate the retired cache. Global `caches.match` could then read a retired/sibling entry. The fix acquires a cache handle before network, scopes all reads to that handle, awaits successful-response cache writes and extends the fetch event lifetime. Quota/cache failure keeps valid online responses usable. JSON remains network-only, HTTP errors cannot poison the shell, own-prefix-only cleanup and sibling app caches remain protected.

Four deterministic VM tests execute the actual SW: 0 PASS / 4 FAIL before repair; all pass after repair. A fifth tests online behavior under cache failure. Existing real Chromium PWA cases repeated five times: 35 PASS / 0 FAIL. These complement, not replace, real Service Worker browser tests. Actual old deployed code cannot be retroactively changed: an already-running old worker may still leave a legacy cache; the new worker never reads that cache. Physical installed-Android upgrade still needs independent review.

Cache version and the exact package/browser pins were updated together. No safety assertion was removed. Build initially rejected the stale version pin; fixing the pin and rebuilding makes the source/package equality checks pass.

The existing quote-health test setup now awaits actual startup refresh instead of starting a second manual refresh before its timer fires. All financial assertions remain unchanged. Deterministic full browser profile runs legacy and repair tests on required port 4173. Three external FX/feed connectivity checks have a separate config/job with their real exit status. OCR stress/CDN remains a separately invoked external profile; an actual local fictional PNG/Tesseract/review test is retained as a separate opt-in profile.

No deployment workflow was changed. The added read-only CI workflow checks the exact head and archives evidence even on failure. Results and environment limitations are in the final handoff.

## Independent review follow-up (#83)

The updated predecessor branches are incorporated in stack order without merging any PR or changing Alpha/main. The SW cache/package/browser pins advance together to `alpha-issue77-review2` so the revised application can replace its prior offline shell upon an explicitly approved future release. Added old-runtime import verification removes Intl.supportedValuesOf and structuredClone while testing quota rollback and retry. The full deterministic suite, real local OCR, actual-SW lifecycle and Chromium PWA upgrade/offline tests are rerun on the final head; live providers remain a separate real-status job.
