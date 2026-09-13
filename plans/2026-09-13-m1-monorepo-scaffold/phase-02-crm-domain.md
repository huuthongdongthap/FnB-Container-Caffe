# M1 Batch 4 Phase 2 — CRM Domain Module (packages/domain/crm)

Priority: P1 · Status: COMPLETE · 2026-09-13 · blocked-by: phase 1 (done)

## Context

- phase-map §2 item 3: `packages/domain/crm` — Customer Events, Visit,
  CRM profile, lookup.
- Customer tables already exist in D1 from batch 1 migration
  (`customer_identities`, `consents`, `customer_events`, `visits` on
  top of `customers`). This module reads them to build a unified
  profile + lookup — **no new DDL**.
- The read-path commands in `packages/domain/customer/` (identify,
  record-visit, record-consent) are the write side; CRM is the read
  side that assembles the staff/owner view.

## Requirements

1. `packages/domain/crm/` exposes:
   - `lookup-profile.ts` — given a phone (or identity), return the
     unified profile: customer record + latest identity + active
     consents summary + recent visits (last N) + recent orders (last N).
   - `crm-profile.ts` — shape the profile for a staff/owner surface
     (name, tier, total visits, last visit, consent flags, preferred
     channel).
   - `index.ts` — public surface re-exports.
   - `package.json` + `tsconfig.json` like customer module.
2. Pure async D1 reads (via the existing db binding passed in) — no
   new state, no new tables.
3. New vitest file `packages/domain/crm/__tests__/*.test.ts` covering
   at least: lookup by phone returns the merged shape; no-match returns
   an empty-but-typed profile; consent summary reduces the rows correctly.
4. Optional (only if cheap, ≤ 1 file touched): migrate the customer
   reads currently inline in `tree/loyalty/process-order.ts` or
   `tree/loyalty/phone-auth-handler.ts` to call this module instead.
   Otherwise record as a follow-up.

## Out of scope

- Writing CRM events / mutations — write side stays in
  packages/domain/customer (identify/record-visit/record-consent).
- Moving the other 102 tree/ files (M2+).
- Owner-dashboard UI that consumes the profile (M3 dashboard).

## Todo

- [x] Create `packages/domain/crm/{package.json,tsconfig.json}`
- [x] Implement `lookup-profile.ts` + `crm-profile.ts` + `index.ts`
- [x] Add `__tests__/lookup-profile.test.ts` with 5 cases (empty
      no-match, merged lookup, consent reduction, toCrmView shape,
      phone fallback)
- [x] Wire `@aura/domain-crm` alias in root + worker tsconfig +
      vitest.config.ts + vite.config.js
- [ ] Optional: migrate 1–2 callers in tree/loyalty to use the new
      module — deferred, recorded as M2 follow-up
- [x] Full suite + tsc green (360 files / 3274 tests)
- [x] Review + commit

## Success criteria

- `packages/domain/crm/` exposes a working lookup that reads existing
  D1 customer tables and returns a typed unified profile.
- New tests cover lookup-by-phone, no-match, consent reduction.
- 359 files / 3269 tests green + new crm tests; tsc exit 0.
- Old tree/ callers still working (shim in phase 1 unchanged).

## Risks

- D1 read shape differs from the typed profile → add a mapper and
  unit-test it in isolation (don't let the worker db binding leak into
  the test — inject a fake or query the local test db).

## Rollback

- Delete `packages/domain/crm/` + revert alias edits. Phase 1
  (customer module) is untouched.
