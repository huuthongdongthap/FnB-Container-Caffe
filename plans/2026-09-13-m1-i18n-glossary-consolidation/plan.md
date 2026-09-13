# M1 Batch 2 — i18n Glossary Consolidation (D9)

**Status: COMPLETE 2026-09-13** — 359 files / 3269 tests green; tsc exit 0;
code-review PASS (`plans/reports/reviewer-260913-m1-batch2-i18n-glossary.md`).

Approved scope 2026-09-13: referral keys + missing vi key only; glossary
ratified. Rendered-copy change ACCEPTED for the 2 referral keys (owner
decision recorded in approval-checklist G10 lineage). No other key touched.

## Requirements (locked)

1. `src/locales/vi.json` — `nav.referral`, `footer.referral`:
   "Giới thiệu bạn" → "Giới thiệu bạn bè" (matches `loyalty.referEarn`,
   glossary referral entry, G10 ratified)
2. `src/locales/vi.json` — add `stitch.accountDashboard.errorDescription`
   (vi translation of en "Could not load your account data. Please check
   your connection and try again.")
3. `.ai/context/glossary.vi-en.yaml` — status "draft — ratify in Phase 1"
   → ratified (2026-09-13), add referral convergence note
4. Add 1 locale regression test (vi referral + errorDescription key
   present) so drift fails CI instead of silently shipping

## Acceptance

- ✅ `npm test` (359 files / 3269 tests) green — includes worker suite
- ✅ tsc clean (exit 0)
- Rendered diff = exactly 2 labels change on FE; missing-key fallback
  disappears on Account Dashboard error state (vi)
- Old bundle deployable; additive-only, no key renames/deletes, no i18n
  library change

## Phases

| # | Phase | File | Status |
|---|---|---|---|
| 1 | Locale edits + glossary ratify + test | phase-01-locale-edits.md | complete |

## Follow-ups from code review (non-blocking)

- Commit `.ai/context/glossary.vi-en.yaml` (currently untracked dir) or
  document local-only
- Glossary test: add en-side referral assertions (vi-only today)
- Promote safeWaitUntil to shared util — 25+ files use unguarded
  `c.executionCtx?.waitUntil?.()` (orders-hono, webhooks, payments,
  refunds) with same latent test-crash risk
- promotion-card fixture `expiresAt: 2026-12-31` flips expired-state
  ~2027-01-01 — consider relative date

## Laws binding this batch

- D9: consolidate to glossary keys; rendered copy identical EXCEPT the
  2 ratified referral labels (owner-approved)
- G10: referral = "Giới thiệu bạn bè" — ratified glossary
- Additive-only; no contract change (key names stable)
- Old bundle stays deployable
