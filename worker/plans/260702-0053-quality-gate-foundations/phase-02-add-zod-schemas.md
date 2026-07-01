---
phase: 2
title: Add Missing Zod Schemas to validators.ts
status: completed
priority: P0
effort: 2h
dependencies: []
---

# Phase 2: Add Missing Zod Schemas

## Overview

Add ~20 Zod schemas for all unvalidated API inputs. Extend `worker/src/lib/validators.ts`. No routes are modified — this is pure schema creation. Tests lock current behavior of each endpoint before schemas are applied in Phase 3.

## TDD Contract

1. Read each route handler's current manual validation
2. Write Zod schema that matches exactly (no tighter, no looser)
3. Add unit test for each schema (valid input passes, invalid input fails)
4. Verify existing test suite stays green

## Schemas to Add

### Products — 2 schemas
- `createProductSchema`: `{ name: z.string().min(1), price: z.number().positive(), slug: z.string().optional(), description: z.string().optional(), compare_at_price: z.number().optional(), category_id: z.number().optional(), image_url: z.string().url().optional(), is_available: z.boolean().optional(), sort_order: z.number().int().optional() }`
- `updateProductSchema`: same fields all `.optional()` + `.partial()`

### Categories — 2 schemas
- `createCategorySchema`: `{ name: z.string().min(1), slug: z.string().optional(), sort_order: z.number().int().optional(), image_url: z.string().url().optional() }`
- `updateCategorySchema`: all `.partial()`

### Subscriptions — 8 schemas
- `createPlanSchema`: `{ name, price, billing_cycle, features?, description? }`
- `updatePlanSchema`: `.partial()` of createPlanSchema
- `createSubscriptionSchema`: `{ plan_id, customer_name?, customer_email?, customer_phone? }`
- `upgradeSubscriptionSchema`: `{ new_plan_id }`
- `downgradeSubscriptionSchema`: `{ new_plan_id }`
- `cancelSubscriptionSchema`: `{ reason? }`
- `pauseSubscriptionSchema`: `{ until_date? }`
- `resumeSubscriptionSchema`: `{}`

### Shifts — 2 schemas
- `clockInSchema`: `{ staff_id: z.string().min(1), staff_name: z.string().optional(), notes: z.string().optional() }`
- `clockOutSchema`: `{ staff_id: z.string().min(1) }`

### Checkin — 1 schema
- `checkinSchema`: `{ customer_id: z.string().min(1), customer_name: z.string().optional() }`

### Orders-Hono — 2 schemas
- `updateOrderStatusSchema`: `{ status: z.enum(['pending','confirmed','preparing','ready','served','cancelled','delivered']) }`
- `createOrderInputSchema`: `{ items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().positive(), price: z.number().positive() })), customer_name: z.string().optional(), customer_phone: z.string().optional(), customer_address: z.string().optional(), notes: z.string().optional(), payment_method: z.string().optional() }`

### Promotions — 2 schemas
- `validatePromotionSchema`: `{ code: z.string().min(1), order_total: z.number().optional() }`
- `redeemPromotionSchema`: `{ code: z.string().min(1), order_id: z.string().min(1), order_total: z.number() }`

### pretix — 3 schemas
- `pretixWebhookBodySchema`: `{ notification_id: z.number().optional(), organizer: z.string(), event: z.string(), code: z.string(), action: z.string() }`
- `pretixCheckinSchema`: `{ secret: z.string().min(1), event: z.string().optional(), listId: z.number().optional() }`
- `pretixGenerateSchema`: `{ source: z.literal('event'), slug: z.string().min(1) }`

### Tables — 1 schema
- `updateTableStatusSchema`: `{ status: z.enum(['Available','Occupied','Reserved','Overdue']) }`

### Birthday — 1 schema
- `redeemBirthdaySchema`: `{ customer_id: z.string().min(1), order_id: z.string().optional() }`

### Mixpost — 2 schemas
- `mixpostCreatePostSchema`: `{ content: z.string().min(1), accounts: z.array(z.number()).min(1), media_urls: z.array(z.string().url()).optional(), scheduled_at: z.string().optional() }`
- `mixpostGenerateSchema`: `{ source: z.enum(['promotion','menu']), id: z.string().optional(), category: z.number().optional() }`

### Reviews — 1 schema
- `createReviewSchema`: `{ order_id: z.string().min(1), rating: z.number().int().min(1).max(5), comment: z.string().optional(), customer_name: z.string().optional() }`

### Webhooks — 1 schema
- `payosWebhookSchema`: `{ success: z.boolean(), data: z.object({ orderCode: z.number(), amount: z.number(), description: z.string(), ... }).passthrough() }`

### ERPNext — 3 schemas
- `erpnextLeadSchema`: `{ ... }` — match current manual parsing shape
- `erpnextTagSchema`: `{ tag: z.string().min(1) }`
- `erpnextProductSyncSchema`: `{ product_ids: z.array(z.string()).optional() }`

### ERPNext POS — 2 schemas
- `erpnextSalesOrderSchema`: match current handler body shape
- `erpnextPosWebhookSchema`: match current handler body shape

## Files Changed

- `worker/src/lib/validators.ts`: add ~25 schemas
- `worker/src/__tests__/lib/validators.test.ts`: add schema unit tests (if file exists, else create)

## Validation

```bash
npx vitest run src/__tests__/lib/validators.test.ts  # must pass
npm test                                                # existing tests must stay green
```

## Success Criteria

- [ ] All new Zod schemas defined in `validators.ts`
- [ ] Each schema has unit tests (valid + invalid cases)
- [ ] `npm test`: 770/770 pass (after Phase 1)
- [ ] No route files modified
