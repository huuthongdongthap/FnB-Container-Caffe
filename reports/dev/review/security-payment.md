# PayOS/COD security and correctness review

Reviewed 2026-10-20, Asia/Saigon. Workspace: `/Users/mac/mekong-cli/FnB-Container-Caffe`; macOS/darwin, zsh, C.UTF-8, npm monorepo. Baseline: `HEAD 2cf0025a954657ee102c4f655c021a97340cbca4`; dirty implementation included. Review/report only; no product edits, Git mutation, cloud calls, deployment, or test execution by this worker.

## Assessment

**Local release blockers remain.** Six findings below are verified from current source and compared to `git show HEAD:<path>`. Runtime reproduction is the coordinating local-flow runner's responsibility; source-proven defects are not claimed as production incidents. No P0 finding established.

Read `reports/dev/review/lint.md` and `types.md`: both commands passed with their documented scope. Neither proves the payment authorization, concurrency, recovery, or kitchen-state contracts below. No numeric quality or coverage score assigned.

## Findings

### P1 — Public writers permit underpriced PayOS orders

**Fact:** `worker/src/routes/orders-hono-handlers/guest-handlers.ts:174-194` resolves catalog price only when submitted `item.price` is absent/nonpositive. A positive attacker-supplied price is kept and summed into persisted total at lines 199-205. Public route: `worker/src/routes/orders-unified.ts:50`.

A second public path accepts request `discount` through `worker/src/lib/validators/order.ts:26`, forwards it at `packages/domain/order/commands/create-order.ts:40-46`, and subtracts it without promotion validation at `packages/domain/order/policies/order-snapshot.ts:162-166`. Public route: `orders-unified.ts:61`.

**Reproduce locally:** For a catalog item costing 20,000, submit guest checkout with `price=1000`, `qty=1`, `payment_method=payos`; or submit canonical checkout with that item and `discount=19000`. Both persist a 1,000 total. `packages/domain/payment/commands/payos-create-link.ts:64-72` faithfully charges that persisted total; webhook amount matching cannot detect the earlier underpricing.

**Impact:** Server-total validation provides no protection against these boundary bypasses; a valid provider payment can settle an underpriced order.

**Provenance:** Both defects exist in HEAD. Dirty diff adds method validation but leaves the pricing paths reachable.

**Fix:** Route all public creation paths through the canonical catalog calculation; ignore client unit price. Derive discounts from validated server promotion rules/entitlements; permit explicit discounts only for authorized staff under a bounded policy. Add forged-price and forged-discount request regressions across the public aliases.

### P1 — Refund path authorizes role but not linked-order tenant

**Fact:** The live `/api/payments/refund` handler is mounted at `worker/src/routes/features-router.ts:144-145` before the OpenAPI router. `worker/src/routes/refunds-handlers/mutation-handlers.ts:18` accepts staff, waiter and cashier; lines 36-48 fetch payment solely by id; lines 91-101 send the provider refund request without checking the order's tenant or actor's financial permission within that tenant. The route has no tenant middleware or tenant predicate. The only later order lookup, at lines 117-119, fetches customer id for loyalty reversal.

**Reproduce locally:** Seed tenant B's completed PayOS payment. Authenticate a tenant A cashier/waiter, submit B's payment id to `/api/payments/refund`, and intercept provider fetch locally. The request reaches the refund fetch rather than returning 403/404. A tenant A cashier can first discover B's payment ids through the unscoped listing at `worker/src/routes/openapi-payments-handlers/read-handlers.ts:114-125`.

**Impact:** A franchise user can inspect and initiate refunds against another tenant's payments using shared merchant credentials. Whether the provider ultimately accepts the refund is a separate runtime question; the authorization boundary is already crossed before the outbound call.

**Provenance:** Present in HEAD; not introduced by this diff. Direct dependency of the remaining PayOS flow.

**Fix:** Resolve tenant from the signed identity; join payment to order and enforce tenant/financial permission before reading detailed payment data or calling the provider. Apply the same scope to list/get/create payment handlers; define an explicit HQ exception.

### P1 — Concurrent create-link requests can issue two payable invoices

**Fact:** `packages/domain/payment/commands/payos-create-link.ts:92-118` checks for an existing payment, then separately generates a new code and calls PayOS at lines 142-145. Persistence occurs afterward in `packages/domain/payment/commands/payos-helpers.ts:129-138`. The unique index in `worker/db/migrations/20260825_01_payments_txn_unique.sql:5-6` only protects transaction id, not order id or one active attempt per order. Two different generated codes do not conflict.

**Reproduce locally:** Hold the first mocked provider response after its payment lookup; start a second create-link request for the same unpaid order. Both lookups miss, both provider calls receive different order codes, and both rows can be inserted. The webhook completes each separate pending payment (`worker/src/routes/webhooks-handlers/payos.ts:141-152`) even after the order has been paid by the other.

**Impact:** Retries/double taps/two tabs can produce two chargeable links for one order; later webhooks count both as successful payment/revenue events.

**Provenance:** Existing HEAD defect; current read-then-write idempotency remains unchanged.

