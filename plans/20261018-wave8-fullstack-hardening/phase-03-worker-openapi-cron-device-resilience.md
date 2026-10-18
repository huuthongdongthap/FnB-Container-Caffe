# Phase 03: Worker OpenAPI, Cron & Device Resilience

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave8-deep-audit.md](reports/brainstorm-20261018-wave8-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**:
- `worker/src/routes/openapi-cron-handlers/{job-crud-handlers.ts,run-handlers.ts,summary-handlers.ts}`
- `worker/src/routes/openapi-auth-handlers/{device-handlers.ts,staff-handlers.ts}`
- `worker/src/routes/openapi-promotions-handlers/{crud-handlers.ts,validation-handlers.ts}`
- `worker/src/routes/openapi-payments-handlers/read-handlers.ts`
- `worker/src/routes/openapi-loyalty-handlers/{reward-handlers.ts,admin-handlers.ts}`
- `worker/src/routes/dindin-handlers/{checkout-handlers.ts,types.ts}`
- `worker/src/routes/reminders/shifts/route.ts`
- `worker/src/routes/mixpost-handlers/generate-handler.ts`

---

## Requirements & Implementation Steps

1. **Cron Endpoints Schema Resilience**:
   - `worker/src/routes/openapi-cron-handlers/{job-crud-handlers.ts,run-handlers.ts}`: Replace `c.env.AURA_DB` with `getDatabase(c)`. Wrap queries to `cron_jobs` and `cron_runs` in `try/catch` blocks returning empty lists `{ jobs: [], meta: { page: 1, limit, total: 0, totalPages: 0 } }` or 404 instead of throwing 500 crashes when tables are absent.

2. **Trusted Devices & Session Revocation Fallbacks**:
   - `worker/src/routes/openapi-auth-handlers/device-handlers.ts`: Wrap `trusted_devices` and `sessions` operations in `try/catch`. When `sessions` table is absent, revoke token in `c.env.AUTH_KV.put('revoked:' + token, '1')`. Return `{ success: true, data: [] }` when `trusted_devices` is unmigrated.
   - `worker/src/routes/openapi-auth-handlers/staff-handlers.ts`: Permit `manager` role on `GET /api/auth/staff` (`if (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'manager') return 403`).

3. **Promotions Crud & Validation Normalization**:
   - `worker/src/routes/openapi-promotions-handlers/crud-handlers.ts`: Add canonical `promotions` fallback on insert matching `worker/schema.sql` (`code, percent, max_discount, min_order, usage_limit, usage_count, expires_at, is_active, created_at`).
   - `worker/src/routes/openapi-promotions-handlers/validation-handlers.ts`: Normalize discount value `const discountRate = Number(promotion.discount_value ?? promotion.percent ?? 0)` so `discountRate` is never `NaN`.

4. **Payments Customer Scope Sanitization**:
   - `worker/src/routes/openapi-payments-handlers/read-handlers.ts`: Ensure customer role is strictly scoped to payments for their own orders (`JOIN orders o ON o.id = payments.order_id WHERE o.customer_id = ?`).

5. **DinDin KV Fallback & Mixpost Content Fix**:
   - `worker/src/routes/dindin-handlers/checkout-handlers.ts` & `types.ts`: Wrap `dindin_config` and `dindin_cart` queries in `try/catch` and fall back to `c.env.AUTH_KV`.
   - `worker/src/routes/mixpost-handlers/generate-handler.ts`: Use `promo.percent ?? promo.discount_value ?? 0` to prevent `"Giảm undefined%"` in generated text.
   - `worker/src/routes/reminders/shifts/route.ts`: In shift reminders catch block, query canonical `shifts` table (`FROM shifts s JOIN users u ON u.id = s.user_id`).
   - `worker/src/routes/openapi-loyalty-handlers/{reward-handlers.ts,admin-handlers.ts}`: Pass `body.idempotencyKey ?? null` instead of `undefined` to D1 `.bind(...)`.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors.
- Unmigrated optional tables return graceful empty responses instead of uncaught D1 crashes.
- Promotion calculations never emit `NaN`.
