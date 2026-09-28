# AURA CAFE Backend API Specification

> **Version**: 1.0.0-rc1  
> **Host**: Cloudflare Workers (Hono v4.7+)  
> **Database**: Cloudflare D1 (`AURA_DB`)  
> **Runtime / Framework**: Edge Workers, TypeScript, Zod Schema Validation  
> **Target Audience**: Backend Engineers, Claude Code CLI, Frontend Integrators  
> **Last Updated**: 2026-09-25

---

## 1. Overview & Architectural Conventions

### 1.1 Architecture & Edge Routing
The backend runs on **Cloudflare Workers** utilizing **Hono v4.7+**. The system is split across:
- `worker/src/index.ts`: Worker entry point mounting routers under `/api/*`.
- `packages/domain/`: Domain logic engines (Order, Payment, Reservation, Loyalty).
- `worker/src/routes/openapi-*-handlers/`: OpenAPI-driven handlers.
- `worker/src/middleware/`: CORS, Authentication (`auth.ts`), Error handling, Rate limiting.

### 1.2 Authentication & Security
- **Bearer Token**: `Authorization: Bearer <jwt_token>` (for Admin, POS, Staff).
- **Session Cookie**: `auth_token=<jwt_token>` (HttpOnly, Secure, SameSite=Lax).
- **Public Endpoints**: `/api/menu`, `/api/orders` (guest dine-in/takeaway), `/api/reservations/availability`, `/api/reservations` (booking submission), `/api/payment/create-link` (guest payment initialization).
- **Protected Endpoints**: Roles `customer`, `staff`, `owner`.

### 1.3 Common Response Envelopes
All JSON endpoints follow standardized envelope patterns:

#### Success Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional status message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

#### Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `500`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | INTERNAL_ERROR",
    "message": "Human-readable error description",
    "details": [
      {
        "field": "table_id",
        "issue": "table_id is required when order_type is dine_in"
      }
    ]
  }
}
```

---

## 2. API Endpoints Specification

### 2.1 Menu Endpoints

#### 2.1.1 `GET /api/menu`
Fetches the public menu categories, drink items, modifiers, and stock status.

- **Status**: `IMPLEMENTED` (`worker/src/routes/openapi-products-handlers/routes.ts`, `packages/domain/catalog`)
- **Frontend Caller**: `src/hooks/use-customer-menu.ts`, `src/pages/menu.tsx`
- **Auth**: Public (`None`)
- **Cache**: Cloudflare Edge Cache `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
- **Headers**:
  - `Accept: application/json`

##### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `category` | `string` | No | `all` | Filter by category slug (e.g. `ca-phe`, `tra-trai-cay`, `da-xay`) |
| `available_only` | `boolean` | No | `true` | When true, omit sold-out items |
| `search` | `string` | No | `""` | Search query matching item title or description |

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cat_coffee",
        "name": "Cà Phê Pha Máy",
        "slug": "ca-phe",
        "sort_order": 1,
        "is_active": true
      }
    ],
    "items": [
      {
        "id": "prod_espresso",
        "category_id": "cat_coffee",
        "name": "Espresso Đá",
        "description": "Cà phê Robusta Đắk Lắk đậm đà, chiết xuất áp suất cao",
        "base_price": 29000,
        "image_url": "/photos/IMG_6565.webp",
        "is_available": true,
        "options": [
          {
            "id": "opt_sugar",
            "name": "Đường",
            "choices": [
              { "id": "sugar_100", "name": "100% Đường", "price_delta": 0, "is_default": true },
              { "id": "sugar_50", "name": "50% Đường", "price_delta": 0, "is_default": false },
              { "id": "sugar_0", "name": "Không Đường", "price_delta": 0, "is_default": false }
            ]
          },
          {
            "id": "opt_ice",
            "name": "Đá",
            "choices": [
              { "id": "ice_100", "name": "100% Đá", "price_delta": 0, "is_default": true },
              { "id": "ice_50", "name": "50% Đá", "price_delta": 0, "is_default": false },
              { "id": "ice_0", "name": "Không Đá", "price_delta": 0, "is_default": false }
            ]
          }
        ]
      }
    ]
  }
}
```

---

#### 2.1.2 `GET /api/menu/:id`
Fetches a single menu item with its full modifier trees, nutrition info, and stock counts.

- **Status**: `IMPLEMENTED` (`worker/src/routes/openapi-products-handlers/routes.ts`)
- **Auth**: Public (`None`)
- **URL Parameters**:
  - `id`: `string` (UUID or product slug, e.g. `prod_espresso`)

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "prod_espresso",
    "name": "Espresso Đá",
    "description": "Cà phê Robusta Đắk Lắk",
    "base_price": 29000,
    "image_url": "/photos/IMG_6565.webp",
    "is_available": true,
    "options": [ ... ]
  }
}
```

