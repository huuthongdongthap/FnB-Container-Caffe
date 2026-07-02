# QR Code Table Ordering for FnB-Container-Caffe — Research Report

**Date:** 2026-07-02
**Author:** workflow-subagent
**Context:** FnB-Container-Caffe project at /Users/macbook/FnB-Container-Caffe

---

## 1. Current System State (Pre-Audit)

The existing system already has the core infrastructure for QR ordering:

| Component | Status | Details |
|-----------|--------|---------|
| **cafe_tables** | EXISTS | `id, table_number, zone, capacity, status` (Available/Occupied/Reserved/Overdue) |
| **Menu API** | EXISTS | `GET /api/menu` with category/availability/search filters |
| **Cart UI** | EXISTS | `menu.html` with localStorage cart, sidebar, mobile tabs |
| **Checkout** | EXISTS | Checkout flow in JS, posts to `POST /api/orders` |
| **Orders API** | EXISTS | `POST /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status` |
| **Payments** | EXISTS | PayOS integration via `POST /api/payment/create-link` |
| **Webhooks** | EXISTS | PayOS IPN webhook at `POST /api/webhook/payos` |
| **KDS** | EXISTS | `kds.html` with 3s polling, kanban columns (pending/preparing/ready/served) |
| **Reservations** | EXISTS | `POST /api/reservations` with table allocation |
| **Table status** | EXISTS | `PATCH /api/tables/:id/status` (staff only) |
| **TastyIgniter** | EXISTS | Separate self-hosted online ordering platform |

---

## 2. QR Table Ordering — Concept & Flow

### User Flow (Customer)

```
1. Customer sits at table with QR code sticker
2. Scans QR code -> opens table-specific URL
3. URL carries table_id param (e.g., /menu?table=T001)
4. Customer browses menu, adds items to cart
5. Customer enters name/phone (optional for loyalty)
6. Customer chooses payment: PayOS (online) or Pay-at-counter (COD)
7. If PayOS -> redirected to PayOS gateway -> returns on success
8. Order submitted -> pushed to KDS
9. Staff prepares order -> marks "ready" in KDS
10. Staff serves to table number
11. Table status auto-updates: Available -> Occupied -> Available
```

### Staff Flow

```
1. KDS displays new order with table number
2. Staff accepts/prepares order (status: preparing)
3. Staff marks ready (status: ready)
4. Staff serves to table (status: served)
5. Table auto-cleared after payment confirmation
```

---

## 3. Architecture & Components Required

### 3.1 Backend (Worker Routes)

**New/Modified Files:**

| File | Action | Purpose |
|------|--------|---------|
| `worker/src/routes/orders-hono.ts` | MODIFY | Add `table_id` to `createOrderInputSchema` and insert. Add auto `Occupied` table status on order create |
| `worker/src/routes/tables.ts` | MODIFY | Add `PATCH /api/tables/:id/occupy` and `PATCH /api/tables/:id/release` (no-auth, session-key guarded) |
| `worker/src/routes/menu.ts` | NO CHANGE | Menu already supports all filters needed |
| `worker/src/lib/validators.ts` | MODIFY | Add `tableOrderSchema` for table-scoped orders |
| `worker/src/routes/payments.ts` | NO CHANGE | PayOS already links to orders by `order_id` |

**New API Endpoints:**

```
POST /api/orders/table
  Body: { table_id, items, customer_name?, customer_phone?, payment_method }
  Actions: create order with table_id, set table status to Occupied, push to KDS
  Auth: none (session-key in QR URL)

PATCH /api/tables/:id/release
  Body: { session_key }
  Actions: set table status to Available, verify order completed/paid
  Auth: session-key verification
```

### 3.2 Database

**Minor schema additions needed:**

```sql
-- Add qr_code table (optional, for QR token management)
CREATE TABLE IF NOT EXISTS table_qr_codes (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    session_key TEXT NOT NULL UNIQUE,
    active INTEGER DEFAULT 1,
    generated_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

-- Add index to orders for table-based lookups
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
```

The existing `cafe_tables` table only needs a `qr_code_url` TEXT column added (or this can be computed by convention: `/menu?table=TABLE_NUMBER`).

### 3.3 Frontend

**New/Modified Pages:**

