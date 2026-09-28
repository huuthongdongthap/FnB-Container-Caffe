# AURA CAFE Backend Architecture & Code Review

> **Target**: Cloudflare Workers / Hono v4.7 / D1 Database  
> **Auditor**: Pipeline Conductor / Project Orchestrator  
> **Status**: Comprehensive Security & Architecture Review  
> **Date**: 2026-09-25

---

## 1. Executive Summary

A comprehensive architectural and security audit of the AURA CAFE backend was conducted across the `worker/` service and `packages/domain/` packages. The system demonstrates solid design patterns in domain-driven separation and modern OpenAPI typing, but suffers from several critical edge-case defects, CORS misconfigurations, and authentication omissions that directly impact production stability and customer checkout flows.

### Issue Severity Distribution
- **P0 (Critical / Blocker)**: 5 issues (CORS credential failure, PayOS guest checkout blocker, D1 binding collision, public customer PII leak, missing web payment route)
- **P1 (High)**: 2 issues (SQL query injection in order sort handler, casing mismatch in payment link creation)
- **P2 (Medium)**: 2 issues (Lack of SSE event replay buffer, missing order creation idempotency)

---

## 2. In-Depth Vulnerability & Architecture Reviews

---

### Issue REV-01 (P0): CORS Wildcard Origin with Credentials Blocks Error Responses
- **Category**: Security & Cross-Origin Resource Sharing (CORS)
- **File & Line**: `worker/src/middleware/cors.ts:28-40`
- **Impact**: Modern browsers completely block frontend error inspection on failed requests.

#### Problem Analysis
When the frontend invokes API endpoints via `src/lib/api-client.ts`, it specifies `credentials: 'include'`. When an API endpoint fails validation (e.g. invalid phone number on order placement), Hono invokes `errorResponse(c, message, 400)`.

In `worker/src/middleware/cors.ts`:
```typescript
// CURRENT DEFECTIVE CODE:
export function errorResponse(c: Context, message: string, status: ContentfulStatusCode = 400) {
  return c.json({
    success: false,
    error: { message }
  }, status, {
    'Access-Control-Allow-Origin': '*', // <-- VIOLATION
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
}
```
Under W3C Fetch / CORS specifications, when a request is made with `credentials: 'include'`, a response header of `Access-Control-Allow-Origin: *` is treated as a **fatal CORS violation**. The browser drops the response payload and logs `CORS policy: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'`. As a result, the frontend cannot read the error details and alerts the user with a misleading "Network Error".

#### Proposed Fix
Inspect the incoming request `Origin` header and echo the trusted origin:
```typescript
// PROPOSED FIX:
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://auracafe.vn',
  'https://staging.auracafe.vn'
];

export function getCorsOrigin(c: Context): string {
  const origin = c.req.header('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.auracafe.vn')) {
    return origin;
  }
  return ALLOWED_ORIGINS[0]!;
}

export function errorResponse(c: Context, message: string, status: ContentfulStatusCode = 400) {
  return c.json({
    success: false,
    error: { message }
  }, status, {
    'Access-Control-Allow-Origin': getCorsOrigin(c),
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
  });
}
```

---

### Issue REV-02 (P0): PayOS Checkout Enforces Mandatory Authentication, Breaking Storefront Guest Checkout
- **Category**: Authentication / Business Logic Blocker
- **File & Line**: `packages/domain/payment/commands/payos-create-link.ts:47-51`
- **Impact**: Guest customers scanning QR codes on dining tables are unable to generate payment links.

#### Problem Analysis
In `payos-create-link.ts`:
```typescript
// CURRENT DEFECTIVE CODE:
export async function payOSCreateLink(c: Context) {
  const user = c.get('user');
  if (!user) {
    return errorResponse(c, 'Unauthorized', 401);
  }
  const customerId = user.id;
  ...
}
```
A dining customer visiting `https://auracafe.vn/menu` or scanning a table QR code does not create an account or log in; they are anonymous guests. When `checkout.tsx` calls `POST /api/payment/create-link`, this check immediately rejects them with 401.

#### Proposed Fix
Make user session optional. For guests, associate the payment link with `customer_phone` or `order_id`:
```typescript
// PROPOSED FIX:
export async function payOSCreateLink(c: Context) {
  const user = c.get('user');
  const customerId = user?.id ?? null;
  const body = await c.req.json();
  
  // Associate order with customerId if authenticated, or leave null for guest
  ...
}
```

---

### Issue REV-03 (P0): Unauthenticated Customer PII Leak in Reservation Listing & Deletion
- **Category**: Security / Data Privacy (GDPR / Decree 13/2023/ND-CP)
- **File & Line**: `packages/domain/reservation/src/routes/reservations.ts:117-175`
- **Impact**: Anyone on the internet can list all customer reservations, see private names, phone numbers, and delete bookings.

