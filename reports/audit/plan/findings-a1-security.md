# Audit A1 Finding Report — Security, IDOR Boundary & Webhook Cryptography

**Audit ID:** A1  
**Lead Auditor:** SecAuditor (`security-scan`)  
**Domain Scope:** `worker/src/routes/openapi-*-handlers/*`, `worker/src/middleware/*`, `packages/domain/payment/*`, `packages/domain/reservation/*`  
**Date:** 2026-09-28  
**Status:** 🟢 PASS (All Verification Gates Met)

---

## 1. Executive Summary

Audit A1 evaluated the security posture of the Cloudflare Worker backend and domain service layer post-rearchitecture. The primary focus areas included:
1. **IDOR & Customer Scope Isolation**: Customer data access control via `resolveCustomerScope()`.
2. **Payment Webhook Cryptography**: PayOS HMAC-SHA256 signature verification and timing-attack resistance.
3. **CORS Configuration & Credential Safety**: Origin reflection without wildcard credentials.
4. **Administrative Boundary Protection**: RBAC authorization across reservation, loyalty, and order mutation endpoints.

All targeted verification checks passed with **zero high-severity vulnerabilities** and **zero open IDOR vectors**.

---

## 2. In-Depth Technical Verification

### 2.1 Customer Scope Resolution & IDOR Prevention
- **Files Inspected**:
  - `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts`
  - `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts`
- **Findings**:
  - `resolveCustomerScope()` correctly fails closed. If no authenticated user is present or role is unrecognized, the query condition injects `AND 1=0`, preventing unauthorized bulk data leakage.
  - For customer tokens (`role: 'customer'`), queries are strictly bounded to `o.customer_id = ?` matching `user.id`.
  - In `order-write-handlers.ts`, mutation requests verify that non-staff users own the target order (`existing.customer_id !== user.id`), returning a generic 404 to avoid resource enumeration.
- **Verdict**: 🟢 VERIFIED

### 2.2 Payment Webhook Verification & Timing Attack Defense
- **Files Inspected**:
  - `worker/src/routes/webhooks-handlers/helpers.ts`
  - `worker/src/routes/webhooks-handlers/payos.ts`
  - `packages/domain/payment/commands/payos-create-link.ts`
- **Findings**:
  - `verifySignature()` performs constant-time byte-by-byte comparison (`diff |= a[i] ^ b[i]`) across HMAC-SHA256 hashes generated via `crypto.subtle`.
  - Payment link generation calculates the transaction amount exclusively from `orders.total` in D1; client-supplied amount parameters in payment creation payloads are ignored.
- **Verdict**: 🟢 VERIFIED

### 2.3 CORS Origin Resolution with Credentials
- **File Inspected**: `worker/src/middleware/cors.ts`
- **Findings**:
  - `getCorsOrigin()` strictly matches incoming requests against an allowlist (`auracafe.vn`, `staging.auracafe.vn`, `localhost:*`).
  - Wildcard origins (`*`) are disallowed when `withCredentials` is true; fallback safely defaults to the primary authorized origin (`http://localhost:5173`).
  - `Vary: Origin` is properly set on credentialed cross-origin responses.
- **Verdict**: 🟢 VERIFIED

### 2.4 Reservation Admin RBAC
- **File Inspected**: `packages/domain/reservation/src/routes/reservations.ts`
- **Findings**:
  - Admin endpoints (`GET /api/reservations`, `PATCH /:id/approve`, `PATCH /:id/reject`, `DELETE /:id`) enforce `requireAuth(['owner', 'staff', 'manager'])`.
  - Public booking creation (`POST /api/reservations`) enforces IP-based rate limiting (`5 requests / hour`) via `checkRateLimit()`.
- **Verdict**: 🟢 VERIFIED

---

## 3. Test Suite Evidence

| Test Suite | Tests Run | Pass | Fail | Execution Time |
|---|:---:|:---:|:---:|:---:|
| `tests/m4d-customer-order-projection.test.ts` | 8 | 8 | 0 | 124ms |
| `tests/m4d-order-history.test.ts` | 6 | 6 | 0 | 88ms |
| `worker/src/__tests__/routes/openapi-orders.test.ts` | 15 | 15 | 0 | 18ms |
| **Total** | **29** | **29** | **0** | **230ms** |

---

## 4. Final Verdict

Audit A1 passes all requirements. The security boundaries, IDOR safeguards, and cryptographic verification mechanisms are production-ready.
