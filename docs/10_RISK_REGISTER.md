---
date: 2025-06-19
version: 1.0
status: stable
---

# RISK REGISTER — AURA CAFE CONTAINER

## Overview

This register tracks identified risks across technical, business, operational, compliance, and security domains. Each risk includes likelihood, impact, mitigation plan, and status.

## Risk Matrix

| ID | Risk Category | Description | Likelihood | Impact | Risk Score | Status |
|-----|---------------|-------------|------------|--------|------------|--------|
| **TECH-01** | Technical | D1 database connection limit exceeded (concurrent writes) | Medium | High | 8 | 🟡 Monitoring |
| **TECH-02** | Technical | Cloudflare Workers CPU time limit exceeded | Low | High | 4 | ✅ Mitigated |
| **TECH-03** | Technical | KV storage quota exceeded (rate limiting) | Medium | Medium | 6 | 🟡 Monitoring |
| **TECH-04** | Technical | PayOS webhook failures → missed payments | Low | High | 4 | ✅ Mitigated |
| **TECH-05** | Technical | Third-party API downtime (PayOS, SMTP) | Medium | Medium | 6 | 🟡 Mitigated |
| **BIZ-01** | Business | Payment gateway fee increases (>3%) | Medium | Medium | 6 | ⚠️ Watch |
| **BIZ-02** | Business | Customer acquisition cost > LTV | Medium | High | 8 | 🟡 Mitigated |
| **BIZ-03** | Business | Loyalty program abuse (cashback farming) | Low | Medium | 3 | ✅ Mitigated |
| **OPS-01** | Operational | Staff data tampering (order cancellation) | Low | Medium | 3 | ✅ Mitigated |
| **OPS-02** | Operational | Admin credentials compromised | Medium | High | 8 | 🟡 Mitigated |
| **OPS-03** | Operational | Backup failure / data loss | Low | Critical | 5 | ✅ Mitigated |
| **COMP-01** | Compliance | E-invoicing not implemented by deadline | Low | High | 4 | 🟡 In Progress |
| **COMP-02** | Compliance | Customer data retention violation (GDPR-ish) | Low | Medium | 3 | ✅ Mitigated |
| **SEC-01** | Security | JWT secret leakage | Low | Critical | 5 | ✅ Mitigated |
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

*Last updated: 2025-06-19 — Initial risk register*
