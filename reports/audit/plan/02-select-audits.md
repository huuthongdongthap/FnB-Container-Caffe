# Audit Stage 2: Select Audits (Select-Audits) — AURA CAFE Post-Rearchitecture

**Pipeline Stage:** Stage 2 / Select Audits (`--budget-constrained`)
**Date:** 2026-09-28
**Source Ranking:** `reports/audit/plan/01-risk-rank.md`
**Output Directory:** `reports/audit/plan/`

---

## 1. Audit Selection Criteria

Under the resource and capacity constraints of the pre-deployment phase, candidate audits are filtered using 4 criteria:
1. **Direct Impact on Real-Money Dining**: Must protect revenue, prevent price tampering, or prevent transaction loss.
2. **PII & Data Protection**: Must prevent customer identity leakage, order snooping (IDOR), and unauthorized admin mutations.
3. **Staff Shift Operational Continuity**: Must ensure kitchen tickets, table turns, and payment link receipts never drop during peak rushes.
4. **Mobile Ergonomics for Sa Đéc Diners**: Must guarantee seamless QR scanning, ordering, and payment on real mobile devices (iOS Safari & Android Chrome).

---

## 2. Selected Audits (Approved for Execution)

### Audit A1: Security, IDOR Boundary & Webhook Cryptography
- **Risk Addressed:** **R1** (Rank 1, Score 7.22)
- **Target Files / Boundaries:**
  - `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts`
  - `worker/src/routes/openapi-orders-handlers/order-mutation-handlers.ts`
  - `worker/src/middleware/cors.ts`
  - `packages/domain/payment/commands/payos-create-link.ts`
  - `packages/domain/payment/commands/process-web-payment.ts`
  - `packages/domain/reservation/src/routes/reservations.ts`
- **Audit Objectives:**
  - Verify that `resolveCustomerScope()` fails closed (`AND 1=0`) for unauthorized actors on all read endpoints.
  - Prove that order mutation handlers (`PATCH /orders/:id`, `POST /orders/:id/cancel`) prevent cross-customer and cross-table unauthorized modification.
  - Verify that CORS origin matching uses strict host matching, preventing regex subdomain spoofing.
  - Audit webhook verification handlers for timing-safe signature comparison (`crypto.subtle.timingSafeEqual`).
- **Success Criteria:** 0 IDOR vulnerabilities, 0 unauthenticated admin routes, 100% timing-safe webhook verifications.

---

### Audit A2: Server-Authoritative Pricing & Checkout Idempotency
- **Risk Addressed:** **R2** (Rank 2, Score 5.67)
- **Target Files / Boundaries:**
  - `packages/domain/order/commands/create-order.ts`
  - `packages/domain/order/services/order-price-calculator.ts`
  - `packages/domain/payment/schemas/payos.ts`
  - `src/stores/cart-store.ts` & `src/stores/payment-store.ts`
- **Audit Objectives:**
  - Adversarially verify that malicious request payloads with manipulated `price`, `subtotal`, or `discountAmount` are stripped by `OrderCreateSchema` and re-evaluated by `calculateOrderSnapshot()`.
  - Validate voucher and discount redemption rules (usage caps, minimum order value, validity windows).
  - Verify that double-submitting a checkout request with identical `Idempotency-Key` returns cached HTTP 200 with `X-Cache: HIT` within the 120s TTL window.
- **Success Criteria:** 0 price tampering exploits possible, 100% idempotency replay accuracy.

---

### Audit A3: Real-Time KDS Stream, Event Replay & D1 Concurrency
- **Risk Addressed:** **R3** (Rank 3, Score 4.34) & **R5** (Rank 5, Score 2.25)
- **Target Files / Boundaries:**
  - `worker/src/routes/order-stream.ts`
  - `worker/src/routes/orders-hono-handlers/query-handlers.ts`
  - `src/pages/KDS.tsx` & `src/hooks/use-kds.ts`
  - `src/pages/TableOrder.tsx` & `src/pages/TVMenu.tsx`
- **Audit Objectives:**
  - Simulate network drops on kitchen display tablets and verify that reconnecting with `Last-Event-ID` replays all missed order lifecycle events.
  - Verify SQLite D1 batch statement atomicity during concurrent table checkout operations.
  - Audit audio alert handling on Safari/iOS KDS tablets (ensuring audio context resume on user gesture).
- **Success Criteria:** 0 dropped tickets on reconnect, zero SQLite primary key / order number collision under concurrent simulated load.

---

### Audit A4: Mobile PWA Ergonomics, Accessibility (WCAG 2.1 AA) & Shell Isolation
- **Risk Addressed:** **R4** (Rank 4, Score 2.94) & **R6** (Rank 6, Score 1.00)
- **Target Files / Boundaries:**
  - `src/components/md3/md3-app-shell.tsx` (`CustomerShell`, `OpsShell`, `AdminShell`)
  - `src/components/cart/cart-bottom-bar.tsx`
  - `src/components/md3/md3-navigation-bar.tsx`
  - `src/styles/aura-tokens.css`
  - `src/locales/vi.json`
- **Audit Objectives:**
  - Verify that `CartBottomBar` renders exclusively on `CustomerShell` and is 100% absent on `OpsShell` (KDS/TV/POS) and `AdminShell`.
  - Audit all interactive buttons and modifier selection chips for compliance with the 44×44px Apple HIG / MD3 touch-target standard.
  - Measure color contrast ratio across dark mode surfaces (ensuring ≥ 4.5:1 for normal text and ≥ 3:1 for large text / icons).
  - Verify natural Vietnamese translations and Master Logo asset rendering across all viewport breakpoints.
- **Success Criteria:** 0 shell boundary leaks, 0 touch targets < 44px on mobile paths, 100% WCAG 2.1 AA contrast compliance.

---

## 3. Deselected Audits (Deferred)

| Audit Topic | Justification for Deferral |
|---|---|
| **D1 Cold Start Latency Micro-benchmarking** | Cloudflare Workers edge cold starts are already sub-10ms; load testing deferred to Phase 2 scale-out. |
| **Legacy Python Script Static Analysis** | All Python legacy migration scripts in `src/components/stitch/` were already purged in Phase 1 cleanup. |
| **Multi-Language Deep Localization (FR/JA/KO)** | AURA CAFE Sa Đéc initial go-live prioritizes Vietnamese (`vi-VN`) and English (`en-US`). |

---

## 4. Execution Selection Summary

```
Selected Audits:
├── A1: Security & IDOR Cryptography Audit (Critical P0)
├── A2: Server-Authoritative Pricing & Idempotency Audit (Critical P0)
├── A3: Real-Time KDS SSE & D1 Resilience Audit (High P1)
└── A4: Mobile PWA Ergonomics, WCAG & Shell Governance Audit (High P1)
```
