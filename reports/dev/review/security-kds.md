# Staff/KDS and confirmation review — PayOS/COD local flow

Review: 2026-10-20, Asia/Saigon. HEAD `2cf0025a954657ee102c4f655c021a97340cbca4`; current dirty tree included. Environment: macOS/darwin, zsh, npm monorepo.

**Recommendation: HOLD deployment.** The active flow still has tenant authorization and order lifecycle defects. One new role regression blocks legitimate cashier/waiter KDS sessions. Local source findings below need negative-path runtime tests before readiness can be claimed.

## Scope and method

- Primary dirty files: `worker/src/index.ts`, `worker/src/routes/orders-hono-handlers/kds-handlers.ts`, `packages/domain/kitchen/commands/kds-stream.ts`, `src/hooks/use-kds.ts`, `src/pages/order-success.tsx`, `src/hooks/stores/use-order-store.ts`.
- Scouted dependents first: unified and admin order routes, canonical status coordinator, generic order update, checkout/create/mobile writers, tenant middleware, staff login/token helpers, React Query cache, order projections, confirmation components and new tests.
- Reviewed fresh `reports/dev/review/lint.md` and `types.md`: lint and `npm run typecheck:all` PASS. Lint scope is Worker source only; these results are not runtime proof.
- This reviewer changed only this report. No product code, Git state, credentials, network/cloud or production changes. Coordinating reviewer owns local SQL/runtime/browser checks; no duplicate full test suite run here.
- FACT = verified in current source. Reproduction descriptions are local cases to exercise; unless separately reported by the coordinator, they are not claimed as executed runtime tests.

## P1 — Sensitive order writes bypass tenant isolation and canonical transitions

**FACT; pre-existing dependency still used by the dirty KDS frontend.**

- `src/hooks/use-kds.ts:186` and `:204` send real KDS mutations to `/api/admin/orders/:id/status`; the fallback at `:191` calls `/complete`.
- `worker/src/routes/features-router.ts:77` permits staff/kitchen/barista/chef/waiter/cashier. At `:91-108`, the status handler validates only a status allowlist, then updates `orders WHERE id = ?`. No tenant, previous-status or actor transition check. `/complete` at `:110-124` has the same issue.
- The alternative `/api/orders/:id/status` path is also unsafe across tenants: `worker/src/routes/orders-hono-handlers/kds-handlers.ts:93-102` passes no tenant; `packages/domain/kitchen/commands/kds-status-transition.ts:52` and `:96` select/update by ID only. `KdsTransitionOptions` has no tenant field.
- Generic `PATCH /api/orders/:id` remains ID-only in `packages/domain/order/commands/update-order.ts:31` and `:67`, although direct payment-status changes are now correctly rejected.

**Trigger:** login as staff/kitchen for `cafe-a`; send a valid transition for a known `cafe-b` order ID. The admin alias additionally allows kitchen to set a cancelled/completed order back to preparing or directly complete it.

**Impact:** unauthorized cross-store state mutation and terminal-order resurrection; read-side tenant filtering cannot prevent this write path.

**Fix:** make all aliases call one coordinator with a verified actor and effective tenant; scope both SELECT and UPDATE; apply actor/state checks on every alias. Test wrong tenant returns 404/403 without DB/event writes and terminal transitions stay rejected.

## P1 — New outer KDS authorization rejects legitimate waiter/cashier sessions

**FACT; dirty regression.**

- `worker/src/index.ts:85-93` installs `kdsRoles` without `waiter` or `cashier` on both queue aliases and SSE.
- Inner routes intentionally allow both roles in `worker/src/routes/orders-unified.ts:56` and `:62`; admin order routes also allow both.
- Dirty `src/hooks/use-kds.ts:125` switches polling from the admin endpoint to the newly restricted endpoint.
- New auth tests cover role `staff` for queue/SSE and `cashier` only for settlement; they miss this role matrix.

**Trigger:** valid signed cashier/waiter token, `GET /api/kds/orders` or `/api/orders/kds`; outer middleware returns 403 before the inner allowlist. SSE is also blocked.

**Impact:** authenticated operational users see a loading/error screen after the endpoint switch.

**Fix:** use one intended KDS role policy for both middleware layers. Exercise queue, SSE and status permissions for all supported operational roles, plus customer/anonymous rejections.

## P1 — COD collection prematurely completes kitchen work

**FACT; pre-existing behavior retained in a changed handler.**

- `worker/src/routes/orders-hono-handlers/kds-handlers.ts:138-150` permits pending/preparing COD orders to be collected.
- At `:155` and `:159`, collection unconditionally writes `status = 'completed'` together with `payment_status = 'paid'`; `:177` publishes completed.
- KDS queue at `:30` and stream `packages/domain/kitchen/commands/kds-stream.ts:104` exclude completed orders.

**Trigger:** cashier collects COD while order is pending/preparing. The ticket disappears from other terminals even though preparation is unfinished. The new `kds-auth.test.ts` uses a preparing order but asserts HTTP success and SQL tenant binding only.

**Impact:** money collection can hide unfinished orders and falsely mark fulfilment complete.

**Fix:** record collection independently of fulfilment status. If a separate finish action is intended, enforce its own valid transition. Test pending/preparing COD remains in KDS after collection and only disappears after real fulfilment.

## P1 — Order creation does not establish a trusted tenant matching the queue

**FACT in source; operational effect depends on non-default tenant usage. Existing writer weakness, newly relevant to strict queue filtering.**

