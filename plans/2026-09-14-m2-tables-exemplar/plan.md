# M2 Tables Exemplar — Extract `packages/domain/table`

**Date:** 2026-09-14 · **Pattern:** M2 một-nhịp (extract → migrate → delete, per catalog exemplar) · **Status:** completed

## Goal

Move `worker/src/routes/tables.ts` (204 LOC — `tablesRouter` + `qrRouter` + `CafeTable`/`QrCodeRow` model types) into `packages/domain/table`, migrate all callers, delete the worker copy — same session. Zero DDL, zero contract change, zero frontend impact.

## Scope (user-confirmed)

- **IN:** `worker/src/routes/tables.ts` only — both routers + model types move together (they are one unit: `qrRouter` scans the QR back onto a table).
- **OUT (explicit):**
  - `schemas/tables.ts` (270 LOC, `TableStatusEnum` lowercase 5-value ≠ `CafeTable.status` PascalCase 4-value — schema conflict; shared by `lib/openapi.ts` + `openapi-tables.ts`)
  - `routes/openapi-tables.ts` (530 LOC, schema-coupled)
  - `tree/qr/{signer,generator}.ts` (security primitive, cross-domain: also used by `admin-qr.ts`)
  - `routes/tables-mobile.ts` (75 LOC, uses different status enum — `free/occupied/reserved` — defer with mobile surface)
  - `routes/table-sessions.ts` (256 LOC — separate lifecycle surface, next extract)

## Target structure

```
packages/domain/table/
├── index.ts                  # re-export commands + queries + model types
├── package.json              # @aura/domain-table 0.1.0 (clone @aura/domain-catalog)
├── tsconfig.json             # clone of domain/catalog tsconfig
├── model/table-types.ts      # CafeTable, QrCodeRow
├── commands/tables.ts        # tablesRouter (Hono CRUD + zone/status filters)
├── commands/qr-scan.ts       # qrRouter (GET /:slug — verify sig → resolve table)
└── policies/status.ts        # TABLE_STATUS_TRANSITIONS — pure map (extracted from inline semantics)
```

Deps of moved files repoint via `worker/src/...` alias: `lib/validators`, `tree/qr/signer`, `types/env`, `middleware/{auth,audit-log}`. `qrcode` stays workspace-rooted (already used by tree/qr/generator).

## Policies (D10 pattern)

`policies/status.ts` — `TABLE_STATUS_TRANSITIONS: Record<CafeTable['status'], readonly CafeTable['status'][]>` extracted from current update semantics:
- Any → Available/Occupied/Reserved/Overdue is currently accepted (no transition guard in v1)
- Policy encodes the allowed target set as data so the transition guard becomes enforceable/testable without changing v1 behavior (v1: all 4 targets legal)

## Callers to migrate

| Caller | Change |
|---|---|
| `worker/src/index.ts` L42 | `import { tablesRouter, qrRouter } from './routes/tables'` → `@aura/domain-table` |
| `tests/tables.test.ts` L111 | `await import('../worker/src/routes/tables')` → `await import('@aura/domain-table')` |
| `worker/src/__tests__/routes/tables.test.ts` L2 | `import { tablesRouter, qrRouter, ... } from '../../routes/tables'` → `@aura/domain-table` |

## Delete after migration

`worker/src/routes/tables.ts` (one file — no shim dwell, per một nhịp)

## Config

Add `@aura/domain-table` + `@aura/domain-table/*` aliases → root `tsconfig.json`, `worker/tsconfig.json`, `vitest.config.ts` (alphabetical: after domain-order, before... check existing order — `table` sorts between `order` and... `kitchen`; verify at insert time).

## Phases

1. `phase-01-bootstrap-domain.md` — package skeleton + aliases + model types
2. `phase-02-extract-tables.md` — move routers, extract status policy, repoint deps
3. `phase-03-migrate-delete.md` — migrate 3 caller sites + delete + post-deletion sweep
4. `phase-04-verify-docs.md` — full suite + tsc delta + changelog/journal/phase-map

## Acceptance

- `/api/tables` + `/api/qr/:slug` serve from `@aura/domain-table` — zero route contract change (paths, methods, payload shapes byte-identical)
- QR verify still enforced server-side via `tree/qr/signer` (unchanged)
- Status transitions served via `policies/status.ts` (v1: permissive set, no behavior change)
- Full suite green (baseline: 360 files / 3274 tests) · tsc delta within M1 band (baseline 576 post-catalog)
- Post-deletion full run is the straggler sweep (fcce027 + catalog lessons)
- Zero remaining references to `routes/tables` (bare — `routes/tables-mobile`/`openapi-tables` stay)

## Risks

- `tests/tables.test.ts` mocks `../worker/src/middleware/auth.js` by path — the moved router must import auth via the SAME `worker/src/middleware/auth` specifier or the mock won't bind → mitigated: catalog pattern imports `worker/src/middleware/auth` exactly; vi.mock path in test stays valid (mock applies at module-graph level)
- `qrRouter` shares `QrCodeRow` with QR scan flow → model type moves with routers; `tree/qr/*` imports nothing from `routes/tables.ts` (verified: signer/generator are leaf modules)
- tsc TS2307/TS6059 noise from domain package alias — expected, same class as order/payment/kitchen/catalog (M1 band)
