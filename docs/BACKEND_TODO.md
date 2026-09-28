# AURA CAFE Backend Implementation Backlog (Claude Code CLI Action Plan)

> **Instructions for Claude Code CLI**:
> Execute the tasks below in strict order of priority (`P0` -> `P1` -> `P2`).
> Before editing each file, run the associated test command. After making changes, run the acceptance test command and verify zero regressions via `npx tsc --noEmit`.

---

## Task Summary Table

| Task ID | Priority | Module | Summary |
| :--- | :--- | :--- | :--- |
| **TASK-1** | **P0** | Order Domain | Enforce `table_id` validation when `order_type` is omitted or `dine_in` |
| **TASK-2** | **P0** | CORS Middleware | Fix wildcard `*` origin on error responses with credentials |
| **TASK-3** | **P0** | Payment Domain | Allow guest checkout on `POST /api/payment/create-link` |
| **TASK-4** | **P0** | D1 Binding | Rename `c.env.DB` -> `c.env.AURA_DB` in loyalty, inventory, and promotions |
| **TASK-5** | **P0** | Reservation Domain | Secure `GET /api/reservations` and status mutations with `requireAuth` |
| **TASK-6** | **P0** | Payment API | Implement `POST /api/payments/payment-request` for Apple/Google Pay |
| **TASK-7** | **P1** | Order Handlers | Sanitize SQL `ORDER BY` clause against column injection |
| **TASK-8** | **P1** | Payment Schema | Align `payOSCreateLinkSchema` with `usePaymentStore` request payload |
| **TASK-9** | **P2** | SSE Handlers | Add event replay buffer to `GET /api/orders/:id/events` |
| **TASK-10**| **P2** | Order Domain | Implement idempotency key caching with 120s TTL |

---

## Detailed Task Specifications

### TASK-1: Enforce `table_id` validation when `order_type` is omitted or `dine_in`
- **Priority**: `P0 (Blocker)`
- **File cần sửa**:
  - `worker/src/lib/validators/order.ts`
  - `packages/domain/order/commands/create-order.ts`
- **Vấn đề hiện tại**:
  - In `worker/src/lib/validators/order.ts:32`, `order_type` is defined as optional: `order_type: z.enum(['dine_in', 'takeaway']).optional()`.
  - The `.superRefine` check only triggers if `data.order_type === 'dine_in'`. If `order_type` is undefined, validation passes without `table_id`.
  - In `packages/domain/order/commands/create-order.ts:58`, default assignment is `const orderType = body.order_type ?? 'dine_in'`.
  - Result: Guest orders created without `order_type` default to dine-in in database, but have `table_id: null`, causing kitchen display systems (KDS) to fail to route tickets to tables.
- **Expected behavior**:
  - Schema must default `order_type` to `'dine_in'` or require `table_id` whenever `order_type` is `'dine_in'` OR `undefined`.
  - Return HTTP 400 Bad Request with:
    ```json
    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "table_id là bắt buộc khi chọn dùng tại bàn (dine_in)"
      }
    }
    ```
- **Acceptance test**:
  ```bash
  # cURL test against local worker:
  curl -s -X POST http://localhost:8787/api/orders \
    -H "Content-Type: application/json" \
    -d '{"customer_name":"Test Customer","items":[{"product_id":"11111111-1111-4111-a111-111111111111","product_name":"Espresso","quantity":1,"unit_price":29000}]}' \
    | jq '.error.code'
  # Expected output: "VALIDATION_ERROR"
  ```

---

### TASK-2: Fix CORS error response headers for credentialed requests
- **Priority**: `P0 (Blocker)`
- **File cần sửa**:
  - `worker/src/middleware/cors.ts`
- **Vấn đề hiện tại**:
  - In `worker/src/middleware/cors.ts:24-42`, `errorResponse` sets `Access-Control-Allow-Origin: *`.
  - Frontend client `src/lib/api-client.ts:64` sets `credentials: 'include'` on all `fetch` requests.
  - The W3C Fetch Spec strictly forbids returning wildcard `*` when `Access-Control-Allow-Credentials: true` is present or when credentials mode is `'include'`.
  - Result: When a 400 validation error or 401 error occurs, modern browsers (Chrome/Safari) block reading the JSON response due to CORS header violation, misreporting it to the user as a generic "Network Failure" instead of showing validation error messages.
- **Expected behavior**:
  - `errorResponse` must inspect the incoming `Origin` header. If `Origin` is present and matches the allowed domain list (or in local development `localhost`), return that exact origin with `Vary: Origin` and `Access-Control-Allow-Credentials: true`.
