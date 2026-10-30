# Brainstorm Report: Full-Monorepo Typecheck & 498-Suite Zero-Failure Convergence

**Date:** 2026-10-30
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654` (`tracked_product_diff_sha256: 906e6969d65af36959b72f8b216c1a485278ee5b70882676392e3fde1c257fb1`)
**Predecessor Plan:** [`plans/261030-0315-zero-error-d1-query-priority-and-menu-table-ux-parity/plan.md`](../../plans/261030-0315-zero-error-d1-query-priority-and-menu-table-ux-parity/plan.md) (`COMPLETE`)

---

## 1. Empirical Diagnostic Scan Summary

Following completion of the 1,350-statement D1 canonical query priority and `/menu` + `/order` UX parity waves (`218/218` identity audit probes PASS, `54/54` worker integration suites PASS, `57/57` customer/KDS E2E tests PASS), a full-monorepo diagnostic sweep was executed across all TypeScript projects (`npm run typecheck:all`), ESLint (`npm run lint`), and the entire Vitest suite (`npx vitest run` — **498 test files / 4,716 tests**).

| Verification Surface | Command | Current Result | Root Cause Count |
|---|---|---|---|
| Root Frontend Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors) | 0 |
| Domain Packages Typecheck | `npm run typecheck:packages` | **PASS** (0 errors) | 0 |
| Worker Typecheck | `npm run typecheck:worker` (`tsc --project worker/tsconfig.json --noEmit`) | **FAIL** (1 error: `TS2459` in `worker/src/routes/push.ts:3`) | 1 production defect |
| ESLint | `npm run lint` | **PASS** (0 errors, 291 warnings) | 0 |
| Full Monorepo Vitest Suite | `npx vitest run` | **492/498 files PASS**, **4,710/4,716 tests PASS**, **6 FAIL** | 1 production defect + 5 test fixture/mock drifts from prior security hardenings |
| Pre-Release Staging Gates | `npm run verify:gates` | **GATE_1 & GATE_2 PASS**, **GATE_3 static PASS**, **GATE_4 `PENDING_STAGING_ENV`** | External cloud credentials gated (`UNKNOWN/NOT_RUN`) |

---

## 2. Deep Root-Cause Analysis (`file:line` Verified)

### Defect 1 (Production Bug + Typecheck Error + Test Failure): `worker/src/routes/push.ts` & `worker/src/middleware/auth.ts`
- **Evidence:**
  - `worker/src/routes/push.ts:3` — `import { requireAuth, authenticateRequest } from '../middleware/auth';`
  - `worker/src/middleware/auth.ts:3` — imports `authenticateRequest` from `../lib/staff-session-auth` locally without re-exporting it (`error TS2459: Module '"../middleware/auth"' declares 'authenticateRequest' locally, but it is not exported`).
  - `worker/src/routes/push.ts:91-101` — calls `authUser = await authenticateRequest(c.req.raw, c.env)`. At runtime, `authenticateRequest` is `undefined`, throwing `TypeError: authenticateRequest is not a function` inside `try { ... } catch { return c.json({ success: false, error: 'Unauthorized' }, 401); }`.
  - Furthermore, `authenticateRequest` in `worker/src/lib/staff-session-auth.ts:7-45` returns `{ payload: JwtPayload; token: string; account: StaffAccount | null } | { blocked: string } | null`, whereas `push.ts:98` inspects `authUser.role` at the top level instead of `authUser.payload.role` (and does not check `'blocked' in authUser`).
  - `worker/src/__tests__/routes/checkin.test.ts:20-22` — mocks `../../middleware/auth` with only `requireAuth`, leaving `authenticateRequest` undefined in the `POST /api/push/subscribe — manual staff registration` test (`line 103`).
- **Fix:**
  1. Re-export `authenticateRequest` from `worker/src/middleware/auth.ts` (`export { authenticateRequest } from '../lib/staff-session-auth';`).
  2. Fix `worker/src/routes/push.ts:91-101` to handle `{ payload, token, account } | { blocked }` returned by `authenticateRequest` (rejecting `'blocked' in authSession` with `403` and reading `authSession.payload?.role ?? (authSession as { role?: string }).role`).
  3. Update `worker/src/__tests__/routes/checkin.test.ts:20-22` mock to provide `authenticateRequest: vi.fn().mockResolvedValue({ payload: { id: 'staff-1', role: 'owner' } })` and add a dedicated test verifying unauthenticated/customer role rejection (`401`/`403`) on staff push registration.

### Defect 2 (Test Mock Drift after Order-Existence Security Hardening): `tests/promotions.test.ts:147`
- **Evidence:**
  - `worker/src/routes/promotions-handlers/validation-handlers.ts:261-269` verifies that `data.order_id` exists in `orders` (`SELECT id, tenant_id, status FROM orders WHERE id = ? LIMIT 1`) before redeeming a promotion code, returning `404 { success: false, error: 'Order not found' }` if missing.
  - `tests/promotions.test.ts:8-11` (`createMockD1`) only initializes `promotions` and `promotion_redemptions` tables (`orders` is undefined, so `SELECT ... FROM orders` returns `null` → `404`).
- **Fix:**
  - Seed default test orders (`ord_1`, `ord_2`, `o1`) in `tests/promotions.test.ts` `createMockD1` while keeping an explicit assertion that redeeming against a non-existent order returns `404`.

### Defect 3 (Positional Mock Queue Shift after Unpaid-Delivery Kitchen Gate): `worker/src/__tests__/tree/orders/update-order.test.ts:104-122`
- **Evidence:**
  - `packages/domain/order/policies/order-status-transition.ts:58-74` executes `SELECT order_type, payment_status FROM orders WHERE id = ? AND tenant_id = ?` whenever `targetStatus === 'preparing'` to block unpaid delivery orders from entering kitchen preparation (`409`).
  - `worker/src/__tests__/tree/orders/update-order.test.ts:104-112` (`allows valid transition: confirmed → preparing`) configures a positional `makeDB` queue where `chain[1]` (`{ changes: 1 }`) was consumed by the new `SELECT order_type, payment_status` `.first()` call, shifting the `UPDATE orders` `.run()` call onto `chain[2]` (`makeChain()` with default `changes: 0`), which triggers `409 Order changed concurrently`.
- **Fix:**
  - Provide the `SELECT order_type, payment_status` chain (`makeChain({ order_type: 'dine_in', payment_status: 'unpaid' })`) in `update-order.test.ts:104-112` before the `UPDATE` chain (`{ changes: 1 }`), and add a companion unit test verifying that `confirmed → preparing` on an unpaid `delivery` order returns `409`.

### Defects 4, 5, 6 (Legacy Test Fixtures Using `delivery` + `cod` after Prepaid PayOS Policy):
- **Evidence:**
  - `worker/src/lib/validators/order.ts:49-55` enforces the business policy: `if (data.order_type === 'delivery' && data.payment_method !== 'payos')` → `'Đơn giao tận nơi yêu cầu thanh toán trả trước qua PayOS'`.
  - Three legacy tests still construct `delivery` orders with `payment_method: 'cod'`:
    1. `worker/src/__tests__/lib/validators.test.ts:154-160` (`accepts delivery order when customer_address is provided` uses `...validOrder` which defaults to `payment_method: 'cod'`).
    2. `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts:131-165` (`persists guest checkout using canonical orders and order_items schema` uses `fulfillment_type: 'DELIVERY'` with `payment_method: 'cod'`).
    3. `worker/src/__tests__/routes/orders-snapshot.test.ts:55-80` (`createOrder — response shape snapshot` uses `order_type: 'delivery'` with `payment_method: 'cod'`).
- **Fix:**
  - Do **not** weaken `createOrderSchema` (preserving the PayOS prepaid requirement for delivery orders per mandatory readiness constraints).
  - Update the 3 test fixtures to pass `payment_method: 'payos'` when testing valid `delivery` order creation, and add an explicit unit test in `validators.test.ts` asserting that `order_type: 'delivery'` with `payment_method: 'cod'` fails validation with `'Đơn giao tận nơi yêu cầu thanh toán trả trước qua PayOS'`.

---

## 3. Option Trade-Off Matrix (Binh Pháp Evaluation)

| Option | Scope | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Option A (Recommended): Surgical Production Fix (`push.ts`/`auth.ts`) + Policy-Aligned Test Convergence (4 Phases)** | Fix `push.ts` + `middleware/auth.ts` production bug (`TS2459` + `payload.role` extraction) and align the 5 drifted test suites with the hardened order/promotion security contracts | Achieves **0 errors** across `typecheck:all`, `lint`, and **498/498 Vitest files (`4,716+` tests)** without weakening a single security or business invariant | Requires updating 5 test files alongside 2 worker source files | **SELECTED** |
| **Option B: Relax `createOrderSchema` / `validation-handlers.ts` to make legacy tests pass** | Remove delivery PayOS prepaid check or order existence check on `/redeem` | Zero test edits needed for those 4 files | Violates mandatory constraint ("không ghi đè tiến độ cũ hoặc mở lại toàn bộ PayOS/COD"; "FAIL không đổi thành assertion dễ hơn") | **REJECTED** |
| **Option C: Fix only `typecheck:worker` (`push.ts`) and ignore legacy test suites outside the 218 auth/cutover probes** | Touch only `worker/src/routes/push.ts` and `worker/src/middleware/auth.ts` | Minimal diff (2 files) | Leaves 5 failing test files in full `npx vitest run` | **REJECTED** |

---

## 4. Next-Phase Plan Structure

Saved to [`plans/261030-0630-full-monorepo-typecheck-and-test-suite-zero-failure-convergence/plan.md`](../261030-0630-full-monorepo-typecheck-and-test-suite-zero-failure-convergence/plan.md):
- **Phase 01:** Worker Push Auth Contract & `typecheck:worker` Fix (`worker/src/middleware/auth.ts`, `worker/src/routes/push.ts`, `worker/src/__tests__/routes/checkin.test.ts`)
- **Phase 02:** Promotions `/redeem` Order-Existence & Order Status Transition Test Alignment (`tests/promotions.test.ts`, `worker/src/__tests__/tree/orders/update-order.test.ts`)
- **Phase 03:** Delivery PayOS-Prepaid Policy Test Convergence (`worker/src/__tests__/lib/validators.test.ts`, `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts`, `worker/src/__tests__/routes/orders-snapshot.test.ts`)
- **Phase 04:** Full-Monorepo 498-Suite Verification, Staging Gate Check & Baseline Hash Lock

---

## 5. Unresolved Questions

- None for local engineering scope. External cloud gates (`DB Admin live`, `real roster`, `deployed origin live`, and `GATE_4_STAGING_DRY_RUN` credentials) remain `UNKNOWN/NOT_RUN` until operator approval.
