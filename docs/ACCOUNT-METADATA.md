# Account metadata v2 — identity-preserving migration

Status: **draft only**, user approval and independent QA required before merge.

## Why

In an older Osakevahti build, the data migration treated the bank name as a tax account classification (`Nordea → OST`, `Nordnet → AOT`). This is invalid: the same provider can hold AOT, OST, or fund investments. If an older app has already overwritten the original label in localStorage, it cannot reliably reconstruct the lost provider name.

## New fields (per holding)

| Field | Meaning | Migration |
|---|---|---|
| `account` | Existing account/matching key | **Preserve verbatim for old holdings. Never infer from provider.** |
| `legacyAccount` | Provenance of original account label at safe migration time | Set on first migration; for already coerced records this may be the coerced label |
| `accountType` | `AOT`, `OST`, `FUND`, `OTHER` | Existing exact AOT/OST/Rahastot labels only create **suggestions**, not verification |
| `broker` | User-confirmed provider/bank or `Muu` | Exact raw legacy Nordea/Nordnet may suggest broker; never a type |
| `accountLabel` | Optional user nickname, **not** a bank account number | Blank on migration |
| `accountDetailsConfirmed` | User has confirmed BOTH type and provider | **False** for all old holdings without explicit recorded verification |
| `accountOriginDerived` | New-style derived account identity | New manual holding = true; old holding = false/absent |

Broker/category details are **local-only** and exported with JSON backup (the API key is excluded separately).

**Important:** `FUND` is an application presentation category (“Rahastotili”), not a claim about a bank's juridical account product. A user may choose `Muu` instead. An OST cannot hold ETFs or mutual funds. Do not infer tax treatment from these flags.

## User review

- A visible prompt appears if at least one holding lacks verified type+broker.
- Press **Tarkista tilit** to review one holding at a time, with the old account label shown.
- Suggested AOT/OST from old labels are not presented as facts. Provider can be Nordea/Nordnet/Other (optional custom).
- **Myöhemmin** leaves all holdings unchanged and keeps the notice available.
- Confirming updates only the type/broker/nickname fields and verification flag. A legacy `account` label and all financial data remain unchanged.
- Summaries for OST and AOT use **confirmed** categories only. Portfolio total and fund asset calculations remain independent.
- New manual holdings require both type and provider; optional nickname helps distinguish multiple portfolios at the same provider. If unsure, choose `Muu`.

## Import and backup compatibility

- Old JSON backups restore their raw account labels, retain holdings and ask for missing confirmation.
- CSV can provide `account_type` (`AOT`, `OST`, `FUND`, `OTHER`) and `broker`. Both explicit fields are required for the imported record to be marked confirmed.
- Bank-only `account` column is **not** converted to a tax type.
- Subsequent imports without type+broker preserve a prior verified classification for the matching holding.
- If incoming explicit type+broker conflicts with verified metadata for a matching holding, the preview is blocked rather than silently changing identity.
- A missing `account` with explicitly supplied type+broker generates a distinct stable derived account label.
- Baseline import identity/ISIN/MIC protections remain in effect.

## QA before release

`npm test` exercises `tests/e2e/account-metadata.spec.mjs` plus all existing browser regressions.

Key checks: old `Nordea` and `Nordnet` remain untouched; misclassified `OST` can be corrected; old fund labels ask for confirmation; two same-ticker holdings remain distinct; `Myöhemmin` preserves state; manual Other provider; old backup restore; bank-only import and repeated import retain verified category; explicit conflicting imported type is blocked.

Independent QA still needs a mobile screen-size usability pass and a backup restore test with an anonymous historical fixture. NEVER test with real bank account numbers or API keys.

## Release rule

No changes to `main` or GitHub Pages until the independent QA GO and the user's specific merge/deploy approval. This PR does **not** change the current PR #4 SHA used for its independent import QA.
