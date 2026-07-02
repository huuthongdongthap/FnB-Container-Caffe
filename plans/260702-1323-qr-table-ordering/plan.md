---
title: "QR Code Table Ordering"
description: "Dine-in QR ordering: scan QR at table → order via phone → KDS → serve"
date: 2026-07-02
status: completed
priority: P1
effort: 3d
branch: main
tags: [qr-ordering, dine-in, customer-experience]
---

# QR Code Table Ordering

**Goal:** Allow customers to scan a QR code at their table, browse menu, order, and pay (PayOS/COD) from their phone — orders go directly to KDS.

**Principle:** Convention-based QR URLs (`/menu?table=B01`), minimal backend changes, reuse existing React SPA.

## Phases (4 Parallel Workstreams)

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | Core Flow — table param detection, cart passes table_id, auto-occupy, checkout skip address | 1d | pending |
| 2 | QR Generation Admin — admin page to generate/print QR codes per table | 0.5d | pending |
| 3 | Table Auto-Release — release table on payment webhook / order served | 0.5d | pending |
| 4 | Admin Controls — table occupancy view, status override, QR re-gen | 0.5d | pending |

## Acceptance Criteria

1. ✅ Customer scans QR → opens `/menu?table=B01` → sees table banner
2. ✅ Cart & checkout include `table_id` in order payload
3. ✅ Dine-in orders skip address field (table_id present = dine-in)
4. ✅ Table auto-occupies on order creation (via public no-auth endpoint)
5. ✅ KDS shows table number prominently
6. ✅ Table auto-releases on "served" status or payment confirmation
7. ✅ Admin page generates print-ready QR stickers per table
8. ✅ All existing 1,033+ tests pass — zero regressions

## Key Constraint

No breaking changes to existing routes. BE/contracts extend, not replace.

## Touchpoints

| File | Action | Phase |
|------|--------|-------|
| `src/App.tsx` | MODIFY — add table context provider, detect `?table=` param | 1 |
| `src/hooks/stores/use-cart-store.ts` | MODIFY — add `table_id` to cart state | 1 |
| `src/pages/menu.tsx` | MODIFY — detect table param, show table banner | 1 |
| `src/pages/checkout.tsx` | MODIFY — skip address when table_id present | 1 |
| `src/components/order/checkout-form.tsx` | MODIFY — hide address field for dine-in orders | 1 |
| `src/hooks/stores/use-order-store.ts` | MODIFY — include table_id in createOrder payload | 1 |
| `src/lib/validators.ts` | MODIFY — make address optional for table orders | 1 |
| `worker/src/routes/orders-hono.ts` | MODIFY — auto-occupy table on checkout, auto-release on served | 1, 3 |
| `worker/src/routes/tables.ts` | MODIFY — add public PATCH /tables/:id/occupy & /release | 1 |
| `worker/src/lib/validators.ts` | MODIFY — add tableOccupySchema | 1 |
| `src/hooks/use-kds.ts` | MODIFY — ensure table data passed through | 1 |
| `src/components/kds/OrderTicket.tsx` | MINOR — table number already displayed, verify | 1 |
| New: `src/pages/admin/GenerateQR.tsx` | CREATE — QR generation admin page | 2 |
| New: `src/components/admin/qr-generator.tsx` | CREATE — QR code display + print layout | 2 |
| `src/App.tsx` | MODIFY — add /admin/qr-codes route (protected) | 2 |
| `worker/src/routes/webhooks.ts` | MODIFY — auto-release table on PayOS payment confirm | 3 |
| `worker/src/routes/cron.ts` | MODIFY — nightly stale-order table check | 3 |
| `src/pages/admin/Dashboard.tsx` | MODIFY — add table occupancy widget | 4 |
| `src/pages/admin/TableManagement.tsx` or new | MODIFY/CREATE — table status overview | 4 |

## Dependencies

- Phase 1 blocks Phase 2 (need table data for QR generation)
- Phase 3 depends on Phase 1 (needs occupy/release endpoints)
- Phase 4 depends on Phase 2 (needs QR generation)

## Parallel Execution

Phases 1 & 3 can share backend work (same files: orders-hono.ts, tables.ts).
Phase 2 is pure frontend (can run in parallel if table data is available).
Phase 4 depends on 2.

Execution order: Phase 1 first → Phase 3 (overlap with 1) → Phase 2 → Phase 4.

## Rollback

All changes additive. Revert: `git revert <commit-hash>`. No migration needed (no new DB tables — uses existing `table_id` column in orders).