---

### 2.2 Order Endpoints

#### 2.2.1 `POST /api/orders`
Creates a new customer order (dine-in with table QR or takeaway).

- **Status**: `IMPLEMENTED WITH DEFECT` (`packages/domain/order/commands/create-order.ts`, `worker/src/lib/validators/order.ts`)
- **Defect**: When `order_type` is omitted, domain defaults to `'dine_in'`, but validator allows optional `table_id`, creating orphaned dine-in orders.
- **Frontend Caller**: `src/hooks/stores/use-order-store.ts:placeOrder()`, `src/pages/checkout.tsx`
- **Auth**: Public (`guest`) or Authenticated (`customer`, `staff`)
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key`: `string` (UUID v4 recommended)

##### Request Body Schema (`application/json`)
```typescript
interface CreateOrderRequest {
  customer_name: string;        // Min 2 chars, max 100 chars
  customer_phone?: string;      // Regex: /^(0|\+84)[3|5|7|8|9][0-9]{8}$/
  order_type: 'dine_in' | 'takeaway' | 'delivery'; // Default: 'dine_in'
  table_id?: string;           // Required IF order_type === 'dine_in'
  notes?: string;              // Max 500 chars
  items: Array<{
    product_id: string;        // UUID
    product_name: string;      // Snapshot title
    quantity: number;          // Integer >= 1, <= 99
    unit_price: number;        // Integer >= 0 (VND)
    selected_options?: Array<{
      group_id: string;
      group_name: string;
      choice_id: string;
      choice_name: string;
      price_delta: number;
    }>;
  }>;
  payment_method?: 'payos' | 'cash' | 'vietqr' | 'apple_pay'; // Default: 'payos'
}
```

##### Response `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "ord_882947192",
    "order_number": "AURA-2609-0042",
    "status": "pending",
    "order_type": "dine_in",
    "table_id": "tbl_04",
    "table_number": "Bàn 04 (Container Tầng Trệt)",
    "customer_name": "Nguyễn Văn A",
    "total_amount": 87000,
    "item_count": 2,
    "payment_status": "unpaid",
    "created_at": "2026-09-25T10:15:30Z",
    "sse_events_url": "/api/orders/ord_882947192/events"
  }
}
```

##### Response `400 Bad Request` (Validation Error)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Yêu cầu không hợp lệ",
    "details": [
      {
        "field": "table_id",
        "issue": "table_id is required when order_type is dine_in"
      }
    ]
  }
}
```

---

#### 2.2.2 `GET /api/orders/:id`
Fetches real-time status and itemized breakdown of a specific order.

