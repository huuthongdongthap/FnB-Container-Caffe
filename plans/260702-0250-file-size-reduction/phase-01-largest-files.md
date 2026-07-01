---
phase: 1
title: Phase 1 — Extract Business Logic from 5 Largest Route Files
status: completed
priority: P0
effort: 8h
dependencies: []
---

# Phase 1: Largest Files (8h)

Extract business logic from the 5 worst offenders (200+ lines over limit). Follow TDD: verify tests → extract → verify → commit.

## General Pattern

```typescript
// BEFORE: route file contains everything
// worker/src/routes/orders.ts (548 lines)

// AFTER: route file is thin re-exporter
// worker/src/routes/orders.ts (~70 lines)
export { createOrder } from '../tree/orders/create-order';
export { getOrder } from '../tree/orders/get-order';
export { updateOrder } from '../tree/orders/update-order';
// ...

// Business logic lives in tree
// worker/src/tree/orders/create-order.ts (extracted function body)
```

## Critical Rule

**Route files MUST re-export everything that was previously exported.** This ensures `index.ts` and test file imports don't change. Only the import source changes (from `./routes/orders` to `../tree/orders/create-order` inside the route file itself).

## File 1.1: subscriptions.ts (704 → ~50 lines)

### Extract Plan

| Source (line range) | Destination | Lines |
|---------------------|-------------|-------|
| Types (interfaces, 42-108) | `tree/subscriptions/types.ts` | ~70 |
| Helpers (generateId, today, nowStr, addMonths, 115-130) | `tree/subscriptions/helpers.ts` | ~20 |
| requireAdmin, requireVendor (128-156) | `tree/subscriptions/middleware.ts` | ~30 |
| updateMRRSnapshot (156-196) | `tree/subscriptions/mrr-calculator.ts` | ~45 |
| Plan CRUD handlers (206-300) | `tree/subscriptions/plan-handlers.ts` | ~100 |
| Subscription CRUD handlers (300-630) | `tree/subscriptions/sub-handlers.ts` | ~340 |
| Invoice handlers (632-704) | `tree/subscriptions/invoice-handlers.ts` | ~75 |

### Route file after: ~50 lines (Hono router only)

### TDD steps:
1. `npm test` → confirm 1,033 ✓
2. Create `tree/subscriptions/types.ts` — just types, no logic
3. Create `tree/subscriptions/helpers.ts` — utility functions
4. Create `tree/subscriptions/middleware.ts` — requireAdmin, requireVendor
5. Create `tree/subscriptions/mrr-calculator.ts` — updateMRRSnapshot
6. Create `tree/subscriptions/plan-handlers.ts` — plan CRUD
7. Create `tree/subscriptions/sub-handlers.ts` — subscription lifecycle handlers
8. Create `tree/subscriptions/invoice-handlers.ts` — invoice handlers
9. Rewrite `routes/subscriptions.ts` as thin router with re-exports
10. `npm test` → 1,033 ✓
11. Commit: `refactor(subscriptions): extract to tree/subscriptions/ (704→50 lines)`

## File 1.2: loyalty.ts (640 → ~60 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| genId, nowSqlTimestamp, throttle (24-40) | `tree/loyalty/helpers.ts` | ~20 |
| getActiveCampaign, calcExpiresAt (44-75) | `tree/loyalty/campaign.ts` | ~35 |
| authCustomer middleware | `tree/loyalty/auth-middleware.ts` | ~20 |
| processOrderLoyalty (497-640) | `tree/loyalty/process-order.ts` | ~145 |
| Router handlers (phone-auth, summary, points, cashback, spend-cashback, rewards, redeem, my-rewards, tiers, lookup) | Keep in router (already thin handlers, ~30 lines each) | ~330 |

### Route file after: ~60 lines (router + re-exports + thin handlers)

**Note:** loyalty.ts router handlers are already relatively thin (~30 lines each). Only extract `processOrderLoyalty` (143 lines, standalone function) and helpers. The 10 router handlers stay but are short enough.

### TDD steps:
1. `npm test` → 1,033 ✓
2. Extract helpers → `tree/loyalty/helpers.ts`
3. Extract campaign → `tree/loyalty/campaign.ts`
4. Extract auth middleware → `tree/loyalty/auth-middleware.ts`
5. Extract processOrderLoyalty → `tree/loyalty/process-order.ts`
6. Rewrite `routes/loyalty.ts` with imports + re-exports
7. `npm test` → 1,033 ✓
8. Commit: `refactor(loyalty): extract helpers + processOrderLoyalty to tree/loyalty/ (640→60 lines)`

## File 1.3: orders.ts (548 → ~70 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| generateId, parseJSON (14-24) | `tree/orders/helpers.ts` | ~15 |
| notifyTelegram (26-66) | `tree/orders/telegram.ts` | ~45 |
| createOrder (68-216) | `tree/orders/create-order.ts` | ~150 |
| getOrder (218-259) | `tree/orders/get-order.ts` | ~45 |
| updateOrder (261-396) | `tree/orders/update-order.ts` | ~140 |
| getLatestOrderTimestamp (398-407) | `tree/orders/latest-timestamp.ts` | ~15 |
| getAdminOrders (409-472) | `tree/orders/admin-orders.ts` | ~70 |
| getStats (474-548) | `tree/orders/stats.ts` | ~75 |

