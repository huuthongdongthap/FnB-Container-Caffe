# Audit Stage 1: Risk Ranking (Risk-Rank) — AURA CAFE Post-Rearchitecture & Go-Live

**Target System:** AURA OS (Cloudflare Workers + D1 + KV + React 19 PWA)
**Date:** 2026-09-28
**Scope:** Post-Merge Audit Planning across Security, Data Integrity, Operations, UI/UX, and Performance.
**Baseline:** 382 test files / 3,519 tests PASS | TypeScript: 0 errors | Build: OK

---

## 1. Risk Evaluation Methodology

Each risk dimension is scored using the standardized Formula:
$$\text{Risk Score} = \text{Severity} (1\text{–}10) \times \text{Likelihood} (0.1\text{–}1.0) \times \text{Business Impact} (1\text{–}10) \div 10$$

Severity Categories:
- **Critical (Score ≥ 7.0)**: P0 blocker to real-money dining and live staff operations.
- **High (Score 5.0 – 6.9)**: P1 issue impacting user experience, data latency, or operational stability.
- **Medium (Score 3.0 – 4.9)**: P2 compliance, aesthetic, or edge-case UX defect.
- **Low (Score < 3.0)**: P3 cosmetic or minor documentation drift.

---

## 2. Risk Registry & Ranking

| ID | Domain | Risk Description | Severity | Likelihood | Impact | Score | Rank |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| **R1** | Security & Auth | **IDOR & Webhook Spoofing**: Incomplete actor scoping on order mutations, unverified webhook signatures, or CORS credential leak under multi-tenant edge. | 9.5 | 0.8 | 9.5 | **7.22** | **1** |
| **R2** | Financial Integrity | **Cart & Pricing Tampering**: Client-side total overrides, rounding discrepancies in VAT/service fees, or race conditions during PayOS / QR checkout link creation. | 9.0 | 0.7 | 9.0 | **5.67** | **2** |
| **R3** | Operations & KDS | **Real-Time Ticket Loss & SSE Stalling**: Dropped SSE connections on station tablets during peak rush hours, lost `Last-Event-ID` buffers, or KDS ticket state desync. | 8.5 | 0.6 | 8.5 | **4.34** | **3** |
| **R4** | UI/UX & Touch | **Mobile Touch Targets & Viewport Bleed**: Non-standard touch targets (<44px), virtual keyboard layout shifting on iOS Safari, or bottom navigation overlaying action buttons. | 7.0 | 0.6 | 7.0 | **2.94** | **4** |
| **R5** | Data Consistency | **D1 SQLite Concurrency & Migrations**: Unindexed queries in order history, lock contention during simultaneous table orders, or unmigrated schema drift. | 7.5 | 0.4 | 7.5 | **2.25** | **5** |
| **R6** | Localization & Copy | **Brand Drift & Translation Artifacts**: Stale machine-translation strings in toasts/modals, broken asset links on CDN, or missing Sa Đéc regional copy. | 5.0 | 0.4 | 5.0 | **1.00** | **6** |

---

## 3. Deep Analysis of Critical Risks

### R1: Security, IDOR & Webhook Tampering (Rank 1 — Score 7.22)
- **Vulnerability Surface:**
  - `worker/src/routes/openapi-orders-handlers/` — While `resolveCustomerScope()` was wired for order reads, all mutation handlers (`PATCH /orders/:id`, `POST /orders/:id/cancel`) must be verified to ensure customer tokens cannot mutate orders owned by other diners or tables.
  - `packages/domain/payment/commands/payos-create-link.ts` & webhook endpoints — PayOS webhook signature verification (`verifyPaymentWebhookData`) must fail closed on invalid checksums, and replay attacks must be blocked via KV idempotency keys.
  - CORS with credentials: Dynamic origin check in `getCorsOrigin()` must prevent arbitrary origins from masquerading as trusted subdomains (e.g. `malicious-auracafe.vn`).

### R2: Financial Integrity & Server-Authoritative Pricing (Rank 2 — Score 5.67)
- **Vulnerability Surface:**
  - `calculateOrderSnapshot()` in `@aura/domain-order` — Must guarantee that all discount codes, promotional tier deductions, vat amounts (8% vs 10%), and 5% service fees are strictly computed on Cloudflare Workers.
  - PayOS payment amount validation: Ensure the generated PayOS payment link amount matches `snapshot.total_amount` down to the exact integer VND cent without truncation or floating point rounding error.

### R3: Operational Reliability & Kitchen Display Real-Time Stream (Rank 3 — Score 4.34)
- **Vulnerability Surface:**
  - `worker/src/routes/order-stream.ts` & `query-handlers.ts` — When baristas or kitchen staff lose WiFi connectivity on their tablets, the reconnect handshake with `Last-Event-ID` must replay all missed transitions (e.g., `preparing` → `ready` → `served`).
  - Audio notification trigger: Web Audio API context unlock on iOS/Android tablets when a new dine-in or takeaway order arrives.

### R4: Mobile PWA Touch, Ergonomics & Accessibility (Rank 4 — Score 2.94)
- **Vulnerability Surface:**
  - Mobile bottom navigation bar (`MD3NavigationBar`) and `CartBottomBar` z-index layering on iPhone Dynamic Island and Android navigation bars (`env(safe-area-inset-bottom)`).
  - Tap target size: Ensure all modifier checkboxes, quantity increment buttons, and table selectors meet the Apple HIG / MD3 44×44px minimum touch target threshold.

---

## 4. Conclusion & Stage Hand-off
Risks **R1**, **R2**, and **R3** form the critical security and operational core that must be rigorously audited before public launch. Risks **R4** and **R5** will be addressed in the ergonomics and performance audit wave.
