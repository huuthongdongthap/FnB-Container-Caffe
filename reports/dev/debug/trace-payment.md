---
agent: payment-trace
scope: js/config.js, js/checkout.js, js/checkout/payment.js, js/checkout/qr-code.js, worker/src/routes/payment.js, worker/src/routes/webhooks.js, worker/wrangler.toml, .env, worker/.dev.vars
issues_found: 14
critical: 5
---

# Payment Trace Report

**Date:** 2026-05-31
**Agent:** payment-trace (Go LIVE readiness)
**Verdict:** NOT READY — 5 CRITICAL, 4 HIGH, 5 MEDIUM issues

---

## CRITICAL Issues

### CRIT-01: MoMo endpoint points to TEST sandbox

- **File:** `js/config.js` line 27
- **Current:** `https://test-payment.momo.vn/v2/gateway/api/create`
- **Expected:** `https://payment.momo.vn/v2/gateway/api/create`
- **Severity:** CRITICAL
- **Impact:** All MoMo payments route to sandbox gateway. Real money transactions will fail silently or be rejected.
- **Fix:** Replace `test-payment.momo.vn` with `payment.momo.vn`. However, note that MoMo is only used client-side as a fallback (no backend route exists) — see HIGH-01.

### CRIT-02: VNPay endpoint points to SANDBOX

- **File:** `js/config.js` line 36
- **Current:** `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`
- **Expected:** `https://pay.vnpay.vn/vpcpay.html`
- **Severity:** CRITICAL
- **Impact:** VNPay payments route to sandbox. Same as MoMo — client-side config only, no backend route exists.
- **Fix:** Replace `sandbox.vnpayment.vn` with `pay.vnpay.vn`.

### CRIT-03: VNPay TMN code is TEST placeholder

- **File:** `js/config.js` line 35
- **Current:** `tmnCode: 'AURASPACE'`
- **File:** `.env` line 5
- **Current:** `VNPAY_TMN_CODE=TEST`
- **Expected:** Registered production TMN code from VNPay merchant dashboard
- **Severity:** CRITICAL
- **Impact:** VNPay will reject all payment requests with invalid merchant code.
- **Fix:** Register production merchant account with VNPay and update TMN code.

### CRIT-04: PayOS client ID is placeholder in frontend config

- **File:** `js/config.js` line 31
- **Current:** `'YOUR_PAYOS_CLIENT_ID'` (fallback when process.env unavailable — which is ALWAYS in browser context)
- **Expected:** Real PayOS client ID or removal of client-side config (backend handles PayOS correctly via env bindings)
- **Severity:** CRITICAL
- **Impact:** The `typeof process !== 'undefined' && process.env` check will ALWAYS fail in browser. The exported `PAYMENT_CONFIG.payos.clientId` will always be `'YOUR_PAYOS_CLIENT_ID'`. If any frontend code references this config, payments will fail.
- **Fix:** Remove the client-side PayOS clientId entirely (it is NOT used by any frontend code — the backend `worker/src/routes/payment.js` correctly reads from `c.env.PAYOS_CLIENT_ID`). Alternatively, hardcode or remove the dead config.

### CRIT-05: Bank account number is placeholder/example value

- **File:** `js/checkout/qr-code.js` line 21
- **Current:** `accountNumber: '0901234567'` (looks like a phone number, not a bank account)
- **Expected:** Real MB Bank account number for the business
- **Severity:** CRITICAL
- **Impact:** Bank transfer QR codes will encode a wrong account number. Customers who scan the QR and transfer money will send funds to the wrong account or the transfer will fail.
- **Fix:** Replace with the actual MB Bank account number for Aura Space Cafe.

---

## HIGH Issues

### HIGH-01: No backend routes for MoMo and VNPay payment creation

- **File:** `js/checkout/payment.js` lines 116-129 (MoMo), lines 170-184 (VNPay)
- **Current:** Frontend calls `GET /api/payment/create-url?payment_method=momo` and `GET /api/payment/create-url?payment_method=vnpay` but no such backend route exists. Worker only has `POST /api/payment/create-link` (PayOS only).
- **Expected:** Backend routes for MoMo and VNPay URL creation, or explicit disable of these payment methods in UI.
- **Severity:** HIGH
- **Impact:** MoMo and VNPay payment flows will always fail with 404, falling back to QR code display (MoMo) or static QR (VNPay). The QR codes are cosmetic SVGs generated from hash — they are NOT real scannable payment QR codes.
- **Fix:** Either (a) implement backend MoMo/VNPay payment routes, or (b) remove MoMo/VNPay as payment options from the checkout UI, or (c) clearly document these as "manual transfer via QR" fallback-only.