- **Acceptance test**:
  ```bash
  curl -I -s -X POST http://localhost:8787/api/orders \
    -H "Origin: http://localhost:5173" \
    -H "Content-Type: application/json" \
    -d '{}' \
    | grep -iE 'access-control-allow-origin|access-control-allow-credentials'
  # Expected output:
  # access-control-allow-origin: http://localhost:5173
  # access-control-allow-credentials: true
  ```

---

### TASK-3: Allow guest checkout on `POST /api/payment/create-link`
- **Priority**: `P0 (Blocker)`
- **File cần sửa**:
  - `packages/domain/payment/commands/payos-create-link.ts`
- **Vấn đề hiện tại**:
  - Lines 47-49:
    ```typescript
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 'Unauthorized', 401);
    }
    const customerId = user.id;
    ```
  - Customer shell users browsing the menu or scanning table QR codes do not log in. When they submit checkout on `src/pages/checkout.tsx`, this route returns `401 Unauthorized`. Guest customers cannot pay.
- **Expected behavior**:
  - Remove mandatory authentication on `POST /api/payment/create-link`.
  - If `c.get('user')` is undefined, set `customerId = null` or read `customer_phone` / `customer_name` from request body.
- **Acceptance test**:
  ```bash
  curl -s -X POST http://localhost:8787/api/payment/create-link \
    -H "Content-Type: application/json" \
    -d '{"order_id":"test-order-uuid","amount":50000,"description":"AURA B01"}' \
    | jq '.success'
  # Expected output: true (or valid PayOS response, NOT 401)
  ```

---

### TASK-4: Fix D1 database binding name mismatch across OpenAPI handlers
- **Priority**: `P0 (Blocker)`
- **File cần sửa**:
  - `worker/src/routes/openapi-loyalty-handlers/routes.ts`
  - `worker/src/routes/openapi-inventory-handlers/routes.ts`
  - `worker/src/routes/openapi-promotions-handlers/routes.ts`
  - `worker/wrangler.toml`
- **Vấn đề hiện tại**:
  - `wrangler.toml` declares D1 binding: `binding = "AURA_DB"`.
  - Over 30 handlers in `openapi-loyalty-handlers`, `openapi-inventory-handlers`, and `openapi-promotions-handlers` attempt to access `c.env.DB`.
  - Because `c.env.DB` is undefined, invoking any loyalty lookup, stock check, or promotion validation throws:
    `TypeError: Cannot read properties of undefined (reading 'prepare')` resulting in unhandled 500 crashes.
- **Expected behavior**:
  - Define unified database accessor helper `function getDB(c: Context) { return c.env.AURA_DB ?? c.env.DB; }`.
  - Replace all occurrences of `c.env.DB` with `getDB(c)`.
- **Acceptance test**:
  ```bash
  curl -s http://localhost:8787/api/loyalty/lookup?phone=0946013633 | jq '.success'
  # Expected output: true (not 500 error)
  ```

---

### TASK-5: Secure `GET /api/reservations` and status mutations
- **Priority**: `P0 (Security Blocker)`
- **File cần sửa**:
  - `packages/domain/reservation/src/routes/reservations.ts`
- **Vấn đề hiện tại**:
  - Line 117: `app.get('/', async (c) => ...)` has NO auth check. Any unauthenticated anonymous visitor on the internet can call `GET /api/reservations` and dump every customer's name, phone number, booking time, and special requests notes (critical PII leak).
  - Lines 140, 154, 169: `PATCH /:id/approve`, `PATCH /:id/reject`, `DELETE /:id` have no authentication checks, allowing public visitors to cancel or approve arbitrary restaurant reservations.
- **Expected behavior**:
  - Apply `requireAuth(['owner', 'staff'])` middleware to:
    - `GET /api/reservations/` (listing all reservations)
    - `PATCH /api/reservations/:id/approve`
    - `PATCH /api/reservations/:id/reject`
    - `DELETE /api/reservations/:id`
  - Maintain `GET /api/reservations/availability` and `POST /api/reservations` as public.
