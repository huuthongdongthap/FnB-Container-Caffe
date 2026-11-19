---
date: 2026-11-18
version: 2.5
status: active
---

# RISK REGISTER — AURA CAFE CONTAINER

## Overview

This register tracks identified risks across technical, business, operational, compliance, and security domains. Each risk includes likelihood, impact, mitigation plan, and status.

## Risk Matrix

| ID | Risk Category | Description | Likelihood | Impact | Risk Score | Status |
|-----|---------------|-------------|------------|--------|------------|--------|
| **TECH-01** | Technical | D1 SQLite single-writer contention & replica read-after-write lag (`withPrimarySession('first-primary')` wired in `getDatabase()` and scheduled cron `handleScheduled`) | Low | High | 4 | ✅ Mitigated |
| **TECH-02** | Technical | Cloudflare Workers CPU time limit exceeded | Low | High | 4 | ✅ Mitigated |
| **TECH-03** | Technical | Workers KV ~60s eventual consistency on auth/OTP/idempotency (moved authority to D1 CAS) | Medium | High | 8 | ✅ Mitigated |
| **TECH-04** | Technical | PayOS webhook replay / amount mismatch / paid-vs-cancel race / reconciliation realtime fanout | Low | Critical | 5 | ✅ Mitigated |
| **TECH-05** | Technical | Third-party API downtime (PayOS, ERPNext, ZNS/SMTP) | Medium | Medium | 6 | 🟡 Mitigated |
| **TECH-06** | Technical | Split-bill concurrent parent double-cancellation / 2× BOM deduction, manual refund realtime drift, shift sale replay, or QR placeholder analytics skew (atomic parent CAS + BOM restore + voucher `user_rewards` clawback + `(shiftId, orderId)` dedup + placeholder exclusion enforced) | Low | High | 4 | ✅ Mitigated |
| **TECH-07** | Technical | PayOS `'completed'` orders blocking table session close / mobile table release, `table_sessions` ledger drift on order cancel/split, or QR placeholder + single-L `'canceled'` skew in secondary analytics (peak hours, zones, top products, customer metrics, CSV export) | Low | Medium | 3 | ✅ Mitigated |
| **BIZ-01** | Business | Payment gateway fee increases (>3%) | Medium | Medium | 6 | ⚠️ Watch |
| **BIZ-02** | Business | Customer acquisition cost > LTV | Medium | High | 8 | 🟡 Mitigated |
| **BIZ-03** | Business | Loyalty / promo abuse (concurrent promo limit, public draft promo filtering & Earn->Redeem->Refund voucher clawback) | Low | High | 4 | ✅ Mitigated |
| **OPS-01** | Operational | Unpaid online-prepaid KDS hold, paid-order cancellation, table occupancy release, BOM unit mismatch (`g`/`kg`), or restocking brewed waste | Low | High | 4 | ✅ Mitigated |
| **OPS-02** | Operational | Staff device/session compromise, cross-store POS offline queue bleed, or duplicate `table_sessions` order attach (CAS guarded) | Low | High | 4 | ✅ Mitigated |
| **OPS-03** | Operational | D1 migration drift (`worker/schema.sql` vs `db/schema.sql` 160+ index parity enforced in CI) | Low | Critical | 5 | ✅ Mitigated |
| **COMP-01** | Compliance | E-invoice immutability after ERPNext issuance (Nghị định 70/2025/NĐ-CP credit-note lock) | Low | High | 4 | ✅ Mitigated |
| **COMP-02** | Compliance | Personal Data Protection lifecycle, per-channel consent & ledger-safe erasure (Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP) | Low | High | 4 | ✅ Mitigated |
| **SEC-01** | Security | JWT secret leakage & phone-less QR guest review `X-Order-Token` ownership verification | Low | Critical | 5 | ✅ Mitigated |
| **SEC-02** | Security | XSS attack via customer input | Medium | High | 8 | ✅ Mitigated |
| **SEC-03** | Security | SQL injection via API | Low | High | 4 | ✅ Mitigated |
| **SEC-04** | Security | Rate limit bypass (IP spoofing) | Low | Medium | 3 | ✅ Mitigated |

**Risk Score = Likelihood (1-5) × Impact (1-5)**

---

## Detailed Risk Entries

### TECH-01: D1 Database Connection Limit Exceeded

**Description:** Concurrent write operations could exceed D1 connection pool limits, causing timeouts.

**Likelihood:** Medium (grows with traffic)  
**Impact:** High (orders fail, data inconsistency)

**Mitigation:**
- Use transactions for all multi-statement operations
- Keep transactions short (<100ms)
- Implement retry with exponential backoff
- Monitor D1 query duration in Cloudflare dashboard