### HIGH-02: .env file contains all placeholder credentials

- **File:** `.env` lines 1-20
- **Current:** All values are placeholder strings (`your_vnpay_hash_secret_here`, `your_momo_access_key_here`, `your_payos_client_id`, etc.)
- **Expected:** Real credentials or `.env` should not exist in repo (use `.env.example` only)
- **Severity:** HIGH
- **Impact:** `.env` and `.env.example` are identical — no real credentials are configured. The `.env` file is checked into the repo which violates secret management practices.
- **Fix:** Remove `.env` from the repo (add to `.gitignore`). Keep `.env.example` as template. Use `wrangler secret put` for production secrets.

### HIGH-03: worker/.dev.vars has dev-only placeholder secrets

- **File:** `worker/.dev.vars` lines 1-4
- **Current:** `JWT_SECRET=local-dev-secret-key-for-testing-only`, `PAYOS_CLIENT_ID=local_dev`, `PAYOS_API_KEY=local_dev`, `PAYOS_CHECKSUM_KEY=local_dev`
- **Expected:** These are correctly dev-only values BUT must NOT be used in production.
- **Severity:** HIGH
- **Impact:** If `.dev.vars` values leak to production or wrangler secrets are not set, JWT tokens will use a weak secret and PayOS integration will fail.
- **Fix:** Verify production secrets are set via `wrangler secret list`. The `wrangler.toml` comments list the required secrets — ensure all 4 are configured: `JWT_SECRET`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.

### HIGH-04: CORS_ORIGIN = "*" in wrangler.toml

- **File:** `worker/wrangler.toml` line 19
- **Current:** `CORS_ORIGIN = "*"`
- **Expected:** The `[vars]` binding is unused — the actual CORS implementation in `worker/src/index.js` lines 50-67 uses a proper allowlist of regex patterns. However, the `*` value in `[vars]` is misleading and could be accidentally referenced.
- **Severity:** HIGH
- **Impact:** Currently no impact (code uses hardcoded allowlist), but any future refactor referencing `env.CORS_ORIGIN` would open the API to all origins.
- **Fix:** Either remove `CORS_ORIGIN` from `[vars]` or set it to `https://auraspace.cafe` and wire it into the CORS middleware.

---

## MEDIUM Issues

### MED-01: Duplicate API_BASE definitions across multiple files

- **Files:** `js/checkout.js` line 53-55, `js/config.js` line 12-18, `js/cart.js` line 9-10, `js/auth.js` line 26-27, `js/kds-app.js` line 26-27, `js/track-order.js` line 14-15, `js/loyalty.js` line 405-407, `js/signup-loyalty.js` line 1-3, `js/pos.js` line 6-8
- **Current:** Each file independently checks `window.location.hostname === 'localhost'` and defines its own API_BASE URL.
- **Expected:** Single source of truth from `js/config.js` `API_CONFIG.BASE`
- **Severity:** MEDIUM
- **Impact:** If the production Worker URL changes, 9+ files must be updated manually. Risk of inconsistency.
- **Fix:** Import `API_CONFIG.BASE` from `js/config.js` in all modules instead of redeclaring.

### MED-02: MoMo partnerCode 'AURASPACE2026' is unverified

- **File:** `js/config.js` line 26
- **Current:** `partnerCode: 'AURASPACE2026'`
- **Expected:** Verified MoMo merchant partner code from MoMo Business dashboard
- **Severity:** MEDIUM
- **Impact:** If this is not a registered MoMo partner code, MoMo API calls (if backend is ever implemented) will be rejected.
- **Fix:** Verify this partner code exists in MoMo merchant dashboard. If MoMo is not supported, remove this config.

### MED-03: QR code generation produces non-scannable cosmetic SVGs

- **File:** `js/checkout/qr-code.js` lines 58-90
- **Current:** `generateSimpleQR()` creates a hash-based pattern that looks like a QR code but is NOT a valid QR code encoding.
- **Expected:** Use a proper QR code library (e.g., `qrcode` npm package) to generate real scannable QR codes.
- **Severity:** MEDIUM
- **Impact:** MoMo QR and VNPay QR fallback displays show fake QR codes. Customers cannot scan them. Bank transfer QR uses VietQR URL redirect which may work but the embedded QR SVG is still fake.
- **Fix:** Replace `generateSimpleQR()` with a real QR code library, or use VietQR image API (`https://img.vietqr.io/image/{bankCode}-{accountNo}-...`) for bank QR.

