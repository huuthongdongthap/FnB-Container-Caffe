---
date: 2026-09-13
status: proposed
scope: M1 Batch 6 — Order / Payment / Kitchen domain modules
source: v4 reconciliation item 6 "Order→Payment→Kitchen follow the exemplar pattern"
pattern: batch-4 customer move (package + re-export shim, old path stays live)
---

# M1 Batch 6 — Order / Payment / Kitchen domain modules

## Goal

Move the Order, Payment, and Kitchen bounded contexts out of `worker/src/routes/`
and `worker/src/tree/orders/` into three domain packages under
`packages/domain/{order,payment,kitchen}`, following the batch-4 customer
exemplar:

```
packages/domain/<domain>/
├── model      # entities, invariants (OrderStatus, PaymentStatus, Station)
├── commands   # state-changing use case inputs
├── queries    # reads
├── policies   # business rules (transition guards, refund eligibility)
├── schemas    # zod input/output contracts
├── events     # OrderCreated, PaymentSucceeded, KitchenTicketCreated
├── tests
├── index.ts
├── package.json
└── tsconfig.json
```

Old paths stay live via re-export shims until M2 migrates callers. Nothing
ships without tests green + acceptance per batch (repo-root spec §26).

## Codebase context (scout)

| Domain | Current home | LOC | Files | Has tree/? | Route importers |
|--------|--------------|-----|-------|------------|-----------------|
| Order | `worker/src/tree/orders/` | ~1250 | 13 | YES (13 files) | `routes/orders.ts`, `routes/orders-hono.ts`, `routes/cron-admin.ts` |
| Payment | `worker/src/routes/payments*.ts` + `routes/payments/momo-create.ts` | ~377 | 3 | NO | `worker/src/index.ts` mounts `/api/payments` |
| Kitchen | `worker/src/routes/kitchen*.ts` + `routes/kds*.ts` | ~487 | 3 | NO | `worker/src/index.ts` mounts `/api/kitchen*` |

- **Order** is the cleanest: already a `tree/` module with a unit-testable
  state machine (`order-state-machine.ts`, 69 LOC), clear command/query split
  (create/update/get/split/admin-orders/stats), and a thin route shim
  (`routes/orders.ts` re-exports 7 handlers). Best exemplar candidate.
- **Payment** is route-locked: PayOS create-link (3-retry insert, i18n errMsg
  map), MoMo create, NowPayments. Touches `payments` money table (R18/R19
  brand/money risk). 5+ test files (webhook e2e, momo smoke, refunds).
- **Kitchen** is route-locked: `kitchen-stations.ts` (238 LOC, station
  lifecycle), `kds-mobile.ts`, `kds-stream.ts`. 1 test (`mobile-kds`).
  Frontend `src/pages/KDS.tsx` + 2 components (NOT moved — stays in SPA).

## Work breakdown

| Phase | Domain | Task | Status |
|-------|--------|------|--------|
| 01 | Order | Move `tree/orders/*` → `packages/domain/order/` + shim | proposed |
| 02 | Order | Run order test suite (6+ files) | proposed |
| 03 | Payment | Move payment logic → `packages/domain/payment/` + shim | proposed |
| 04 | Payment | Run payment test suite (5+ files) | proposed |
| 05 | Kitchen | Move kitchen/KDS logic → `packages/domain/kitchen/` + shim | proposed |
| 06 | Kitchen | Run kitchen test suite | proposed |
| 07 | All | Commit + changelog | proposed |

Order first (cleanest, sets the pattern), then Payment (money — needs care),
then Kitchen (largest route surface, fewest tests).

## Acceptance criteria

- 3 new packages: `@aura/domain-order`, `@aura/domain-payment`, `@aura/domain-kitchen`.
- Each package has `main: ./index.ts`, TS path alias wired in root + worker tsconfig.
- Re-export shims at old paths (`worker/src/tree/orders/index.ts`,
  `worker/src/routes/payments.ts` → re-export from domain, etc.).
- All existing tests green (order 6+, payment 5+, kitchen 1+).
- No DDL changes, no new files outside packages + shims + tests.
- Old bundle stays deployable (shims re-export domain).

## Out of scope (explicit)

- No D1 schema changes.
- No frontend KDS page move (`src/pages/KDS.tsx` stays).
- No new payment gateway integrations.
- No route signature changes (Hono router mounts stay in `worker/src/routes/`).
- Catalog exemplar (shifted to M2 per v4).

## Risk

- **R18/R19 (money)**: Payment moves touch `payments` table. Mitigation:
  zero DDL, pure code-move + shim, payment test suite must stay green.
- **Route coupling**: `payments.ts` mixes Hono routing + business logic.
  Mitigation: extract business logic into domain, keep thin route shim.
- **Kitchen test coverage**: only 1 test. Mitigation: move does not add
  behavior; if tests green pre-move, green post-move.

## Verification

- `npm test` (vitest) — full suite green.
- `git diff --stat` shows 3 new packages + 3 shims, no route logic deleted.
- Old paths still importable (shim test).
