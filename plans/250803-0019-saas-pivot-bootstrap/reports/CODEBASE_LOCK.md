# CODEBASE_LOCK — SaaS Pivot Baseline

**Tag:** `v1.0.0-lock-20260803`
**Date:** 2026-08-03
**Rule:** SaaS pivot phases ADD only. Never REMOVE, RENAME, or BREAK existing cafe operations.

## PROTECTED ZONE (no modification)

| Area | Reason |
|------|--------|
| `worker/src/routes/*.ts` (61 files) | Existing cafe operations — orders, payments, reservations, KDS, tables, loyalty, admin panels, ERPNext integration, Mautic, signage, chat, etc. |
| `worker/schema.sql` (20 tables) | D1 schema — APPEND ONLY. No DROP/ALTER on existing tables. |
| `worker/wrangler.toml` | D1/KV/DO bindings immutable. |
| `src/pages/*.tsx` (cafe pages) | Customer-facing cafe pages: home, menu, order, checkout, table-order, table-reservation, KDS, TVMenu, contact, about, etc. |
| `src/components/cafe-*` | Cafe-specific UI components (admin dashboards, menu renderers, KDS layouts, table management). |

## EXTENSION ZONE (safe to add/modify)

| Area | Scope |
|------|-------|
| `worker/src/routes/saas-*.ts` | New SaaS API routes (saas-pricing.ts, saas-tenants.ts, saas-plans.ts, …) |
| `src/pages/saas/*.tsx` | New SaaS pages |
| `src/components/saas/*` | New SaaS UI components |
| `src/lib/saas-*` | New SaaS utilities |
| `worker/migrations/*.sql` | New DDL via migration files only (`worker/schema.sql` stays append-only) |

## SHARED ZONE (consult before modifying)

| Area | Guidance |
|------|----------|
| `src/lib/validators.ts` | Extend Zod schemas — do not remove existing validators |
| `src/lib/logger.ts` | Add log namespaces — do not change log format |
| `src/lib/format.ts` | Add formatters — do not break VND/date formatting |
| `worker/src/middleware/*.ts` | Auth, audit, logger middleware — extend, do not replace |
| `src/stores/*` | State stores — additive changes only |

## Existing SaaS Collision Surface

- SaaS extensions use `src/pages/saas/…`, `src/components/saas/…`, and `worker/src/routes/saas-*.ts`.
- Existing SaaS-adjacent paths: `src/pages/subscriptions/index.tsx`, `src/pages/checkout.tsx`, `worker/src/routes/subscriptions.ts`. These are PROTECTED; bootstrap maps new behaviour under `saas-/` to avoid partial overlap.
- No two phases may touch the same protected file without an explicit merge window documented in `FILE_OWNERSHIP.md`.

## Git Baseline

`v1.0.0-lock-20260803` tagged and ready to push.