- `worker/src/lib/validators/order.ts:38` accepts arbitrary request `tenant_id`; `packages/domain/order/commands/create-order.ts:116` persists it directly. JWT ownership resolution at `:76-89` retains only identity/role, not tenant.
- `src/pages/checkout.tsx:104-136` supplies no trusted store identity, so new web orders default to `default`.
- Mobile/POS/guest writers omit tenant entirely, e.g. `worker/src/routes/orders-mobile.ts:129-135` and `worker/src/routes/orders-hono-handlers/checkout-handlers.ts:56-66`; schema default is `default`.
- KDS queue/SSE now use the signed tenant (`kds-handlers.ts:28-32`, `kds-stream.ts:101-108`). Device login additionally omits tenant claims (`packages/domain/staff/commands/staff-auth.ts:216-218`) while email login loads them from D1 (`worker/src/tree/auth/login.ts:46-64`).

**Trigger:** staff/store `cafe-a` creates an order without tenant, or device login is used for a non-default store. Creation/read identity can diverge; web-created orders default outside the intended branch queue. A crafted POST can also inject an arbitrary branch ID.

**Impact:** missing orders for franchise staff and untrusted cross-store routing.

**Fix:** derive staff tenant from verified identity and guest store from trusted host/table/store mapping; enforce table/store ownership and consistent tenant claims across login methods. Do not repair by trusting a client tenant header or removing filters. Test creation → payment → correct tenant queue and wrong-tenant exclusion.

## P2 — KDS cache preserves tickets removed by the authoritative server

**FACT; pre-existing merge behavior retained after endpoint semantics changed.**

- `src/hooks/use-kds.ts:137-143` retains old preparing/ready tickets absent from the fresh active queue. SSE at `:169-170` independently preserves absent ready tickets.
- Query keys at `:122`, `:135` and `:167` contain station only. `src/hooks/stores/use-auth-store.ts:118-129` clears auth storage but does not clear this query cache.

**Trigger:** terminal B serves/cancels/completes an order that terminal A cached as ready; A receives a fresh queue/snapshot excluding it. The merge retains it indefinitely. In a shared browser, account/tenant switching can retain A's ready/preparing records in B's cache.

**Impact:** ghost tickets, incorrect counts and possible old-tenant data shown after account switching.

**Fix:** treat complete active queue/snapshots as authoritative replacement. Bind caches/streams to authenticated actor and effective tenant, close/reset on identity changes. Test deletion/terminal transition from another client and A → logout → B login.

## P2 — Check-then-update transitions can overwrite concurrent terminal changes

**FACT; pre-existing coordinator defect.**

- `packages/domain/kitchen/commands/kds-status-transition.ts:51-54` reads current status; `:96-98` updates by ID only after validation.
- COD collection similarly reads state then writes without previous-status/payment predicate (`kds-handlers.ts:125-160`).

**Trigger:** request A reads preparing; request B cancels it; A's later ready/paid write overwrites cancellation. Both requests may return success and publish incompatible events.

**Fix:** compare-and-set WHERE tenant/id/status/payment state matches the validated row, check affected-row count, and publish only the successful transition. Test deterministic interleaving of cancellation and preparation/collection.

## P2 — Confirmation still advertises preparation regardless of real order/payment state

**FACT; pre-existing presentation dependency, still used by the changed confirmation page.**

- `src/pages/order-success.tsx:138-152` omits `status` and `paymentStatus` and supplies a constant 10 minutes.
- `src/components/stitch/StitchOrderSuccessNew-types.ts:19-31` has no order/payment status; `PROGRESS_PERCENT` is always 50 at `:53`.
- `src/components/stitch/StitchOrderSuccessNew-tracking.tsx:157-163` always renders “Đang pha chế”.
- Tests labelled pending/completed in `src/pages/__tests__/order-success-polling.test.tsx` assert only that the ID renders, not the status label.

**Trigger:** view confirmation for unpaid PayOS, cancelled, ready or completed order; the badge still says preparing and progress is fixed.

**Fix:** pass authoritative payment/fulfilment states into presentation and assert labels/progress for pending payment, COD unpaid, preparing, ready, completed and cancelled. Keep payment confirmation separate from redirect query parameters.

## Verified improvements and remaining evidence limits

- New checkout creation paths examined use a shared PayOS/COD allowlist; historical read enums may remain broad without enabling those methods. Generic order PATCH no longer accepts payment status.
- Queue and SSE source now include pending, confirmed, preparing and ready and bind effective tenant. KDS item mappers support both name/product_name and quantity/qty. Query volume is bounded to 50 orders; migration `20261004_01_multi_tenant_franchise.sql:34-35` supplies tenant/created and tenant/status indexes.
- Confirmation now rejects empty detail as a retry state; same-order detail fetch and `/track` fallback are present. Real browser test of API/SSE ordering and real local DB schema remains the coordinator's check.
- SSE now puts the full bearer JWT in its URL (`use-kds.ts:162`). Auth verifies it; no anonymous KDS exposure found on these routes. Application metrics/error logs use `c.req.path`, excluding query strings. Proxy/Cloudflare request-URL logging retention is UNKNOWN; do not claim a verified token disclosure without log evidence. Prefer short-lived scoped stream credentials or authenticated fetch streaming in follow-up.
- No numerical coverage/readiness score assigned. Fresh lint/type PASS does not cover these authorization, concurrency or lifecycle cases.

## Unresolved questions

- What trusted store mapping should guest checkout use for multi-store deployments, and must staff device sessions support non-default tenants?
- Is COD collected before serving an intended supported operation? Current endpoint permits it; fulfilment should not be silently inferred from payment.
- Are full request URLs recorded by any staging/production edge logging path, and are token query parameters redacted there?