#### Problem Analysis
In `reservations.ts`:
```typescript
// CURRENT DEFECTIVE CODE:
// Line 117:
app.get('/', async (c) => {
  const results = await c.env.AURA_DB.prepare('SELECT * FROM reservations ORDER BY reserved_at DESC').all();
  return c.json({ success: true, data: results.results });
});

// Line 140:
app.patch('/:id/approve', async (c) => { ... });

// Line 169:
app.delete('/:id', async (c) => { ... });
```
None of these management routes are protected by auth middleware. Anyone who sends a simple GET to `/api/reservations` receives a complete JSON dump of all customer reservations, exposing phone numbers and customer identities. Furthermore, anyone can cancel or approve any customer reservation without authorization.

#### Proposed Fix
Wrap all administrative endpoints in role-checking middleware:
```typescript
// PROPOSED FIX:
import { requireAuth } from '@/middleware/auth';

const adminRouter = new Hono();
adminRouter.use('*', requireAuth(['owner', 'staff']));

adminRouter.get('/', async (c) => { ... });
adminRouter.patch('/:id/approve', async (c) => { ... });
adminRouter.patch('/:id/reject', async (c) => { ... });
adminRouter.delete('/:id', async (c) => { ... });

app.route('/', adminRouter);
```

---

### Issue REV-04 (P0): D1 Binding Collision Between `c.env.DB` and `c.env.AURA_DB`
- **Category**: Cloudflare Workers Runtime Stability
- **File & Line**: 
  - `worker/src/routes/openapi-loyalty-handlers/routes.ts:35`
  - `worker/src/routes/openapi-inventory-handlers/routes.ts:42`
  - `worker/src/routes/openapi-promotions-handlers/routes.ts:51`
- **Impact**: Runtime fatal exceptions (`Cannot read properties of undefined (reading 'prepare')`) on loyalty and promotion lookups.

#### Problem Analysis
The `wrangler.toml` file configures the D1 database binding as:
```toml
[[d1_databases]]
binding = "AURA_DB"
database_name = "aura-cafe-prod"
database_id = "..."
```
However, developers who wrote the loyalty, inventory, and promotions OpenAPI handlers accessed the binding via `c.env.DB`:
```typescript
// CURRENT DEFECTIVE CODE:
const stmt = c.env.DB.prepare('SELECT * FROM loyalty_cards WHERE phone = ?');
```
Because `c.env.DB` is `undefined`, every single lookup throws an uncaught JavaScript exception at the edge, resulting in HTTP 500 crashes.

#### Proposed Fix
Introduce a centralized environment resolver in `worker/src/lib/db.ts`:
```typescript
// PROPOSED FIX:
import type { Context } from 'hono';

export function getDatabase(c: Context) {
  const db = c.env.AURA_DB ?? c.env.DB;
  if (!db) {
    throw new Error('D1 database binding missing: expected AURA_DB');
  }
  return db;
}
```
And replace direct property accesses with `getDatabase(c)`.

---

### Issue REV-05 (P1): Direct SQL String Concatenation in Order Read Handler
- **Category**: Security / SQL Injection
- **File & Line**: `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts:94-102`
- **Impact**: Potential SQL injection via order sorting query parameters.

#### Problem Analysis
```typescript
// CURRENT CODE:
const sort = c.req.query('sort') ?? 'created_at';
const order = c.req.query('order') ?? 'desc';
const orderClause = `${sort} ${order.toUpperCase()}`;
const query = `SELECT * FROM orders ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
```
While Cloudflare D1 uses parameterized queries for `LIMIT` and `OFFSET`, the `ORDER BY` clause cannot be parameterized in SQLite. Concatenating `sort` directly allows an attacker to inject arbitrary SQL statements or extract unauthorized data via SQLite boolean-based blind injection.

#### Proposed Fix
Enforce an explicit column whitelist:
```typescript
// PROPOSED FIX:
const VALID_SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  total_amount: 'total_amount',
  order_number: 'order_number',
  status: 'status',
};

const sortParam = c.req.query('sort') ?? 'created_at';
const sortColumn = VALID_SORT_COLUMNS[sortParam] ?? 'created_at';
const orderDir = (c.req.query('order') ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

const query = `SELECT * FROM orders ORDER BY ${sortColumn} ${orderDir} LIMIT ? OFFSET ?`;
```

---

## 3. Architecture & Edge Best Practices Recommendations

1. **Zero-Trust Input Validation**:
   All request parameters, query strings, and request bodies should be strictly validated using Zod schemas at the edge middleware level before invoking domain logic.
2. **Cloudflare KV Session Caching**:
   Replace stateless JWT token verification with lightweight Cloudflare KV caching for fast session invalidation and role revocation.
3. **Idempotency on Payment & Order Mutators**:
   Adopt standard `Idempotency-Key` headers on all mutative financial endpoints (`/api/orders`, `/api/payment/create-link`). Use Cloudflare Workers KV with 120-second expiration to prevent duplicate billing during network retries.
4. **Structured JSON Logging**:
   Ensure all caught exceptions and audit events log structured JSON with correlation IDs (`cf-ray` header) for distributed tracing across edge locations.