### Route file after: ~70 lines (thin wrappers → re-exports)

**Contract critical:** `index.ts` imports these 7 functions directly:
```typescript
import { createOrder, getOrder, updateOrder, getLatestOrderTimestamp, getAdminOrders, getStats, notifyTelegram } from './routes/orders';
```
Route file re-exports must preserve this. Pattern:
```typescript
// routes/orders.ts
export { createOrder } from '../tree/orders/create-order';
export { getOrder } from '../tree/orders/get-order';
// etc.
```

### TDD steps:
1. `npm test` → 1,033 ✓
2. Extract each function to tree module (copy function body, add type imports)
3. Rewrite `routes/orders.ts` to re-export from tree
4. `npm test` → 1,033 ✓
5. Commit: `refactor(orders): extract 8 handlers to tree/orders/ (548→70 lines)`

## File 1.4: auth.ts (504 → ~45 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| generateId, parseJSON, findExistingOwner (15-49) | `tree/auth/helpers.ts` | ~35 |
| registerUser (51-117) | `tree/auth/register.ts` | ~70 |
| loginUser (119-173) | `tree/auth/login.ts` | ~60 |
| logoutUser (175-197) | `tree/auth/logout.ts` | ~25 |
| getCurrentUser (199-232) | `tree/auth/current-user.ts` | ~35 |
| registerStaff (234-276) | `tree/auth/register-staff.ts` | ~45 |
| listStaff (278-331) | `tree/auth/list-staff.ts` | ~55 |
| bootstrapOwner (333-397) | `tree/auth/bootstrap.ts` | ~65 |
| resetPassword (399-451) | `tree/auth/reset-password.ts` | ~55 |
| changePassword (453-501) | `tree/auth/change-password.ts` | ~50 |

### Route file after: ~45 lines (re-exports only)

```typescript
// routes/auth.ts
export { registerUser } from '../tree/auth/register';
export { loginUser } from '../tree/auth/login';
export { logoutUser } from '../tree/auth/logout';
export { getCurrentUser } from '../tree/auth/current-user';
export { registerStaff } from '../tree/auth/register-staff';
export { listStaff } from '../tree/auth/list-staff';
export { bootstrapOwner } from '../tree/auth/bootstrap';
export { resetPassword } from '../tree/auth/reset-password';
export { changePassword } from '../tree/auth/change-password';
export { verifyJWT } from '../lib/jwt';
```

### TDD steps:
1. `npm test` → 1,033 ✓
2. Extract each handler to tree/auth/ module
3. Rewrite `routes/auth.ts` as re-exports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(auth): extract 9 handlers to tree/auth/ (504→45 lines)`

## File 1.5: mautic-bridge.ts (533 → ~90 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| Interfaces (16-60) | `tree/mautic/types.ts` | ~40 |
| getMauticClient (63-69) | `tree/mautic/client-factory.ts` | ~10 |
| toMauticContact (72-83) | `tree/mautic/contact-mapper.ts` | ~15 |
| syncSegments (86-152) | `tree/mautic/segment-sync.ts` | ~65 |
| trackEnrollment, isAlreadyEnrolled (154-182) | `tree/mautic/enrollment-tracker.ts` | ~30 |
| detectAndEnroll, detectWinbackCandidates, detectBirthdayCandidates (185-270) | `tree/mautic/campaign-detection.ts` | ~90 |
| triggerPromoCampaign (272-305) | `tree/mautic/promo-campaign.ts` | ~35 |
| syncMauticContacts (308-373) | `tree/mautic/contact-sync-cron.ts` | ~70 |
| handleMauticBridgeRequest (375-412) | `tree/mautic/bridge-handler.ts` | ~40 |
| syncContacts (413-480) | `tree/mautic/contact-sync.ts` | ~70 |
| enrollCampaigns (482-533) | `tree/mautic/campaign-enrollment.ts` | ~55 |

### Route file after: ~90 lines (thin router + re-exports)

**Contract:** `index.ts` imports `handleMauticBridgeRequest` + campaign detection functions. All exports preserved.

### TDD steps:
1. `npm test` → 1,033 ✓
2. Extract each module to tree/mautic/
3. Rewrite `routes/mautic-bridge.ts` as thin router + re-exports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(mautic-bridge): extract to tree/mautic/ (533→90 lines)`

## Phase 1 Success Criteria

- [ ] subscriptions.ts: 704 → ≤50 lines
- [ ] loyalty.ts: 640 → ≤60 lines
- [ ] orders.ts: 548 → ≤70 lines
- [ ] auth.ts: 504 → ≤45 lines
- [ ] mautic-bridge.ts: 533 → ≤90 lines
- [ ] All 25+ tree modules created with clean imports
- [ ] 1,033 tests pass (5 commits, each verified)
- [ ] Build: 0 errors