- **Status**: `IMPLEMENTED` (`packages/domain/order/queries/get-order.ts`, `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts`)
- **Frontend Caller**: `src/hooks/use-order.ts`, `src/pages/order-success.tsx`, `src/pages/stitch/track-order/index.tsx`
- **Auth**: Public with ID (or session match)
- **URL Parameters**:
  - `id`: `string` (Order UUID, e.g. `ord_882947192`)

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "ord_882947192",
    "order_number": "AURA-2609-0042",
    "status": "preparing",
    "status_history": [
      { "status": "pending", "timestamp": "2026-09-25T10:15:30Z" },
      { "status": "confirmed", "timestamp": "2026-09-25T10:16:10Z" },
      { "status": "preparing", "timestamp": "2026-09-25T10:17:00Z" }
    ],
    "estimated_ready_time": "2026-09-25T10:27:00Z",
    "total_amount": 87000,
    "payment_status": "paid",
    "items": [
      {
        "id": "ord_item_01",
        "product_name": "Espresso Đá",
        "quantity": 2,
        "unit_price": 29000,
        "subtotal": 58000,
        "selected_options": [
          { "group_name": "Đường", "choice_name": "50% Đường" }
        ]
      }
    ]
  }
}
```

---

#### 2.2.3 `GET /api/orders/:id/events` (Server-Sent Events)
Live real-time stream of order progression events (`confirmed` -> `preparing` -> `ready` -> `completed` / `cancelled`).

- **Status**: `IMPLEMENTED` (`worker/src/routes/orders-hono-handlers/query-handlers.ts:handleOrderEvents`)
- **Frontend Caller**: `src/pages/order-success.tsx`, `src/hooks/use-order-events.ts`
- **Protocol**: HTTP/1.1 SSE or HTTP/2 Server-Sent Events
- **Headers**:
  - `Accept: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`

##### Stream Frame Payload
```
event: order_update
data: {"order_id":"ord_882947192","status":"preparing","updated_at":"2026-09-25T10:17:00Z","message":"Bếp đang chuẩn bị món của bạn"}

event: ping
data: {"time":"2026-09-25T10:17:30Z"}
```

---

### 2.3 Payment Endpoints

#### 2.3.1 `POST /api/payment/create-link`
Generates a PayOS checkout payment URL and QR code for VietQR mobile banking.

- **Status**: `IMPLEMENTED WITH DEFECT` (`packages/domain/payment/commands/payos-create-link.ts`)
- **Defect**: Line 47 calls `requireAuth(['customer', 'owner', 'staff'])` and accesses `c.get('user').id`. Guest storefront checkout has no session and returns `401 Unauthorized`.
- **Frontend Caller**: `src/pages/checkout.tsx:processPayOSPayment()`, `src/hooks/stores/use-payment-store.ts`
- **Auth**: Must support `public / guest` as well as authenticated users.
- **Headers**:
  - `Content-Type: application/json`

##### Request Body Schema
```typescript
interface CreatePayOSLinkRequest {
  order_id: string;            // UUID or order reference
  amount: number;              // Total integer VND, >= 1000
  description: string;         // Max 25 chars (PayOS banking format: "AURA 2609-0042")
  return_url?: string;         // Redirect URL upon payment success
  cancel_url?: string;         // Redirect URL upon payment cancellation
  customer_name?: string;      // Guest or member name
}
```

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "checkout_url": "https://pay.payos.vn/web/3b9e4a81-...",
    "payment_link_id": "plink_894172",
    "qr_code": "00020101021238580010A00000072701280006970422...",
    "account_number": "1028391823",
    "account_name": "AURA CAFE SA DEC",
    "amount": 87000,
    "description": "AURA 2609-0042",
    "order_code": 26090042
  }
}
```

---

#### 2.3.2 `POST /api/payments/payment-request`
Processes native Apple Pay and Google Pay Web Payments tokens.

- **Status**: `FRONTEND-ONLY / UNIMPLEMENTED` (404 on backend)
- **Frontend Caller**: `src/pages/checkout.tsx:141`
- **Required Backend Implementation**: New route in `worker/src/routes/openapi-payments-handlers/` to validate payment sheet tokens and mark order as paid.
- **Auth**: Public (`guest`)
- **Headers**:
  - `Content-Type: application/json`