### MED-04: PayOS webhook signature verification uses sorted-key canonical form

- **File:** `worker/src/routes/webhooks.js` lines 25-36
- **Current:** Webhook signature computed by sorting all keys alphabetically and joining as `k=v&k=v`
- **Expected:** Must match PayOS documentation exactly. PayOS payment creation uses explicit field order (`amount`, `cancelUrl`, `description`, `orderCode`, `returnUrl`) in `payment.js` line 19-25. The webhook verification uses a different canonical form (sorted all keys). These must be consistent with PayOS spec.
- **Severity:** MEDIUM
- **Impact:** If PayOS changes payload structure or the canonical form doesn't match their spec, webhook verification will silently fail and payments won't be confirmed.
- **Fix:** Verify the webhook signature algorithm matches current PayOS IPN documentation. Test with a real PayOS test webhook.

### MED-05: FE_BASE_URL not set in wrangler.toml [vars]

- **File:** `worker/src/routes/payment.js` line 75
- **Current:** `c.env.FE_BASE_URL || 'https://auraspace.cafe'` — fallback is correct but `FE_BASE_URL` is not defined in `wrangler.toml` `[vars]`
- **Expected:** Explicit `FE_BASE_URL = "https://auraspace.cafe"` in `[vars]` for clarity
- **Severity:** MEDIUM
- **Impact:** Currently works via fallback. But relying on hardcoded fallback is fragile.
- **Fix:** Add `FE_BASE_URL = "https://auraspace.cafe"` to `wrangler.toml` `[vars]` section.

---

## Summary Table

| # | Issue | File | Severity | Status |
|---|-------|------|----------|--------|
| CRIT-01 | MoMo sandbox endpoint | js/config.js:27 | CRITICAL | Must fix |
| CRIT-02 | VNPay sandbox endpoint | js/config.js:36 | CRITICAL | Must fix |
| CRIT-03 | VNPay TEST merchant code | js/config.js:35, .env:5 | CRITICAL | Must fix |
| CRIT-04 | PayOS placeholder client ID | js/config.js:31 | CRITICAL | Must fix |
| CRIT-05 | Placeholder bank account | js/checkout/qr-code.js:21 | CRITICAL | Must fix |
| HIGH-01 | No backend for MoMo/VNPay | worker/src/routes/ | HIGH | Must fix or disable |
| HIGH-02 | .env with placeholders in repo | .env | HIGH | Remove from repo |
| HIGH-03 | Dev-only secrets in .dev.vars | worker/.dev.vars | HIGH | Verify prod secrets |
| HIGH-04 | CORS_ORIGIN = "*" misleading | worker/wrangler.toml:19 | HIGH | Remove or wire up |
| MED-01 | Duplicate API_BASE x9 files | js/*.js | MEDIUM | Consolidate |
| MED-02 | Unverified MoMo partner code | js/config.js:26 | MEDIUM | Verify |
| MED-03 | Fake QR codes (cosmetic SVG) | js/checkout/qr-code.js | MEDIUM | Use real QR lib |
| MED-04 | Webhook sig canonical form | worker/src/routes/webhooks.js | MEDIUM | Verify against spec |
| MED-05 | FE_BASE_URL not in vars | worker/wrangler.toml | MEDIUM | Add to [vars] |

---

## Recommended Fix Priority

1. **Immediate (pre-launch blockers):** CRIT-01 through CRIT-05 — sandbox URLs, placeholder credentials, fake bank account
2. **Before launch:** HIGH-01 (decide MoMo/VNPay strategy), HIGH-02 (remove .env), HIGH-03 (verify wrangler secrets), HIGH-04 (clean CORS var)
3. **Post-launch cleanup:** MED-01 through MED-05

## Production Secrets Checklist

Run these commands to verify production secrets are configured:

```bash
cd worker && npx wrangler secret list
```

Required secrets (per wrangler.toml comments):
- [ ] `JWT_SECRET` — strong random secret (not `local-dev-secret-key-for-testing-only`)
- [ ] `PAYOS_CLIENT_ID` — from PayOS merchant dashboard
- [ ] `PAYOS_API_KEY` — from PayOS merchant dashboard
- [ ] `PAYOS_CHECKSUM_KEY` — from PayOS merchant dashboard

Optional (if MoMo/VNPay backend is implemented):
- [ ] `MOMO_ACCESS_KEY`
- [ ] `MOMO_SECRET_KEY`
- [ ] `VNPAY_HASH_SECRET`
