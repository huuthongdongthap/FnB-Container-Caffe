# CTO Task: Fix Order Flow Pipeline — 11 Issues

> Priority: P0 | Scope: Full order pipeline
> Files: ~12 files across frontend + worker

## Context
Deep audit phát hiện 11 issues trong luồng order. Plan đã approved.
Đọc full plan tại: `~/.gemini/antigravity/brain/b602bcfe-2e89-4d5b-8c64-e8eed22d4be6/implementation_plan.md`

## 5 Components — Thực hiện theo thứ tự

### C1: Session Unification — `js/cart.js`
- Đổi `fnb_session_id` → `aura_session_id` (match `checkout.js`)
- Thêm migration: nếu `fnb_session_id` tồn tại, copy sang `aura_session_id`, xoá key cũ
- Thêm `_log(msg, err)` method (noop production)
- Trong `_request()`: thêm check `if (!response.ok) throw new Error(HTTP ${response.status})`

### C2: Order Response Fix — `worker/src/routes/orders.js`
- `createOrder()` response (L108-117): trả thêm `items`, `total`, `customer_name`, `customer_phone`, `customer_address`, `payment_method`, `shipping_fee`, `discount`, `notes`, `delivery_time`
- Cấu trúc response: `{ success, order: { id, status, payment_status, items, total, customer: { full_name, phone, address }, payment_method, shipping_fee, discount, notes, delivery_time, created_at } }`

### C3: Status Enum Unification — 4 files
1. `worker/src/routes/orders-hono.js`:
   - L109: default status `'pending'` thay `'Bep tiep nhan'`
   - L141: allowed = `['pending', 'preparing', 'ready', 'completed', 'cancelled']`
   - L147: check `'completed'` và `'cancelled'` thay `'Hoan thanh'`/`'Da huy'`
2. `js/kds/kds-api.js` L80: đổi `method: 'POST'` → `method: 'PATCH'`
3. `js/track-order.js`:
   - L144: `order.status` thay `order.order_status`
   - L211: tương tự
   - L233: `order.status` thay `order.order_status || order.status`
   - L116-125: response shape là `result.order` (từ orders.js) — verify match
4. `js/api-client.js` L169: `'Da huy'` → `'cancelled'`; xoá L173-175 (stub payment functions return null)

### C4: Dead Code Cleanup — 2 files
1. `js/checkout.js`:
   - Xoá L354-400 (WebSocket block): `initializeWebSocketTracking()`, `orderWebSocket` variable, `window.orderTracking` export
   - Xoá `initializeWebSocketTracking()` call ở L411
   - Xoá import `sendOrderToWebSocket` ở L22
2. `js/checkout/payment.js`:
   - Xoá function `sendOrderToWebSocket()` (L44-62)
   - Xoá các call `sendOrderToWebSocket(order)` trong `handleCODSuccess`, `handleMoMoPayment`, `handlePayOSPayment`, `handleVNPayPayment`
   - L90: đổi `0901234567` → `0939150386`

### C5: Cart → localStorage-only
- `js/cart.js`: thay toàn bộ API calls (`/api/cart/*`) bằng localStorage operations
  - `getCart()`: đọc từ `localStorage.getItem('aura_cart')`
  - `addToCart()`: push to items array, save localStorage
  - `updateQuantity()`: update quantity in array, save localStorage
  - `removeFromCart()`: filter out item, save localStorage
  - `clearCart()`: `localStorage.removeItem('aura_cart')`
  - Giữ nguyên `_updateCartUI()`, `_renderCartModal()`, tất cả UI logic

## Verification
```bash
npx jest tests/order-flow.test.js tests/order-system.test.js tests/checkout.test.js --verbose
```

## Rules
- KHÔNG thêm dependencies mới
- KHÔNG đổi DB schema
- Commit message: `fix: unify order flow pipeline — 11 issues`
- Chạy tests trước khi commit
