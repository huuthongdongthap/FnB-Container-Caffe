---
phase: 3
title: Apply Zod Validation to All Routes
status: pending
priority: P0
effort: 3h
dependencies: [2]
---

# Phase 3: Apply Zod Validation to All Routes

## Overview

Apply Zod schemas (from Phase 2 + existing ones in validators.ts) to every POST/PATCH/PUT handler. Replace manual `if (!body.field)` checks with `schema.parse(body)`. Zod throws `ZodError` which the existing error handler catches (already imports ZodError).

## TDD Contract

1. Tests lock current behavior before changes
2. Apply Zod schema to handler
3. Run tests — manual validation must match Zod exactly
4. If tests fail: schema is too strict → adjust schema, not handler

## Work Items (by route file)

### Phase 3a: Apply Existing Schemas (4 routes, 0.5h)

Routes that already have matching schemas in `validators.ts`:

| Route | Handler | Existing Schema |
|-------|---------|----------------|
| `loyalty.ts` POST `/phone-auth` | Manual phone check | `phoneAuthSchema` |
| `loyalty.ts` POST `/spend-cashback` | Manual `!order_id \|\| !amount` | `spendCashbackSchema` |
| `loyalty.ts` POST `/redeem` | Manual `!reward_id` | `redeemRewardSchema` |
| `referrals.ts` POST `/apply` | Manual `typeof code !== 'string'` | `referralApplySchema` |
| `reservations.ts` POST `/` | Manual string/regex checks | `reservationSchema` |

Each handler: replace manual validation with `schema.parse(body)`. Remove old manual checks.

### Phase 3b: Apply New Schemas (21 routes, 2.5h)

| Route | Schemas to Apply | Notes |
|-------|-----------------|-------|
| `products.ts` | `createProductSchema`, `updateProductSchema` | Currently blind `c.req.json()` |
| `categories.ts` | `createCategorySchema`, `updateCategorySchema` | Currently blind `c.req.json()` |
| `subscriptions.ts` | 8 schemas | Per-endpoint: plan create/update, sub create/upgrade/downgrade/cancel/pause/resume |
| `shifts.ts` | `clockInSchema`, `clockOutSchema` | Replace generic type params |
| `checkin.ts` | `checkinSchema` | Replace manual checks |
| `orders-hono.ts` | `updateOrderStatusSchema`, `createOrderInputSchema` | Replace manual checks |
| `promotions.ts` | `validatePromotionSchema`, `redeemPromotionSchema` | Replace manual checks |
| `pretix.ts` | `pretixWebhookBodySchema`, `pretixCheckinSchema`, `pretixGenerateSchema` | Replace `body as any` |
| `tables.ts` | `updateTableStatusSchema` | Replace manual `allowed.includes` |
| `birthday.ts` | `redeemBirthdaySchema` | Replace manual check |
| `mixpost.ts` | `mixpostCreatePostSchema`, `mixpostGenerateSchema` | Replace `body as any` |
| `reviews.ts` | `createReviewSchema` | Replace manual check |
| `webhooks.ts` | `payosWebhookSchema` | `.passthrough()` for unknown fields |
| `erpnext-pos.ts` | `erpnextSalesOrderSchema`, `erpnextPosWebhookSchema` | Match manual check exactly |

### Pattern for Each Route

**Before:**
```typescript
let body: any;
try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
if (!body.field1) return c.json({ error: 'field1 required' }, 400);
```

**After:**
```typescript
import { someSchema } from '../lib/validators';
// ...
const result = someSchema.safeParse(await c.req.json());
if (!result.success) return c.json({ success: false, error: result.error.issues[0].message }, 400);
const body = result.data;
// body.field1 is now typed and guaranteed present
```

## Files Changed

- 21 route files in `worker/src/routes/` — each gets Zod `.parse()` or `.safeParse()`
- No new files

## Validation

```bash
npm test    # all 770 tests must pass
npm run build  # 0 TypeScript errors
```

## Success Criteria

- [ ] All POST/PATCH/PUT handlers use Zod validation
- [ ] `ZodError` is handled by existing error handler middleware
- [ ] `npm test`: 770/770 pass
- [ ] `npm run build`: 0 errors
