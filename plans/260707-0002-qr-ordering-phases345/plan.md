# QR Ordering — Phases 3+4+5 Implementation

**Created:** 2026-07-07 | **Status:** Phases 1-3 done, 4-5 pending | **Effort:** ~14h

## Overview

Complete QR table ordering: guest ordering page (P3), admin QR generator enhancements (P4), staff table management + E2E (P5). Backend (P1-2) already shipped.

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 3 | Guest ordering frontend | 5h | done |
| 4 | Admin QR generator enhancements | 3h | pending |
| 5 | Staff table management + E2E | 6h | pending |

## Parallel Execution Plan

Stream A: Phase 3 — `TableOrder.tsx` + route wiring + tests
Stream B: Phase 4 — `GenerateQR.tsx` enhancements
Stream C: Phase 5 — `TableManagement.tsx` + KDS integration + tests

## Key Decisions

- Guest endpoint: reuse `POST /api/orders/guest-checkin` (already built)
- Page location: `src/pages/[locale]/order.tsx` + `src/pages/TableOrder.tsx` (redirect root /order)
- QR signing: reuse `worker/src/tree/qr/signer.ts` + `generator.ts`
- Table status: use existing enum `Available | Occupied | Reserved | Overdue`

## Touchpoints

- `src/pages/[locale]/order.tsx` — CREATE (guest ordering)
- `src/App.tsx` — MODIFY (route wiring)
- `src/pages/admin/GenerateQR.tsx` — MODIFY (P4 enhancements)
- `src/pages/admin/TableManagement.tsx` — MODIFY (P5 staff UI)
- `worker/src/__tests__/routes/guest-order.test.ts` — CREATE (TDD)
- `worker/src/routes/tables.ts` — MODIFY (if new endpoints needed for P5)

## Acceptance Criteria

1. Guest scans QR → lands on `/order?table=t01-indoor` → full ordering flow works
2. Invalid/missing table param → graceful "invalid QR" error page
3. Admin can generate/print QR codes per table from GenerateQR page
4. Staff can view/manage table status from TableManagement page
5. All new tests pass; existing tests remain green
6. No breaking changes to existing API contracts

## Out of Scope

- Physical buildout, vendor selection, staffing
- 4 Pillars Integration (separate plan)
- OTP verification (deferred per brainstorm)
- Dwell time analytics (deferred)