- **Acceptance test**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/reservations
  # Expected output: 401
  ```

---

### TASK-6: Implement `POST /api/payments/payment-request` for Apple / Google Pay
- **Priority**: `P0 (Blocker)`
- **File cần sửa**:
  - `worker/src/routes/openapi-payments-handlers/routes.ts`
  - `packages/domain/payment/commands/process-web-payment.ts` (new handler)
- **Vấn đề hiện tại**:
  - Storefront checkout (`src/pages/checkout.tsx:141`) submits Apple Pay / Google Pay payment sheets to `POST /api/payments/payment-request`.
  - No matching route exists on the backend. Requests hit default 404 handler, breaking modern mobile wallet payments.
- **Expected behavior**:
  - Add route `POST /api/payments/payment-request` accepting `{ order_id, payment_method, token, amount }`.
  - Validate payment token, update order `payment_status = 'paid'`, and return `{ success: true, data: { transaction_id, status: 'succeeded' } }`.
- **Acceptance test**:
  ```bash
  curl -s -X POST http://localhost:8787/api/payments/payment-request \
    -H "Content-Type: application/json" \
    -d '{"order_id":"ord_test_01","payment_method":"apple_pay","token":{"payment_data":"tok_123"},"amount":50000}' \
    | jq '.data.status'
  # Expected output: "succeeded"
  ```

---

### TASK-7: Sanitize SQL `ORDER BY` clause against column injection
- **Priority**: `P1 (High)`
- **File cần sửa**:
  - `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts`
- **Vấn đề hiện tại**:
  - Lines 94-100:
    ```typescript
    const sort = c.req.query('sort') ?? 'created_at';
    const order = c.req.query('order') ?? 'desc';
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const query = `SELECT * FROM orders ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
    ```
  - Unlike `packages/domain/order/queries/shared-listing.ts` which uses `safeSortColumn()`, this handler concatenates raw query parameter strings into the SQL statement, exposing SQL injection vulnerability.
- **Expected behavior**:
  - Use a strict whitelist of sortable columns: `const ALLOWED_SORT_COLUMNS = ['created_at', 'total_amount', 'status', 'order_number'] as const;`.
  - Force `order` to either `'ASC'` or `'DESC'`.
- **Acceptance test**:
  ```bash
  curl -s "http://localhost:8787/api/orders?sort=created_at%3B+DROP+TABLE+orders--&order=asc" \
    | jq '.error.code'
  # Expected output: "VALIDATION_ERROR" or fallback to default created_at
  ```

---

### TASK-8: Align `payOSCreateLinkSchema` with frontend `usePaymentStore` body payload
- **Priority**: `P1 (High)`
- **File cần sửa**:
  - `packages/domain/payment/schemas/payos.ts`
- **Vấn đề hiện tại**:
  - `usePaymentStore.ts` in frontend sends:
    `{ orderId: string, amount: number, description: string, returnUrl?: string }`.
  - Backend schema expects snake_case:
    `{ order_id: string, amount: number, description: string, return_url?: string }`.
  - CamelCase payloads fail Zod validation with 400.
- **Expected behavior**:
  - Update schema with `.transform()` or `.or()` to gracefully accept both `orderId`/`order_id` and `returnUrl`/`return_url`.
- **Acceptance test**:
  ```bash
  curl -s -X POST http://localhost:8787/api/payment/create-link \
    -H "Content-Type: application/json" \
    -d '{"orderId":"test-uuid","amount":45000,"description":"AURA B02"}' \
    | jq '.success'
  # Expected output: true
  ```

---

### TASK-9: Add event replay buffer to `GET /api/orders/:id/events` SSE
- **Priority**: `P2 (Medium)`
- **File cần sửa**:
  - `worker/src/routes/orders-hono-handlers/query-handlers.ts`
- **Vấn đề hiện tại**:
  - When mobile customers momentarily lose 4G/WiFi connectivity and reconnect with `Last-Event-ID`, missed status events are not replayed. Customers remain stuck on "Đang chuẩn bị" even when their order is ready.
- **Expected behavior**:
  - Query recent order event logs from D1 / KV since `Last-Event-ID` on connection initialization and replay them before streaming new live events.
- **Acceptance test**:
  ```bash
  curl -s -N -H "Last-Event-ID: 1" http://localhost:8787/api/orders/ord_test_01/events
  # Stream should immediately output historical status events before waiting.
  ```

---

### TASK-10: Implement Idempotency-Key caching with 120s TTL
- **Priority**: `P2 (Medium)`
- **File cần sửa**:
  - `packages/domain/order/commands/create-order.ts`
- **Vấn đề hiện tại**:
  - If a user on poor connectivity double-taps "Xác Nhận Đặt Món", two identical orders are created and charged twice.
- **Expected behavior**:
  - Read `Idempotency-Key` header. Cache key in Cloudflare KV with 120s TTL. Return cached response for duplicate requests.
- **Acceptance test**:
  ```bash
  # Send 2 consecutive requests with identical Idempotency-Key
  KEY=$(uuidgen)
  curl -s -H "Idempotency-Key: $KEY" -X POST ...
  curl -s -H "Idempotency-Key: $KEY" -X POST ...
  # Second request returns the exact same order id without creating a new record.
  ```

