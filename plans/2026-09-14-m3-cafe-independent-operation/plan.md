# M3 — AURA CAFE Independent Operation

**Date:** 2026-09-14 → 2026-09-15 · **Pattern:** M2/M3 một-nhịp (extract → migrate → delete) · **Status:** ✅ DONE (362 files / 3297 tests, tsc +16 legacy band)

## Goal

Achieve full operational independence for AURA CAFE per Master Plan v4 §25:
`OPEN → PREPARE → SELL → PAY → KITCHEN → SERVE → CRM → INVENTORY → RECONCILE → CLOSE`
Enable the café to run independently from Viva Star sales software while retaining Viva Star as an active coffee/raw materials supplier.

## Scope & Phases

1. **Phase 01 — Inventory Domain Extraction (`@aura/domain-inventory`)**
   Extract `worker/src/routes/inventory/*` (crud, transactions, snapshots, order-deduction) to `packages/domain/inventory/`. Migrate callers, delete worker copies.
2. **Phase 02 — Multi-Supplier Purchasing & Recipe Auto-Deduct (BOM)**
   Supplier catalog (Viva Star primary + secondary), PO policies, and recipe/BOM deduction linking `@aura/domain-order` to `@aura/domain-inventory`.
3. **Phase 03 — Shift Cash Reconciliation & Daily Settlement**
   SOP 02 physical cash count vs system payment totals at shift close. Record overage/shortage variance in `@aura/domain-shift`.
4. **Phase 04 — Reservation Domain Extraction (`@aura/domain-reservation`)**
   Extract `worker/src/routes/reservations.ts` to `packages/domain/reservation/`. Connect with table status and customer identity.
5. **Phase 05 — Canonical KDS Consolidation & Owner Dashboard v1**
   Consolidate `/kds` ticket queue routing. Wire daily sales/revenue reporting (`worker/src/routes/reports.ts`) for owner TODAY operational panel.
6. **Phase 06 — Full Verification & Documentation**
   Run full test suite (358+ files), verify tsc within band, update changelog, journal, and phase map.

## Invariants

- **Zero Frontend Impact:** Preserve byte-identical HTTP route paths, query parameters, and JSON schemas.
- **Một Nhịp Standard:** Extract logic, migrate callers, and delete legacy worker files in the same beat with zero lingering shims.
- **Viva Star Truth:** Viva Star remains the primary coffee supplier and brand licensor; software dependency is cleanly decoupled.
