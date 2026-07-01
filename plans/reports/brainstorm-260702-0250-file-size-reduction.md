# File Size Reduction — Brainstorm Report

**Date:** 2026-07-02 | **Source:** /brainstorm next plan --deep --parallel
**Context:** Meta-plan A/B/C complete. 1,033 tests, 0 build errors. 10 oversized files remain.

---

## Problem Statement

Dev rules require files ≤200 lines. 10 route files exceed this: subscriptions (704), loyalty (640), orders (548), mautic-bridge (533), auth (504), mixpost (468), referrals (320), pretix (276), zalo (229), cal-booking-webhook (227). Business logic is entwined with HTTP routing — hard to test, hard to read, hard to change.

## Approved Approach: Tree-Layer Extraction (Option A)

Extract business logic → `worker/src/tree/<domain>/` modules. Route files become thin Hono routers (~50-80 lines). Pattern:

```
Route file:      worker/src/routes/orders.ts          (~60 lines)
Tree module:     worker/src/tree/orders/create-order.ts  (~150 lines)
                 worker/src/tree/orders/update-order.ts  (~120 lines)
                 worker/src/tree/orders/types.ts          (~20 lines)
                 worker/src/tree/orders/helpers.ts        (~30 lines)
```

## Scope

### Phase 1: Largest files first (8h)
| File (lines) | Extract To | Reduction |
|-------------|-----------|-----------|
| `subscriptions.ts` (704) | `tree/subscriptions/` — types, helpers, MRR calc, plan handlers, sub handlers | ~600→50 |
| `loyalty.ts` (640) | `tree/loyalty/` — processOrderLoyalty, campaign helpers, auth middleware | ~580→60 |
| `orders.ts` (548) | `tree/orders/` — createOrder, getOrder, updateOrder, getStats, getAdminOrders, helpers | ~480→70 |
| `auth.ts` (504) | `tree/auth/` — registerUser, loginUser, logoutUser, getCurrentUser, registerStaff, listStaff, bootstrapOwner, resetPassword, changePassword | ~460→45 |
| `mautic-bridge.ts` (533) | `tree/mautic/` — campaign-detection, contact-sync, handler | ~440→90 |

### Phase 2: Medium files (4h)
| File (lines) | Extract To | Reduction |
|-------------|-----------|-----------|
| `mixpost.ts` (468) | `tree/mixpost/` — auto-post cron functions, legacy handler, template resolver | ~360→110 |
| `referrals.ts` (320) | `tree/referrals/` — applyReferral, processReferral, reverseReferral, cashback logic | ~260→60 |
| `pretix.ts` (276) | `tree/pretix/` — HMAC validation, client helpers | ~190→85 |

### Phase 3: Small cleanup (2h)
| File (lines) | Extract To | Reduction |
|-------------|-----------|-----------|
| `zalo.ts` (229) | `tree/zalo/` — ZNS sender, notification templates | ~160→70 |
| `cal-booking-webhook.ts` (227) | `tree/cal-booking/` — booking processing | ~150→75 |

### Phase 4: Regression gate (1h)
- `npm test` → 1,033+/1,033 (no regressions)
- `npm run build` → 0 errors
- `npx tsc --noEmit` (worker) → 0 errors
- Verify all imports resolve correctly
- Verify all 10 files ≤200 lines

## Architecture

```
worker/src/tree/
├── subscriptions/
│   ├── types.ts          # PlanRecord, SubscriptionRecord, InvoiceRecord, JwtPayload
│   ├── helpers.ts        # generateId, today, nowStr, addMonths, requireAdmin, requireVendor
│   ├── plan-handlers.ts  # createPlan, updatePlan, listPlans
│   ├── sub-handlers.ts   # createSub, cancelSub, pauseSub, resumeSub, upgradeSub
│   └── mrr-calculator.ts # updateMRRSnapshot
├── loyalty/
│   ├── helpers.ts        # genId, nowSqlTimestamp, throttle, calcExpiresAt
│   ├── campaign.ts       # getActiveCampaign
│   ├── process-order.ts  # processOrderLoyalty
│   └── auth-middleware.ts # authCustomer
├── orders/
│   ├── types.ts
│   ├── helpers.ts        # generateId, parseJSON
│   ├── create-order.ts
│   ├── update-order.ts
│   ├── admin-orders.ts
│   ├── stats.ts
│   └── telegram.ts       # notifyTelegram
├── auth/
│   ├── helpers.ts        # generateId, parseJSON, findExistingOwner
│   ├── register.ts
│   ├── login.ts
│   ├── logout.ts
│   ├── staff.ts          # registerStaff, listStaff
│   ├── password.ts       # resetPassword, changePassword
│   └── bootstrap.ts      # bootstrapOwner
├── mautic/
│   ├── types.ts
│   ├── contact-mapper.ts  # toMauticContact
│   ├── segments.ts        # syncSegments
│   ├── campaign-detection.ts  # detectWinbackCandidates, detectBirthdayCandidates
│   ├── contact-sync.ts    # syncContacts
│   └── handler.ts         # handleMauticBridgeRequest
├── mixpost/
│   ├── auto-post.ts       # autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights
│   ├── template-resolver.ts  # resolveTemplate
│   └── legacy-handler.ts  # handleMixpostRequest
├── referrals/
│   ├── apply.ts
│   ├── process.ts
│   └── cashback.ts
├── pretix/
│   ├── hmac.ts           # validateWebhookSignature
│   └── helpers.ts        # getPretixClient
├── zalo/
│   ├── zns-sender.ts     # sendZNS
│   └── templates.ts      # notification content
└── cal-booking/
    └── process-booking.ts
```

## Route File After Extraction (Example)

```typescript
// worker/src/routes/orders.ts — thin router, ~60 lines
import { Hono } from 'hono';
import { createOrder } from '@/tree/orders/create-order';
import { getOrder } from '@/tree/orders/get-order';
import { updateOrder } from '@/tree/orders/update-order';
import { getAdminOrders } from '@/tree/orders/admin-orders';
import { getStats } from '@/tree/orders/stats';
import { getLatestOrderTimestamp } from '@/tree/orders/latest-timestamp';

export const ordersRouter = new Hono();
ordersRouter.post('/', (c) => createOrder(c));
ordersRouter.get('/:id', (c) => getOrder(c));
ordersRouter.patch('/:id', (c) => updateOrder(c));
// ... thin wire-up
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Import path errors | Phase 4 regression gate catches all |
| Broken test imports | Tests import from routes/ — routes re-export from tree/, no test changes needed |
| Circular deps | Tree → tree forbidden. Each domain is self-contained |
| auth.ts has KV deps | Keep KV wrapper in tree/auth/helpers.ts |

## Success Criteria

- All 10 route files ≤200 lines
- 1,033 tests pass (0 regressions)
- 0 build errors
- All tree/ imports follow layer rules (tree ← seed, tree → routes)
- No new `:any` types introduced

## Next Step

`/ck:plan --tdd` — tests already exist for all routes. Implementation: extract → verify tests pass → commit per file.