| File | Action | Purpose |
|------|--------|---------|
| `menu.html` | MODIFY | Detect `?table=` param, auto-set table context in cart, show table number in header |
| `js/menu.js` | MODIFY | Pass table_id on checkout, show table banner, handle table-specific state |
| `js/cart.js` | MODIFY | Include table_id in order payload |
| `js/checkout.js` | MODIFY | Table-aware checkout (skip address, show table #) |
| New: `generate-qr.html` | CREATE | Admin page to generate/print QR codes per table |
| New: `js/qr-admin.js` | CREATE | QR generation logic using qrcode.js library |

**Existing pages that need NO changes:**
- `kds.html` — already shows `table_id` column; orders with table_id will display the table number
- `success.html` — already generic
- `failure.html` — already generic

### 3.4 QR Code Generation

Approach: **Convention-based URLs** (no DB needed for basic case)

```
Format: https://auraspace.cafe/menu?table={table_number}
Example QR content: https://auraspace.cafe/menu?table=B01
```

The admin page `generate-qr.html` would:
1. Fetch all tables from `GET /api/tables`
2. Generate QR codes as PNG/SVG using `qrcodejs` (MIT, CDN-loaded)
3. Render print-friendly layout with table number + QR code per card
4. Staff prints on sticker paper, affixes to tables

**QR library:** `qrcodejs` (minified, ~7KB) loaded from CDN — no npm dependency needed.

### 3.5 Session Security (Optional)

For basic v1: the `table` param is visible in URL. A customer could manually type another table number. Acceptable risk for a cafe where:
- No access to other customers' orders (orders are by phone/name)
- Can only order items to your own table
- Staff verifies table number at service

For v2 with payment: the `table_id` becomes a session key that ties the order to the physical table. PayOS payment confirmation + KDS fulfillment + table-release forms the security chain. No hard auth needed.

---

## 4. Integration Points

### 4.1 With Existing Orders System

Current `POST /api/orders` (from `create-order.ts`) accepts:
- `items`, `total`, `customer_name`, `customer_phone`, `customer_email`, `payment_method`, etc.
- Does NOT include `table_id`

The `POST /api/orders/checkout` (from `orders-hono.ts`) DOES include `table_id` in the schema but the frontend doesn't pass it.

**Integration:** Add `table_id` to the frontend cart/checkout flow and ensure both order creation endpoints handle it.

### 4.2 With Payments System

PayOS (`POST /api/payment/create-link`) links to orders by `order_id`. Table-scoped orders work identically — the payment links to the order, not the table. After payment webhook confirms success, the order status updates and KDS picks it up.

**No changes needed** to the payment flow.

### 4.3 With KDS

KDS (`kds.html` + `kds-app.js`) polls `GET /api/kds/orders?status=pending` every 3 seconds. The KDS card shows `table_id` if present. Existing KDS already supports table number display.

**Minor frontend change:** Make the table number prominent (larger font, badge style) in KDS cards so kitchen staff can see it at a glance.

### 4.4 With Table Management

Current table status flow:
- `Available` -> staff sets to `Occupied` manually via `PATCH /api/tables/:id/status`
- `Reserved` -> set by reservation system

**New auto-flow:**
- Customer submits table order -> table auto-set to `Occupied`
- Payment confirmed + order served -> table auto-released to `Available`
- Staff can still manually override

### 4.5 With TastyIgniter

TastyIgniter is a separate self-hosted online ordering system (for delivery/takeaway). The QR table ordering is for **dine-in only**. These are complementary channels:
- QR ordering = dine-in, table service
- TastyIgniter = delivery/takeaway/online pre-order

**No conflict or integration needed.**

---

## 5. Staff Workflow Impact

### Positive
- **Reduced workload**: Customers enter their own orders, reducing waiter order-taking
- **Faster service**: Orders go directly to KDS, no verbal handoff errors
- **Table turnover**: Auto-detection of occupied/available tables
- **Upsell opportunity**: Digital menu with images, descriptions, combos
- **Reduced human error**: No misheard orders or lost paper tickets

### Changes to Staff Process
1. **Host/ess**: Still seats customers, gives table number (points to QR)
2. **Kitchen**: Same KDS flow; now also sees table numbers more prominently
3. **Server**: Brings food to table, no need to take orders verbally
4. **Cashier**: Handles pay-at-counter COD orders; PayOS is self-service

### Training Required
- Minimal: staff needs to know QR stickers correspond to table numbers
- KDS already in use — no retraining needed
- How to handle edge cases (customer without phone, large group splitting bill)

---

## 6. Competitive Advantage

### For the Cafe (AURA CAFE Container at Sa Dec)
1. **First-mover in Sa Dec**: Most local cafes lack QR ordering — instant differentiation
2. **Labor optimization**: Reduce FOH staff by 1-2 persons during peak hours
3. **Faster table turns**: 5-10 minutes saved per table (no waiting for waiter to take order)
4. **Digital upsell**: Photos, combo suggestions, "frequently bought together" prompts
5. **Data capture**: Phone numbers collected for loyalty program (already exists)
6. **Menu flexibility**: Real-time menu updates (no reprinting paper menus)
7. **Contactless**: Post-pandemic preference, hygienic
8. **Reduced errors**: Orders go directly to KDS in text — no miscommunication

### ROI Estimates (Initial)
- QR sticker printing: ~50,000 VND (100 stickers)
- Development time: 2-3 days (mostly frontend + minor backend changes)
- Deployment: zero additional infrastructure (runs on existing Cloudflare stack)
- vs. Hiring 1 additional waiter: ~5,000,000 VND/month

---

## 7. Effort Estimate

### Implementation Phases

| Phase | Scope | Effort (days) | Dependencies |
|-------|-------|---------------|--------------|
| **Phase 1: Core Flow** | menu.html table param + checkout passes table_id + orders-hono.ts accepts table_id + table auto-occupy | 1 day | None |
| **Phase 2: QR Generation** | generate-qr.html admin page + qrcodejs integration + print layout | 0.5 day | Phase 1 |
| **Phase 3: Table Auto-Release** | Payment-confirmed + order-served triggers table status = Available | 0.5 day | Phase 1 + existing webhooks |
| **Phase 4: Admin Controls** | table status override in admin, QR re-generation, usage analytics | 0.5 day | Phase 2 |
| **Phase 5: Polish** | Table-specific promotions, session timeout, error handling, bilingual labels | 1 day | Phase 1-4 |
| **Testing** | E2E flow: scan -> order -> pay -> KDS -> serve -> release | 0.5 day | All phases |

**Total:** 3-4 days for a single developer familiar with the codebase.

### By Complexity
- **Simplest path (YAGNI/KISS):** Convention-based QR URLs, minimal backend changes, reuse existing menu.html with table param detection. ~1.5 days.
- **Full-featured:** Session key security, auto-release pipeline, admin QR management, table analytics. ~4 days.

---

## 8. Key Considerations & Risks

### 8.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Table param spoofing | Low | Low | Orders are tied to phone/name, not just table. Staff verifies table at service. |
| QR sticker damage | Medium | Low | Admin page can regenerate QR for any table; reprint anytime. |
| Network issues (cafe WiFi) | Medium | Medium | Menu page can cache in localStorage; order submission requires network. Provide fallback: waiter takes order verbally. |
| Split bill at same table | Low | Medium | Each person scans same QR -> orders are separate. PayOS per order. Staff can combine at POS if needed. |
| Customer abandons order | Medium | Low | Table stays "Occupied". Add 15-min timeout: if no payment within 15min, auto-release table (staff override). |

### 8.2 Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Staff resistance to change | Medium | Phase in gradually — keep verbal ordering as fallback. Show KPI improvements. |
| Elderly customers cannot use QR | Medium | Maintain paper menus + verbal ordering. QR is an option, not a requirement. |
| Phone battery / QR scan issues | Low | Table number also printed on sticker as text; customer can type `/menu?table=B01` |

### 8.3 Alignments & Non-Alignments

**Aligned with existing architecture:**
- Cloudflare Workers + D1 — no new infrastructure
- KDS already exists — QR orders feed into same pipeline
- PayOS payment flow unchanged — works per-order, not per-table
- Hono router conventions — new routes follow existing patterns
- Zod validation — new schemas follow existing validator patterns

**Not aligned (intentional deviation from alternative approaches):**
- **NOT** building a full PWA/React SPA — the existing `menu.html` + vanilla JS pattern works and avoids a rewrite
- **NOT** integrating with TastyIgniter — QR is dine-in only; TastyIgniter handles delivery
- **NOT** adding WebSocket — 3s polling is sufficient for cafe traffic and simpler to deploy on Cloudflare
- **NOT** requiring customer account/login — anonymous ordering with phone optional, lowering friction

### 8.4 Unresolved Questions for Decision

1. **Session key vs convention**: Should QR URLs include a random session token (`/menu?s=abc123`) or just the table number (`/menu?table=B01`)? Convention is simpler; session token adds security but requires DB storage.

2. **Payment-at-counter vs PayOS-only**: Should table ordering support both COD and PayOS, or force online payment to streamline operations? The existing system supports both.

3. **Self-release timeout**: What timeout for auto-releasing an "Occupied" table when no order is placed? 15 min? 30 min?

4. **Table grouping for large parties**: Multiple adjacent tables pushed together need a "merge" feature — or keep it simple with multiple QR scans to the same table group?

5. **Language**: Existing pages are bilingual (Vietnamese + English). Keep this pattern for QR menu?

6. **QR design**: Sticker placement (center of table vs edge), size, material (waterproof laminate?), with or without table number text alongside QR code?

---

## 9. Recommended Approach (YAGNI/KISS)

### Immediate (1.5 days)
1. Add `?table=` parameter detection to `menu.html` (frontend only change)
2. Pass `table_id` through cart -> checkout -> `POST /api/orders/checkout`
3. Modify `orders-hono.ts` to auto-set table status to `Occupied` on order creation
4. Generate QR codes via free online tool (no admin page needed yet)
5. Print + laminate QR stickers, affix to tables

### Next (1-2 days)
6. Build `generate-qr.html` admin page for self-service QR generation
7. Add table release on payment confirmation (webhook trigger)
8. Add 15-min abandonment timeout via existing cron system
9. Admin dashboard with table occupancy metrics

### Future (nice-to-have)
10. Table-specific promotions ("Buy 1 get 1 at Table 5")
11. Re-order from same table (previous order history)
12. Split bill functionality
13. Staff handheld POS integration
