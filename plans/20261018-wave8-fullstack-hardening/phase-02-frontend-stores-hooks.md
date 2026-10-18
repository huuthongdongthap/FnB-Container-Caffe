# Phase 02: Frontend Stores, Hooks & State Machines

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave8-deep-audit.md](reports/brainstorm-20261018-wave8-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**:
- `src/hooks/split-bill-helpers.ts`
- `src/hooks/use-split-bill.ts`
- `src/hooks/use-checkin.ts`
- `src/hooks/stores/admin/use-admin-customers-store.ts`
- `src/hooks/stores/admin/use-admin-staff-store.ts`
- `src/hooks/stores/use-checkin-store.ts`
- `src/hooks/stores/use-order-store.ts`

---

## Requirements & Implementation Steps

1. **Split-Bill Allocation Invariants**:
   - `src/hooks/split-bill-helpers.ts`: Update `computeUnassignedItems` to accept `splitCount` and treat assignments with `index >= splitCount` as unassigned.
   - `src/hooks/use-split-bill.ts`: When `splitCount` is decreased, remove stale assignments pointing to out-of-bounds split indices so items are not silently dropped while `allAssigned` incorrectly returns `true`.

2. **Loyalty Check-in Hook Alignment**:
   - `src/hooks/use-checkin.ts`:
     - Check `if ((!lookupRes.success && !lookupRes.ok) || !lookupRes.member)` to support `{ ok: true, member }` backend envelopes.
     - Align endpoints with canonical `/api/checkin` and `/api/loyalty/checkin`.
     - In `markPosted`, clear existing timers (`clearTimeout(pollRef.current)`) before scheduling new polls to avoid background timer leaks.

3. **Zustand Admin Stores Error Propagation**:
   - `src/hooks/stores/admin/use-admin-customers-store.ts`: In `addCustomer`, `updateCustomer`, and `deleteCustomer`, revert optimistic updates on network or API failures, set error state, and return `false` instead of `true`.
   - `src/hooks/stores/admin/use-admin-staff-store.ts`: Fall back gracefully when manager role fetches staff, or align role permissions with backend endpoint.

4. **Order Store Unauthenticated Tracking**:
   - `src/hooks/stores/use-order-store.ts`: When fetching order status by ID without an active auth token, use public order tracking query (`/api/orders/:id/track` or public read query) to avoid 401 Unauthorized errors on guest order tracking.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors.
- Bill splitting maintains accurate item accounting regardless of split count adjustments.
- Customer mutations properly communicate error state on server failures.
