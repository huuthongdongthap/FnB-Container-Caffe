# SaaS Launch Smoke Checklist

Run from worker root. Target: `https://fnb-caffe-container.workers.dev` (or the live CF worker domain).

Mock: `NOWPAYMENTS_API_KEY` may be unset → manual-fallback path is valid.

## 0 — Build gate
- [ ] `npm run build` → 0 TypeScript errors
- [ ] `npm test` → exit 0

## 1 — Registration
- [ ] `POST /api/auth/register { email, password, name, phone }` → 201
- [ ] Email inbox has 4-digit code (or test via lookup in D1 `email_verifications`)

## 2 — Verify email
- [ ] `POST /api/auth/verify-email { email, code }` → 200
- [ ] `GET /api/auth/session` → `email_verified: true` + JWT

## 3 — Login
- [ ] `POST /api/auth/login { email, password }` → 200 + JWT
- [ ] `GET /api/auth/session` with Bearer → current user

## 4 — Create tenant (owner)
- [ ] `POST /api/saas/tenants/create { name, slug, container_size, zone }` with owner JWT → 201
- [ ] Response includes `tenant.id`; store as `X-Tenant-Id` header for subsequent calls

## 5 — Subscription plan list
- [ ] `GET /api/saas/pricing` → 200 + array of plans

## 6 — Create subscription (trial)
- [ ] `POST /api/subscriptions { plan_id, customer_name, container_number, zone }` with tenant header → 201
- [ ] Response shows `status=trial`, `current_period_end` ~ 14 days from now

## 7 — Onboarding wizard (frontend — manual)
- [ ] `/saas/onboard` renders as the box layout (landing path)
- [ ] Step 1: business name Next blocked when empty
- [ ] Step 2: container size selectable; Next disabled when not selected
- [ ] Step 3: zone selectable; Next disabled when not selected
- [ ] Step 4: summary shows chosen values; Finish button creates subscription and redirects to `/saas/dashboard`

## 8 — Customer dashboard
- [ ] `GET /api/saas/dashboard` (or page load) shows plan, billing date, invoices
- [ ] Empty state renders when no subscription

## 9 — Invoice + payment
- [ ] `GET /api/subscriptions/invoices/list` returns at least the trial invoice
- [ ] `POST /api/subscriptions/invoices/:id/pay` → 200 + `status=processing`
- [ ] If `NOWPAYMENTS_API_KEY` absent → falls back to manual status; no 500

## 10 — Cancel subscription
- [ ] `POST /api/subscriptions/:id/cancel { reason: "smoke test" }` → 200
- [ ] Dashboard subscription card shows `cancelled` status
- [ ] Export/download endpoint returns 200 when `invoice_status=paid` (if applicable)

## 11 — Receipt download
- [ ] `GET /api/subscriptions/invoices/:id/receipt` → TXT attachment, contains `Số`, `amount`, `plan_name`

## 12 — Auth gating
- [ ] `requireVerifiedEmail` on `POST /saas/tenants/create` → 403 if `email_verified=0`
- [ ] Unauthenticated dashboard → redirected / denied (no data leak)

## 13 — Deploy verification
- [ ] `curl <live>/api/version` | `shortSha` == `git rev-parse --short HEAD`
- [ ] Live URL returns HTTP 200

## Failures
Log the step, response status, response body (redact secrets), repro command.