**Fix:** Atomically reserve one active payment attempt per order before provider creation, with a durable uniqueness/compare-and-set invariant and recoverable provider-attempt state. Return the same existing attempt for simultaneous requests. Test concurrent creation and a delayed provider response using isolated D1 and a local provider stub.

### P1 — Alternate PayOS webhook can permanently lose order settlement after partial failure

**Fact:** `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts:99-110` first marks `payments.status=completed`, then executes a separate order update. If the second statement fails, the request throws and returns an error, but the first write remains. The provider's retry hits the early return at lines 76-79 and acknowledges without repairing `orders.payment_status`.

**Reproduce locally:** Deliver a correctly signed success payload to `/api/payments/webhook/payos`; fault-inject one failure for `UPDATE orders` after allowing `UPDATE payments` to succeed. Replay the identical webhook. Replay returns success while the order stays unpaid. The primary `/api/webhook/payos` route has an explicit repair branch at `worker/src/routes/webhooks-handlers/payos.ts:111-123`, so the two enabled URLs have different guarantees.

**Impact:** Customer actually pays, provider retries successfully, but Staff/order tracking continues to see unpaid state.

**Provenance:** The handler ordering/early return exist in HEAD. Dirty schema changes make this alternate handler usable with the real nested PayOS envelope; the incomplete recovery remains. Current provider webhook configuration is **Unknown** and was not inspected remotely.

**Fix:** Reuse one canonical verified settlement function for both URLs, with a D1 atomic payment/order update or idempotent repair after a completed payment. Test partial write failure and replay through both public aliases.

### P2 — COD collection removes an unfinished kitchen order

**Fact:** `worker/src/routes/orders-hono-handlers/kds-handlers.ts:137-159` permits COD collection from pending/confirmed/preparing/ready, and unconditionally changes both `payment_status=paid` and `status=completed`. Its event at lines 177-180 also announces completed. The active KDS query at lines 28-32 and SSE query in `packages/domain/kitchen/commands/kds-stream.ts:100-109` exclude completed.

**Reproduce locally:** Create a pending or preparing COD order, collect cash using a permitted cashier session, refresh KDS. The unprepared order disappears and customer tracking claims completion even though no kitchen transition occurred.

**Impact:** Collecting cash at the counter can suppress food/drink preparation.

**Provenance:** Present in HEAD; dirty diff narrows collection authorization and adds tenant filtering but retains this mutation.

**Fix:** Keep fulfillment status unchanged when recording cash collection; publish a paid event. Complete fulfillment only through the authorized state transition. If policy requires collecting COD only at delivery/completion, explicitly enforce that policy instead of accepting every active status.

### P2 — New outer KDS middleware rejects cashier/waiter sessions

**Fact:** `worker/src/index.ts:85-93` adds an outer KDS allowlist without cashier or waiter. The canonical router still explicitly allows those roles at `worker/src/routes/orders-unified.ts:56,62`. The outer middleware rejects before the inner contract can be applied.

**Reproduce locally:** Authenticate a valid tenant-scoped cashier/waiter and GET `/api/orders/kds` or `/api/kds/orders`; receive 403. An ordinary staff token succeeds. The frontend now uses `/api/kds/orders`.

**Impact:** Valid POS staff see a loading/error state despite having the role supported by the order router. This can recreate the original operational symptom for those roles.

**Provenance:** **Introduced by dirty diff** for `/api/orders/kds`: HEAD mounts the canonical router before the new middleware, and its route authorizes cashier/waiter. The alias had narrower middleware before; adding the same restriction to both URLs spreads the incompatibility.

**Fix:** Define a single role policy shared by KDS outer middleware, queue handler, SSE and UI authorization. Include cashier/waiter if the existing canonical contract is retained; otherwise change the product role contract explicitly and test that decision.

## Edge-case scouting and verified protections

- Scouted dependents beyond the diff: all mounted payment/refund routers, public guest/split/canonical order writers, pricing policy, unique index, auth/tenant policy, COD collection and two webhook URLs.
- Current create-link rejects non-PayOS orders; the old COD-paid shortcut is gone. Generic order PATCH rejects payment_status writes. New payment methods use a PayOS/COD allowlist while historic response values remain readable.
- Primary webhook verifies signature and successful amount before a fresh settlement; conditional payment transition limits same-payment concurrent retries. Its completed-payment branch can repair order state. COD collection checks both authorized role and tenant on its canonical route.
- No N+1 finding assigned without operational evidence. Catalog/split order lookups are per item; a later performance pass should measure large carts before proposing batching. No unbounded network test was executed.

## Verification limits and unresolved questions

- This worker performed source/diff review only; parent owns local Miniflare/D1/KV/browser execution. Reproduction scenarios above are source-proven paths, not claimed runtime results. No production PayOS/D1/schema state verified.
- `scout` skill entry was located/read; it is a thin `mekong scout` dispatcher. No external dispatcher was executed under the local/no-network review constraint. `code-review`/`ck-code-review` skill entry and the named checklist directory were not found in the available skill roots; manual two-pass critical/informational review used the provided review checklist.
- Which public webhook URL is configured with PayOS? Both currently run and need the same guarantees.
- Should COD collection preserve preparation state or be accepted only after delivery? Current API supports collecting early but also completes fulfillment.
- Should waiter/cashier retain the KDS access already declared by the canonical router?