##### Request Body Schema
```typescript
interface PaymentRequestSubmission {
  order_id: string;
  payment_method: 'apple_pay' | 'google_pay';
  token: {
    payment_data: string;      // Encrypted token payload or ephemeral transaction ID
    card_brand?: string;       // "Visa", "MasterCard"
    last4?: string;            // "4242"
  };
  amount: number;
}
```

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx_ap_9841284",
    "status": "succeeded",
    "order_id": "ord_882947192",
    "paid_at": "2026-09-25T10:18:00Z"
  }
}
```

---

#### 2.3.3 `POST /api/webhooks/payos`
Asynchronous webhook receiver for PayOS transaction confirmations.

- **Status**: `IMPLEMENTED` (`packages/domain/payment/commands/payos-webhook.ts`)
- **Auth**: HMAC-SHA256 signature verification (`x-payos-signature` header or payload `signature`)
- **Headers**:
  - `Content-Type: application/json`

##### Request Body
```json
{
  "code": "00",
  "desc": "success",
  "data": {
    "orderCode": 26090042,
    "amount": 87000,
    "description": "AURA 2609-0042",
    "accountNumber": "1028391823",
    "reference": "FT2609004291823",
    "transactionDateTime": "2026-09-25 17:18:00",
    "paymentLinkId": "plink_894172"
  },
  "signature": "8a7c6f5d4e3..."
}
```

##### Response `200 OK`
```json
{ "success": true, "message": "Webhook processed" }
```

---

### 2.4 Reservation Endpoints

#### 2.4.1 `GET /api/reservations/availability`
Checks table availability by target date and time slot.

- **Status**: `IMPLEMENTED` (`packages/domain/reservation/src/routes/reservations.ts:80`)
- **Frontend Caller**: `src/hooks/use-reservations.ts`, `src/pages/stitch/reservation-new/index.tsx`
- **Auth**: Public (`None`)

##### Query Parameters
| Parameter | Type | Required | Example |
| :--- | :--- | :--- | :--- |
| `date` | `string` | Yes | `2026-09-25` (YYYY-MM-DD) |
| `time` | `string` | Yes | `19:30` (HH:mm) |
| `zone` | `string` | No | `rooftop` |

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "date": "2026-09-25",
    "time": "19:30",
    "tables": [
      {
        "id": "tbl_01",
        "table_number": "01",
        "zone": "Sân Ngoài Trời",
        "capacity": 4,
        "available": true
      },
      {
        "id": "tbl_02",
        "table_number": "02",
        "zone": "Phòng Container",
        "capacity": 6,
        "available": false,
        "reserved_until": "2026-09-25T21:00:00Z"
      }
    ]
  }
}
```

---

#### 2.4.2 `POST /api/reservations`
Submits a table reservation for customer review and booking.

- **Status**: `IMPLEMENTED` (`packages/domain/reservation/src/routes/reservations.ts:32`)
- **Frontend Caller**: `src/hooks/use-reservations.ts:createReservation()`
- **Auth**: Public (`None`)

##### Request Body Schema
```typescript
interface CreateReservationRequest {
  table_id: string;            // UUID of table
  customer_name: string;       // Min 2 chars
  customer_phone: string;      // Valid VN phone
  guest_count: number;         // Integer 1 - 50
  date: string;                // YYYY-MM-DD
  time: string;                // HH:mm
  special_requests?: string;   // Optional notes (max 500 chars)
}
```

