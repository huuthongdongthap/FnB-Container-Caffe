# M4-C Discovery Report — Order Pipeline & Server-Authoritative Cart Engine

**Date:** 2026-09-18  
**Status:** Discovery Complete — Ready for Implementation  
**M4-B Baseline:** Verified (0 TypeScript errors, 3,395 tests PASS)

---

## 1. CURRENT STATE

### Verified M4-B Foundation (MUST REUSE)
| Component | Location | Status |
|-----------|----------|--------|
| `@aura/domain-catalog` Product/Category/Modifier/HappyHour models | `packages/domain/catalog/model/catalog-types.ts` | ✅ Verified |
| `getCustomerMenu` / `getCustomerMenuItem` projection | `packages/domain/catalog/commands/get-customer-menu.ts` | ✅ Verified |
| Customer-Safe DTO (FORBIDDEN_FIELDS contract) | `tests/m4b-digital-menu-contract.test.ts` Section 2 | ✅ Verified |
| Integer VND cents price (`priceCents`) | `CustomerMenuItemSchema` + projection | ✅ Verified |
| Backend-derived availability (`toAvailabilityFlag`) | `packages/domain/catalog/policies/availability.ts` | ✅ Verified |
| `useCustomerMenu` hook + `apiClient.getCustomerMenu()` | `src/hooks/useCustomerMenu.ts` | ✅ Verified |
| CRM Order domain (`@aura/domain-orders`) | `packages/domain/order/index.ts` | ✅ Verified |

### M4-B Non-Blocking Gaps (Documented)
| ID | Gap | Resolution |
|----|-----|------------|
| Y-01 | Legacy ESLint debt (53 errors in `worker/src/tree/*`) | Deferred — dedicated lint sweep |
| Y-02 | Mock E2E only (no live Workers + D1) | M4-C deployment milestone |
| **Y-03** | **Channel Pricing** — single `priceCents` for all channels | **M4-C Extension Point (Phase 01)** |

---

## 2. DEPENDENCY MAP

