# Issue #77 repair 2: fund source identity

Stacked on storage repair; retains current Alpha single-flight refresh. New bindings require the complete normalized catalog name (all class letters/numbers retained) and catalog currency. Re-check edits even when the selected key did not change. No new company exception list or provider is introduced; existing source options supply the identity contract.

Refresh validates known catalog identity and any explicit quote name, ISIN, currency, source key, symbol or share-class metadata, including nested instrument metadata, before updating price/date. Conflicting or uncorroborated explicit metadata rejects the observation and retains the previous NAV. Legacy payloads without identity metadata remain compatible with existing bindings; absence of metadata is not claimed to be external identity verification. Unknown legacy source keys remain preserved.

Conservative limitation: spelling aliases and explicit share classes without matching stored evidence require review instead of fuzzy acceptance. Existing genuinely ambiguous bindings may stop refreshing; retained NAV is not deleted. No identifiers or financial fields are guessed.

New tests: 6 RED / 1 positive control before repair. Targeted post-repair source, refresh preservation and existing source UI cases: 22 PASS / 0 FAIL / 0 SKIP. Original PR #79 assertions are unchanged. Full combined tests follow in the delivery handoff.

## Independent review follow-up (#81)

Formatting aliases now normalize punctuation, Unicode spacing and an optional matching currency suffix, while preserving every name word, class letter and number. This supports catalog Nordnet/Nordea/Handelsbanken spellings and Storebrand A with/without EUR; B remains distinct. No fuzzy overlap, inferred brand rename or new company exception list is added. Other aliases still require authoritative identity evidence rather than guessing.

An unknown historical source key can remain compatible with a legacy observation but `fundBindingMatches` no longer reports it as matched. Accepted quotes record `catalog-compatible` or `unverified-source`, never independent instrument verification. Contradictory observations retain the previous NAV and give an actionable source/class warning. Post-review source controls: 27 PASS, including five new RED→GREEN cases.

The existing `FUND_PAGES` Handelsbanken URL (`handelsbanken-usa-index-a1-eur-348def3b`) proves the provider spelling/class associated with the existing legacy display label. The same catalog option now records that exact alias and A1 class; generic matching consumes those fields. This is source-contract metadata, not fuzzy matching or a new instrument/service. Tests reproduce the formerly rejected A1 alias, accept both documented names and reject B1.

Stored instrument currency/share-class metadata is also checked against the catalog contract. A matching display name cannot conceal a pre-existing B1 or USD contradiction; two additional counterexamples fail before and pass after this guard, retaining the last NAV.

The B1 counterexample initially remained RED because legacy `ensureInstrumentIdentity` rebuilt the instrument and dropped its recorded shareClass. Migration now preserves existing instrument metadata before applying its established normalized fields. Both stored-contradiction cases and all 16 source controls pass after this underlying fix; the intermediate failure remains in the evidence.