##### Response `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "res_9812401",
    "booking_code": "AURA-8124",
    "status": "pending_confirmation",
    "customer_name": "Nguyễn Văn A",
    "table_number": "01",
    "zone": "Sân Ngoài Trời",
    "guest_count": 4,
    "reserved_at": "2026-09-25T19:30:00Z",
    "created_at": "2026-09-25T10:19:00Z"
  }
}
```

---

### 2.5 Loyalty Endpoints

#### 2.5.1 `GET /api/loyalty/lookup`
Looks up customer loyalty points, membership tier, and available redemption vouchers by phone number.

- **Status**: `PARTIALLY IMPLEMENTED WITH DEFECT` (`worker/src/routes/openapi-loyalty-handlers/routes.ts`)
- **Defect**: Accesses `c.env.DB` instead of `c.env.AURA_DB`, triggering unhandled 500 exceptions at runtime.
- **Frontend Caller**: `src/hooks/use-account.ts`, `src/pages/stitch/loyalty-calc/index.tsx`, `src/pages/checkout.tsx`
- **Auth**: Public with rate-limiting (10 req/min per IP to prevent harvesting)

##### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `phone` | `string` | Yes | Customer phone number (`0946013633`) |

##### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "customer_id": "cust_19827",
    "phone": "0946013633",
    "full_name": "Lê Hoàng Yến",
    "tier": "AURA Silver",
    "points_balance": 450,
    "cashback_available": 45000,
    "vouchers": [
      {
        "id": "vch_10k",
        "code": "AURASILVER10",
        "discount_amount": 10000,
        "min_order_value": 50000,
        "expires_at": "2026-10-31T23:59:59Z"
      }
    ]
  }
}
```

---

### 2.6 Authentication Endpoints

#### 2.6.1 `POST /api/auth/login`
Authenticates store staff, POS operators, or store owners.

- **Status**: `IMPLEMENTED` (`worker/src/routes/openapi-auth-handlers/routes.ts`)
- **Auth**: Public
- **Headers**:
  - `Content-Type: application/json`

##### Request Body Schema
```typescript
interface LoginRequest {
  username: string;            // Min 3 chars
  password: string;            // Min 6 chars
  role?: 'staff' | 'owner' | 'pos';
}
```

##### Response `200 OK`
Sets `auth_token` HttpOnly cookie and returns user profile:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_owner_01",
      "username": "aura_admin",
      "display_name": "Quản Lý Cửa Hàng",
      "role": "owner"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 3. Discrepancy Matrix: Frontend Callers vs Worker Implementation

| Endpoint | Frontend Caller | Worker Implementation | Discrepancy / Bug Identified | Severity |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/orders` | `use-order-store.ts:placeOrder` | `packages/domain/order/commands/create-order.ts` | When `order_type` omitted, defaults to `dine_in`, but `table_id` is optional in schema, leading to dine-in orders without tables. | **P0** |
| `POST /api/payment/create-link` | `checkout.tsx`, `use-payment-store.ts` | `packages/domain/payment/commands/payos-create-link.ts` | Backend strictly enforces `requireAuth(['customer', 'owner', 'staff'])`, causing guest checkout to fail with 401. | **P0** |
| `POST /api/payments/payment-request` | `checkout.tsx:141` | None | Completely missing in backend. Frontend gets 404 when user selects Apple Pay / Google Pay. | **P0** |
| `GET /api/reservations` | Admin portal | `packages/domain/reservation/src/routes/reservations.ts` | Endpoint is unauthenticated; dumps customer full names, phone numbers, and reservation notes. | **P0** |
| `GET /api/loyalty/lookup` | `use-account.ts` | `worker/src/routes/openapi-loyalty-handlers/routes.ts` | Handler accesses `c.env.DB` instead of `c.env.AURA_DB`, throwing runtime TypeError. | **P0** |
| `worker/src/middleware/cors.ts` | `src/lib/api-client.ts` | `worker/src/middleware/cors.ts:errorResponse` | `errorResponse` sets `Access-Control-Allow-Origin: *` while frontend passes `credentials: include`. Browsers reject 400 validation error responses due to CORS spec violation. | **P0** |
| `GET /api/orders` | Staff POS | `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts` | `orderClause` interpolates user `sort` param directly into SQL `ORDER BY` string without sanitization. | **P1** |