```
┌─────────────────────────────────────────────────────────────────────┐
│ M4-C ORDER PIPELINE DEPENDENCY GRAPH                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  @aura/domain-catalog (M4-B Foundation)                            │
│     ├── catalog-types.ts           → Product, Category, Modifier   │
│     ├── policies/pricing.ts        → happyHourDiscountFor()        │
│     ├── commands/get-customer-menu.ts → Customer projection        │
│     └── policies/availability.ts   → parseAvailabilityFilter       │
│                         │                                         │
│                         ▼                                         │
│  @aura/domain-order (M4-C Target)                                  │
│     ├── model/order-state-machine.ts → ORDER_STATES, canTransition │
│     ├── commands/create-order.ts   → Server-evaluated pricing      │
│     ├── commands/update-order.ts   → State transition guards       │
│     ├── queries/get-order.ts       → Customer-safe projection      │
│     └── policies/loyalty-trigger.ts → Post-completion accrual      │
│                         │                                         │
│                         ▼                                         │
│  Customer-Facing API Layer                                       │
│     ├── worker/src/index.ts        → POST /api/orders             │
│     ├── packages/domain/order/schemas/order.ts → OpenAPI 3.1      │
│     └── worker/src/lib/openapi.ts  → Route registration           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Integration Points
| Integration | Current Status | M4-C Action |
|-------------|----------------|-------------|
| `menu_items` table → `orders.items` snapshot | Partial (create-order reads price) | **Complete server-authoritative snapshot** |
| `order_type` validation | ✅ Enum + per-type field validation | Extend with channel pricing deltas |
| Happy Hour discount | ✅ `happyHourDiscountFor()` in catalog | **Expose as `resolveItemPrice()`** |
| Modifier `price_delta` | ✅ `modifier_choices.price_delta` column | Aggregate in `resolveItemPrice()` |
| Loyalty accrual | ✅ Non-blocking post-order | Keep additive, never block checkout |

---

## 3. EXISTING CONTRACTS (VERIFIED)

### A. Canonical Customer Menu (M4-B)
```typescript
GET /api/menu
GET /api/menu/:id
Response: { success, data: CustomerMenu, meta: { locale } }
```

### B. CRM Order Creation (Internal — `packages/domain/crm/commands/place-order.ts`)
```typescript
placeOrder(db, { customerId, customerPhone, customerName, channel: 'pickup'|'delivery', items[], notes })
→ PlaceOrderSuccess { orderId, status, channel, items[{ unitPriceCents, subtotalCents }], totalCents }
```

### C. Worker Order Creation (Internal — `packages/domain/order/commands/create-order.ts`)
```typescript
createOrder(req, env, ctx) — Hono handler
→ Reads items + total from VALIDATED payload (createOrderSchema)
→ Inserts into `orders` table with `order_type: 'dine_in'|'takeaway'|'delivery'`
```

### D. Order State Machine (`packages/domain/order/model/order-state-machine.ts`)
```typescript
ORDER_STATUSES = ['pending','confirmed','preparing','ready','served','delivered','completed','cancelled']
ORDER_TRANSITIONS: from → allowed next states
canTransition(from, to) → { ok: boolean, error?: string }
```

### E. Validators (`worker/src/lib/validators.ts`)
```typescript
createOrderSchema: z.object({
  items: z.array(...), total, customer_name, customer_phone,
  order_type: z.enum(['dine_in','takeaway','delivery']).optional(), // No default
  // delivery → requires customer_address
  // dine_in → requires table_id
})
```

---

## 4. GAP ANALYSIS: Y-03 CHANNEL PRICING

### Current Implementation
- **`menu_items.price`** — Single base price column (integer VND cents).
- **`orders.order_type`** — Stores channel intent (`dine_in`, `takeaway`, `delivery`).
- **No channel delta table** — No `channel_price` or `price_list` tables exist.
- **Happy Hour** — Time-based discount on `basePrice`, applies uniformly across channels.
- **Modifiers** — `modifier_choices.price_delta` added to unit price (same for all channels).

### Gap
| Requirement | Current | Needed |
|-------------|---------|--------|
| Channel-specific base price | ❌ Single `price` column | Extend pricing policy to resolve channel delta |
| Delivery fee | ✅ `shipping_fee` (validated from payload) | Policy-driven from order_type |
| Takeaway surcharge | ❌ None | Add channel delta support |
| Dine-in service fee | ❌ None | Add channel delta support |

### Design Decision (Per M4-C Spec §7)
> **Do NOT hard-code assumptions. Search repository... Determine whether pricing already exists and extend it rather than creating a competing pricing model.**

**Resolution:** Extend `packages/domain/catalog/policies/pricing.ts` with `resolveItemPrice(item, channel, modifiers, now)` that:
1. Reads base `menu_items.price`
2. Applies channel delta (configurable, default 0)
3. Applies modifier `price_delta` sum
4. Applies active Happy Hour discount
5. Returns `unitPriceCents` — **integer VND cents, server-authoritative**

---

## 5. ARCHITECTURAL DECISIONS REQUIRED

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Channel delta storage** | A) New table `channel_prices` B) Config map in pricing policy C) `menu_items` extended columns | **B) Config map in pricing policy** — zero schema migration, matches existing pure-function pattern |
| **Delivery fee policy** | A) Hardcoded B) `saas_pricing` table C) Location-based config | **C) Location-based config** — aligns with existing `location_id` on orders |
| **Price snapshot granularity** | A) Per-line snapshot B) Order-level total only | **A) Per-line snapshot** — enables historical audit & line-item returns |
| **Modifier pricing per channel** | A) Same for all channels B) Channel-specific modifier delta | **A) Same** — modifiers are product options, not channel-dependent |

---

## 6. M4-C PHASE PLAN (5 Phases)

| Phase | Title | Scope | Tests |
|-------|-------|-------|-------|
| **01** | Pricing Engine & Channel Pricing (Y-03) | Extend `pricing.ts` with `resolveItemPrice`, add channel deltas | Unit: pricing invariants per channel |
| **02** | Order Price Snapshot & Immutable Lines | Server evaluates all prices, stores per-line snapshot in order | Domain: snapshot immutability |
| **03** | State Machine & Transition Guards | Wire `canTransition` + actor authorization in `updateOrder` | Domain: transition matrix + auth |
| **04** | Customer Security & OpenAPI | `POST/GET /api/orders` canonical, customer-safe projection, OpenAPI | Contract: schema matches runtime |
| **05** | Acceptance Tests & State Sync | Full suite green, state files updated, regression guard | All categories: domain, contract, security, integration |

---

## 7. ACCEPTANCE TESTS (M4-C)

### Domain Tests (New)
- [ ] `resolveItemPrice` returns correct cents for dine_in/takeaway/delivery
- [ ] Happy hour applies on eligible channel+time, does not apply outside window
- [ ] Modifier `price_delta` correctly aggregates into unit price
- [ ] Order snapshot `items` JSON contains exact `unitPriceCents`, `subtotalCents` at creation
- [ ] Changing `menu_items.price` after order does not alter historical `orders.items` snapshot

### Contract Tests (New)
- [ ] `POST /api/orders` rejects payload with `price`/`total`/`discount`/`unitPriceCents`
- [ ] `GET /api/orders/:id` returns customer-safe fields only (no cost/margin)
- [ ] IDOR: Customer A cannot read Customer B's order
- [ ] OpenAPI schema `OrderRoutes` matches runtime responses 1:1

### Security Tests (New)
- [ ] Price tampering: client injects `total: 0` → server ignores, uses evaluated total
- [ ] Channel override: client sends `order_type: 'delivery'` without address → 400 validation
- [ ] State machine: invalid transition `pending` → `served` → 400 with machine-readable error

### Integration Tests (New)
- [ ] Full lifecycle: create → confirm → prepare → ready → served → completed
- [ ] Cancellation at each allowed state: pending, confirmed, preparing
- [ ] Loyalty accrual fires on `completed` (non-blocking)

### Regression Guards (Existing)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npx vitest run` = 3,395+ tests PASS (no count reduction without rationale)

---

## 8. RISKS

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Channel delta requires D1 schema migration | Low | High | Use config map (no migration needed) |
| Existing `create-order.ts` trusts payload `total` | Medium | High | **Immediate fix:** Re-evaluate server-side in Phase 02 |
| State machine bypassed by direct SQL | Low | High | Guard at route handler level + unit test `canTransition` |
| Duplicate order domains (CRM vs domain-order) | Medium | Medium | Consolidate; prefer `@aura/domain-order` as canonical |
| Happy hour + channel pricing edge cases | Medium | Medium | Exhaustive matrix tests in Phase 01 |

---

## 9. IMMEDIATE NEXT ACTION

**Begin Phase 01 Implementation:**
1. Extend `packages/domain/catalog/policies/pricing.ts` with `resolveItemPrice()`
2. Add `packages/domain/catalog/__tests__/pricing.test.ts`
3. Verify `npx tsc --noEmit` and `npx vitest run` stay green

**No production code changes during discovery — this report is analysis only.**