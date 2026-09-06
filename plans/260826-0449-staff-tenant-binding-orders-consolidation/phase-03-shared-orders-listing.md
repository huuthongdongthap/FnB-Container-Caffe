# Phase 03 — Shared orders listing module

## Overview
- Priority: P2 | Status: pending | Depends: Phase 02
- One SQL-builder module feeds both admin listing and KDS listing; response contracts unchanged.

## Related Code Files
- Create: worker/src/tree/orders/shared-listing.ts (<200 LOC)
- Modify: worker/src/tree/orders/admin-orders.ts (delegate query build)
- Modify: worker/src/routes/orders-hono.ts GET /kds (~line 84)
- Test: payload parity snapshots

## Design

```ts
// shared-listing.ts exports:
buildOrderListQuery(opts: {
  statuses?: string[];        // kds: [status,'preparing'] / admin: single status
  paymentJoin?: boolean;      // admin true
  limit?: number; offset?: number;
  sort?: 'created_at'|'total'|'status'; order?: 'ASC'|'DESC';
  tenantIdSlot?: string;      // reserved param — unused today, wired when business-table tenancy lands
}) => { sql: string; params: unknown[] }
```

## Implementation Steps

1. Capture baseline: snapshot current JSON responses of `/api/admin/orders?status=…` and `/kds/orders/kds` from existing test fixtures BEFORE refactor.
2. Extract query construction from admin-orders.ts into shared-listing.ts; admin handler calls it, maps rows as today.
3. KDS handler delegates its fixed query through same builder (statuses=[raw,'preparing'], limit=50, no payment join).
4. Parity tests: assert refactored responses deep-equal baselines (byte-for-byte field set).
5. Roadmap flag: add one-line note in docs/04_ROADMAP.md — "business-table tenancy requires shared-listing tenantIdSlot activation" (Q2 resolution).

## Todo List
- [ ] Baseline snapshots captured
- [ ] shared-listing.ts extracted
- [ ] Both handlers delegate
- [ ] Parity tests green
- [ ] Roadmap note added

## Success Criteria
- Worker suite green; zero payload drift proven by parity tests
- shared-listing.ts <200 LOC

## Next Steps
- Hand plan dir to /cook: plans/260826-0449-staff-tenant-binding-orders-consolidation/
