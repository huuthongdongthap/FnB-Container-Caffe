# Frontend Audit Findings / Kết quả kiểm toán Frontend

**Scope / Phạm vi:** `src/`, `apps/`, and `packages/` except `packages/domain/payment` and backend. Read README, architecture and cart/checkout audit docs, relevant checkout/auth/cart tests. `apps/*` contains package manifests only. Prioritized checkout, cart, session/auth and shared order/catalog contracts; sampled other domain package entry points, policies and tests. This was not a line-by-line review of all 1,443 source files. No source changes.

**Coverage / Độ bao phủ:** Reviewed 1,217 files under `src/` and 226 files under in-scope `packages/` by inventory, then traced the above high-impact flows and relevant domain paths. Identified two reproducible correctness findings. No speculative style findings.

## Findings / Phát hiện

### High — Same-user token refresh clears the active cart / Làm trống giỏ hàng khi làm mới token của cùng người dùng

- **Location:** [`src/lib/client-session.ts:59-73`](../../src/lib/client-session.ts#L59) publishes a session event after every `saveClientSession`; [`src/lib/client-session.ts:141-159`](../../src/lib/client-session.ts#L141) treats a changed token as a changed session snapshot; [`src/hooks/stores/use-cart-store.ts:217-223`](../../src/hooks/stores/use-cart-store.ts#L217) clears the cart on every such snapshot change. The recurring refresh path is [`src/hooks/use-mobile-auth.tsx:18-39`](../../src/hooks/use-mobile-auth.tsx#L18), which saves the renewed token at line 38.
- **Scenario and trace:** A staff member adds items or selects a table, then opens the mobile app with a saved device. The refresh returns a new token for the same user and tenant. `saveClientSession` publishes; token inequality trips `isSameSessionSnapshot`; the cart subscriber invokes `clearCart()`, deleting cart items and table context. This was reproduced with the real session/cart modules: one item and table `05` became zero items and a null table after saving a replacement token for the same identity.
- **Regression evidence:** Existing mobile-auth refresh tests verify the renewed token is synchronized, and cart-store tests verify `clearCart`; the focused 49-test run passed. Those tests do not assert that renewal for an unchanged user/tenant preserves the cart. The intended account-switch clearing condition at `client-session.ts:63` compares user, tenant and role, not token.
- **Fix / focused regression:** Publish a cart/account-scope change only when identity, tenant or role changes (while still publishing token updates for auth consumers). Add a test that renews the token for the same identity and preserves items/table, plus a different-user case that clears them.

### High — Split bill drops canonical product IDs and modifiers / Chia hóa đơn làm mất ID sản phẩm chuẩn và tùy chọn món

- **Location:** [`src/hooks/split-bill-helpers.ts:47-53`](../../src/hooks/split-bill-helpers.ts#L47) serializes only `i.id`, name, client price and quantity. The cart retains canonical `productId` and modifiers in [`src/hooks/stores/use-cart-store.ts:66-90`](../../src/hooks/stores/use-cart-store.ts#L66). The server resolves the catalog product and validates modifiers from product ID/modifiers in [`packages/domain/order/policies/order-snapshot.ts:49-83`](../../packages/domain/order/policies/order-snapshot.ts#L49).
- **Scenario and trace:** A customized drink has a composite cart `id` but canonical `productId` (the existing cart test demonstrates `tc001-Size L (+5k)_50% đường` alongside `productId: tc001` and modifiers). `buildSplitOrders` drops the canonical ID and modifier choices, sending the composite ID as `id` alone. The order snapshot then tries to resolve that composite ID as a catalog product; if it is resolvable by a non-composite ID, required choices are still absent. Split submission is rejected or loses the selected customization instead of creating the intended orders.
- **Regression evidence:** Cart-store tests cover preservation of the canonical ID and modifier data for customized drinks. The scoped scan found no split-bill payload regression test. The canonical order snapshot code confirms the server-side catalog/modifier contract; it is authoritative for price, so trusting the client price is not a proposed fix.
- **Fix / focused regression:** Include `product_id`/`productId` and validated modifier identifiers in each split item (and the canonical order payload fields expected by the shared contract). Add a split-bill test asserting a customized cart item produces a resolvable product ID plus modifiers, and a contract test verifying server repricing and modifier validation succeed.

## Existing checks and non-findings / Kiểm tra và điểm không phải lỗi

- Focused tests run: **5 files, 49 tests passed** (cart store, mobile auth, checkout intent/retry, private-session cache). This does not cover the split payload gap above.
- The request-provided baseline says lint/typechecks and 5,939 tests pass; those full baseline checks were not rerun here. Type-coverage and aggregate coverage percentages were not measured.
- Existing auth protections covered in the focused tests include stale mobile login/refresh rejection, logout invalidation, and keeping sessions on ordinary 403/outage responses. The split endpoint performs server-side price resolution; the finding is loss of required product/modifier input, not client-controlled pricing.

## Recommended actions / Hành động đề xuất

1. Separate token refresh from account-scope changes before publishing events that reset cart state; add same-user refresh preservation coverage.
2. Preserve canonical product identity and customization in split-order serialization; add client payload and server contract regression tests.

Status: DONE_WITH_CONCERNS
Summary: Two checkout-integrity defects found; focused 49-test suite passed. Reviewed high-impact cart, auth and order contracts; the remaining in-scope files were not line-by-line reviewed.
Concerns/Blockers: Full-project lint/typecheck/test baseline was supplied by the caller and not rerun; broader package surfaces received sampled rather than exhaustive review.
