# M1 Batch 1+2 — Customer Domain + i18n Glossary Consolidation

Date: 2026-09-13 · Result: both batches shipped (58ca0f4, d7e9021) · 359 files / 3269 tests green · tsc exit 0 · review PASS

## What shipped

**Batch 1 — Customer domain (58ca0f4)**
- `worker/src/tree/customer/` — identify-customer, record-consent, record-visit, link-order, helpers
- D1 migration 0005 (+down): customers identity/consent columns, customer_events, customer_visits
- Order create/update capture customer identity events on golden-loop spine
- 299-line worker test suite

**Batch 2 — i18n glossary (d7e9021)**
- vi referral labels converged to "Giới thiệu bạn bè" (G10 ratified)
- vi `stitch.accountDashboard.errorDescription` added — error state no longer falls back to en
- glossary.vi-en.yaml ratified + locale regression test guards drift in CI
- 2 out-of-scope pre-existing bugs fixed en route (stash-isolation proven): safeWaitUntil test-crash in phone-auth-handler, promotion-card time-bomb (expiresAt 2026-12-31 fixture + regex collision)

## Decisions

- M1 scope pivoted per v4 reconciliation: customer/data foundation FIRST, Catalog exemplar → M2. Zero-based customer DB is explicit policy (v4 §6), not accident — repo already keyed orders on `customer_phone` with empty-profile customers.
- Rendered-copy change for 2 referral labels ACCEPTED by owner (G10 lineage) — only keys touched in batch 2; additive-only, no renames/deletes.
- Old bundle stays deployable throughout; rollback kept live per repo-root spec §26.

## Lessons

- Mixed flat/nested key structure in locale files is the root of silent i18n drift — the missing vi key existed since the component shipped; only a regression test catches this class. Guard added.
- Test fixtures with absolute dates (`expiresAt: 2026-12-31`) are time bombs — "Con 110 ngay" collided with a loose `/10/` regex ~2027-01-01. Exact-match assertions + relative dates are the fix.
- Hono's `executionCtx` getter throws under `router.request()` in tests — 25+ files use unguarded `c.executionCtx?.waitUntil?.()` with the same latent risk. safeWaitUntil promotion to shared util is a follow-up.
- Glossary ratification BEFORE copy convergence prevents bikeshedding — owner decision recorded in approval-checklist lineage, review had nothing to relitigate.