**Owner:** Backend Developer  
**Status:** 🟡 Monitoring (no incidents yet)

---

### TECH-02: Workers CPU Time Limit

**Description:** Cloudflare Workers have 10ms CPU time per request; complex operations could exceed.

**Likelihood:** Low (current operations <5ms)  
**Impact:** High (request terminated, 500 error)

**Mitigation:**
- Profile CPU-heavy operations (JWT verification, crypto)
- Offload to D1 computed columns or KV where possible
- Implement request timeouts (abort after 8ms)

**Owner:** Backend Developer  
**Status:** ✅ Mitigated (current avg 3ms CPU)

---

### TECH-03: KV Storage Quota Exceeded (Rate Limiting)

**Description:** KV free tier is 1,000 reads/day. Rate limiting uses KV on every auth/order request.

**Likelihood:** Medium (>500 orders/day approaches limit)  
**Impact:** Medium (rate limiting fails, either blocks all or allows all)

**Mitigation:**
- Monitor KV ops daily via Cloudflare dashboard
- Upgrade to KV Paid Plan ($5 for 10M ops/month) if >80% used
- Optimize: use short TTL keys that auto-expire

**Owner:** Infrastructure Engineer  
**Status:** 🟡 Monitoring (current ~50/day usage)

---

### TECH-04: PayOS Webhook Failures

**Description:** If PayOS cannot reach our webhook, payment success not recorded.

**Likelihood:** Low (PayOS retries with backoff)  
**Impact:** High (order stuck in pending, customer frustrated)

**Mitigation:**
- Webhook verifies signature, returns 200 quickly
- Implement fallback cron job every 5min to reconcile pending payments
- Alert on webhook failures > 5% rate

**Owner:** Backend Developer  
**Status:** ✅ Mitigated (cron in place, no incidents)

---

### BIZ-01: Payment Gateway Fee Increases

**Description:** PayOS raises fees from 2.5% to higher rate, reducing margins.

**Likelihood:** Medium (market competition)  
**Impact:** Medium (~1% margin reduction per 0.5% fee increase)

**Mitigation:**
- Negotiate volume discounts at >10K transactions/month
- Add alternative gateway (MoMo) to create competition
- Pass fee to customers (add 1% surcharge option)

**Owner:** Founder / Finance  
**Status:** ⚠️ Watch (contract renegotiation in 12 months)

---

### BIZ-02: CAC > LTV

**Description:** Customer acquisition cost exceeds lifetime value, unsustainable growth.

**Likelihood:** Medium (if marketing spend uncontrolled)  
**Impact:** High (losing money per customer)

**Mitigation:**
- Track CAC and LTV monthly in admin dashboard
- Target LTV:CAC ratio > 3:1
- Focus on organic growth (referrals, word-of-mouth)
- Loyalty program increases LTV by 30-50%

**Owner:** Founder / Marketing  
**Status:** 🟡 Mitigated (current LTV ~500K, CAC ~100K)

---

### SEC-01: JWT Secret Leakage

**Description:** If `JWT_SECRET` is committed or exposed, attackers can forge tokens.

**Likelihood:** Low (secret stored in Cloudflare)  
**Impact:** Critical (full system compromise)

**Mitigation:**
- Never commit `.env` files
- Use Cloudflare secrets exclusively
- Rotate JWT_SECRET every 6 months
- Short token expiry (7 days)

**Owner:** Security Engineer  
**Status:** ✅ Mitigated (secret management in place)

---

### SEC-02: Anonymous Guest Order BOLA / Capability Token Leakage

**Description:** Sequential or shareable order IDs could expose customer PII or allow unauthorized promotion redemption, post-login order claiming, or cross-customer tracking enumeration on unclaimed guest orders.

**Likelihood:** Low (cryptographic capability tokens enforced)  
**Impact:** High (unauthorized PII disclosure or fraudulent order claiming)

**Mitigation:**
- Mint 192-bit random `order_token` values on guest order creation, offline sync, guest check-in, and split-bill creation; store only SHA-256 `guest_token_hash` in D1
- Require verified `X-Order-Token` (or `?order_token=`) for guest order detail, SSE events, promotion redemption, and post-login order claiming; block forged tokens and signed-in foreign customer enumeration on `/track` while keeping anonymous shareable `/track` responses zero-PII
- Bound client token storage to 32 entries with 24-hour TTL scoped by session/tenant, and purge `memory` + `sessionStorage` + `localStorage` on logout or tenant switch

**Owner:** Security Engineer / Backend Lead  
**Status:** ✅ Mitigated (enforced across REST, OpenAPI, split-bill, and SSE surfaces)

