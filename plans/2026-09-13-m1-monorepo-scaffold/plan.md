# M1 Batch 4 — Monorepo Scaffold + CRM Domain + Customer Move (D6, D11)

**Status: COMPLETE** — 2026-09-13 · M1 §2 item 1 + item 3
Phase-01 (scaffold + customer move) ✓ · Phase-02 (CRM domain) ✓
Verified: 360 files / 3274 tests green · committed

## Authority

- v4 §20 + phase-map §2 item 1: `apps/{space,ops,hq}` + `packages/` scaffold
- Blueprint §4.1 (approved 2026-09-12): **"monorepo in this repo"** (keeps
  history/tests) — fresh `aura/` root was rejected. Open decision #1
  closed. No new decision needed here.
- D11 (packages/domain/*): domain-file move into packages/domain/customer,
  crm, i18n, db, ui, auth. Phase-map M1 item 2 (domain/customer) and
  item 3 (domain/crm).

## Scope (proposed)

This is the heaviest remaining M1 work — file restructuring without
changing behavior. Split into 2 phases to keep each ≤~15 min safe slice
and keep old tree/ live until the new packages pass their own tests.

**Phase 1 — Scaffold + move `customer` → `packages/domain/customer`**
- Add npm-workspaces to root `package.json`: `packages/*`, `apps/*`.
- Create skeleton: `packages/domain/customer/` (+ `package.json`,
  `tsconfig.json`), `packages/domain/crm/` (empty placeholder),
  `apps/space/`, `apps/ops/`, `apps/hq/` (placeholders).
- Move `worker/src/tree/customer/*` → `packages/domain/customer/` verbatim
  (the 6-file module shipped in batch 1 is already self-contained with a
  public `index.ts`). Re-export from old tree/customer so existing tests
  + `customer-domain.test.ts` still pass immediately.
- Wire tsconfig path aliases (`@aura/domain-customer` etc.) for IDE +
  vitest resolution.
- Gate: existing 359 files / 3269 tests still green after the move
  (no behavior change — old tree/ re-exports the moved code).

**Phase 2 — CRM domain module (packages/domain/crm)**
- New module: `identify-customer`, `lookup-profile`, `crm-profile`,
  `record-visit` (the CRM-lens variants of the customer-module commands
  that query D1 `visits` / `customer_identities` / `customers` and return
  a unified profile for staff/owner surfaces).
- Optional: migrate the callers currently in `tree/loyalty/process-order`
  and `tree/loyalty/phone-auth-handler` that already touch customer data
  — **only if cheap**; otherwise leave follow-up.
- Gate: new crm tests + full suite green; tsc exit 0.

## Out of scope

- Moving the other 102 tree/ files (loyalty, campaigns, referrals,
  orders, analytics, sync, subscriptions, payments, kds, admin) — those
  are M2+ per migration-matrix rows "MOVE packages/domain contexts".
  This batch only moves `customer` (done as a clean exemplar) and
  creates `crm`.
- Stitch one-off archiving (41 files in src/pages/stitch/) — planned M2,
  migration-matrix row 31.
- Catalog consolidation (D10) — M2.
- Rewriting route handlers into packages/api — M2+.
- Any apps/space|ops|hq real content — placeholders only in this batch.

## Decisions resolved

- **Workspace tooling**: **npm workspaces** — already what root
  package.json uses; zero new dependency; vitest + tsc keep working
  without reconfiguration. Pnpm/turborepo deferred (would need
  pnpm-lock.yaml + workspace.yaml / build orchestration moving parts).

## Laws binding this batch

- Blueprint §4.1: monorepo in this repo (approved)
- Repo-root spec §26: old bundle stays deployable — satisfied by
  re-export shim in old tree/customer until callers are migrated
- Phase-map §3 gate: no phase starts before predecessor acceptance green

## Files

- `plan.md` — this file
- `phase-01-scaffold-and-move-customer.md` — scaffold + customer move
- `phase-02-crm-domain.md` — CRM lookup/profile module