---

### TECH-05: Offline Queue Replay Duplication & Replica Lag on Order/Payment Reads

**Description:** Concurrent reconnect handlers or page reloads while offline could either replay queued IndexedDB orders twice or strand unsynced customer orders, and D1 read-replica lag could serve stale payment/order state right after PayOS webhook or COD settlement.

**Likelihood:** Low (shared mutex + primary session pinning active)  
**Impact:** Medium (duplicate kitchen tickets or delayed payment confirmation UI)

**Mitigation:**
- Enforce shared module-level offline sync mutex across store and POS sync hooks, plus server-side `localId` / `Idempotency-Key` deduplication
- Hydrate pending IndexedDB state on mount and session transitions so offline customer orders survive page reloads and auto-flush on reconnect
- Pin order, KDS, and PayOS webhook handlers to primary D1 session (`withPrimarySession('first-primary')`) and broadcast both PayOS and cashier COD settlements to `ORDER_BROADCASTER` + tenant-scoped KV events

**Owner:** Backend / Frontend Lead  
**Status:** ✅ Mitigated (verified in automated test suite and local cutover harness)

---

### TECH-07: Table Session Settlement Parity, Session Ledger Drift & Secondary Analytics Skew

**Description:** PayOS settlement writes `payment_status = 'completed'` while cash/COD writes `'paid'`; guards that only accepted `'paid'` blocked session close and mobile table release for PayOS-settled tables, and closed sessions left stale `current_order_id` / `current_session_id` on `cafe_tables`. Cancelled or split orders did not update `table_sessions.order_count` / `total_amount`, and split children lost `session_id`. Secondary analytics counted empty QR check-in placeholders and single-L `'canceled'` orders.

**Likelihood:** Low (guards aligned and regression-tested)  
**Impact:** Medium (tables stuck Occupied, wrong session totals at checkout, inflated reports)

**Mitigation:**
- Accept `'paid'`, `'completed'`, and `'refunded'` as settled across session close, session status PATCH, mobile table release, floor plan, domain table status, payment reconciliation, PayOS webhook settlement, and spend cashback; terminal session transitions clear `cafe_tables.current_order_id` and `current_session_id`
- Order cancel decrements session `order_count` / `total_amount` and unlinks `current_order_id`; split inherits parent `session_id`, replaces parent totals with children totals, and repoints `current_order_id` to the first child
- Customer metrics, peak hours, top products, zone stats, and CSV export exclude QR placeholders (`Khách QR - cho don mon` with empty items), `'canceled'`/`'cancelled'` statuses, and failed/refunded payment status, with schema-tolerant fallbacks
- Locked by `table-session-split-cancel-analytics-integrity.test.ts` (real SQLite) and live `workerd` loopback checks in `local-flow-table-sessions-analytics-subroutes.mjs`

**Owner:** Backend Lead  
**Status:** ✅ Mitigated (verified in automated test suite and local loopback harness)

---

### COMP-01: E-invoicing Compliance

**Description:** Vietnamese law requires e-invoicing from June 2025. Failure = fines.

**Likelihood:** Low (aware and planning)  
**Impact:** High (regulatory fines, shutdown risk)

**Mitigation:**
- Integrate Odoo Accounting module (Q3 2026)
- Generate e-invoices automatically per order
- Store invoices in D1 + backup to R2
- Engage accounting firm for validation

**Owner:** Founder / Backend Lead  
**Status:** 🟡 In Progress (Odoo integration planned)

---

## Risk Response Strategies

| Strategy | Definition | Application |
|----------|------------|-------------|
| **Mitigate** | Reduce likelihood or impact | All high/medium risks have mitigation |
| **Transfer** | Shift to third party (insurance) | Not applicable (self-insure) |
| **Accept** | Live with risk (low impact) | Low-score risks (1-2) |
| **Avoid** | Stop activity causing risk | N/A (core business needed) |

---

## Risk Review Cadence

- **Monthly:** Review high risks (score ≥8) and status updates
- **Quarterly:** Full risk register audit, add new risks
- **Incident-driven:** After any outage, create new risk entry if systemic

---

## Risk Sources

- `docs/api-audit.md` — API security review
- `docs/backend-proposals.md` — Architecture alternatives considered
- `docs/cart-checkout-audit.md` — Payment flow audit
- `docs/deployment.md` — Deployment risks
- `DEPLOY_AUDIT_20260605.md` — Pre-launch audit
- `SECURITY.md` — Security considerations

---

*Last updated: 2026-11-18 — Added PayOS `'completed'` table session release parity, split/cancel session ledger synchronization, and secondary analytics QR placeholder exclusion mitigations*
