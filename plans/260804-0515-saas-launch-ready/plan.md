# SaaS Launch Ready — Plan

> Project: AURA CAFE / F&B Container Caffe  
> Scope: Close the gaps between scaffolded SaaS infra and a sellable, self-service customer experience  
> Status: completed — all phases executed and verified  
> Created: 2026-08-04  
> Tags: #saas-launch #fnb #hono #d1 #multi-tenant #payments #onboarding

---

## At a Glance

| Phase | Name | Priority | Est. | Status |
|-------|------|----------|------|--------|
| 01 | Self-service Registration + JWT Session | P0 | 1d | completed |
| 02 | Workspace (Tenant) Creation Flow | P0 | 1d | completed |
| 03 | Customer Dashboard — Subscriptions + Invoices | P0 | 1.5d | completed |
| 04 | Payment Gateway: Invoices → NowPayments | P0 | 1.5d | completed |
| 05 | Onboarding Wizard (4-step) | P1 | 1d | completed |
| 06 | Billing History + Receipt Download | P1 | 0.5d | completed |
| 07 | Subscription Cancel / Plan Change UX | P1 | 0.5d | completed |
| 08 | E2E Smoke + Deploy Verification | P0 | 0.5d | completed |

Dependencies: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 (linear per user decision).

Non-goals: Operator dashboard, bulk tenant management, automated invoicing cron (use existing), third-party SSO (Google/Facebook).

## Verified Decisions (from validation 2026-08-04)
- Payment gateway: NOWPayments primary + explicit manual fallback when `NOWPAYMENTS_API_KEY` absent
- Onboarding wizard: 4-step (welcome → container → zone → confirmation)
- Auth: Email verification REQUIRED before workspace creation
- Execution: Linear only, no parallel

---

## Phase 01 — Self-service Registration + JWT Session + Email Verification

**Priority:** P0 | **Effort:** 1d  
**Dependencies:** none  
**Files to create:** `worker/src/routes/auth-register.ts`, `worker/src/routes/auth-verify.ts`, `worker/src/routes/auth-session.ts`, `worker/src/tree/auth/email-verification.ts`, `src/pages/register/index.tsx`, `src/pages/verify-email/index.tsx`  
**Files to modify:** `worker/src/index.ts`, new migration `012_email_verification.sql`

### What
- Registration captures phone + password + email → sends 6-char verification code via Resend/SendGrid.
- New users MUST verify email before workspace creation (validated requirement).
- POST /api/auth/verify-email validates code, sets email_verified=1.
- Session payload includes email_verified flag for downstream gating.

### Acceptance
- POST /api/auth/register → 201, sends verification email
- POST /api/auth/verify-email → 200, marks verified
- Unverified users blocked from workspace creation (403)
- Forms bilingual VN + EN

---

## Phase 02 — Workspace (Tenant) Creation Flow

**Priority:** P0 | **Effort:** 1d  
**Dependencies:** 01  
**Files to modify:** `worker/src/routes/saas-tenants.ts` (replace owner-only with requireAuth + requireVerifiedEmail), `worker/src/middleware/tenant.ts` (header-first resolution)  
**Files to create:** `worker/src/tree/auth/verified-email-middleware.ts`, `src/pages/saas/onboard/tenant-create.tsx`

### What
- Replace `owner_only` guard with `requireAuth` + new `requireVerifiedEmail` middleware.
- Unverified users get 403 + redirect to /verify-email.
- After tenant creation, store tenantId in localStorage + send as X-Tenant-Id header.

### Acceptance
- Verified users can create tenant (tests updated)
- Unverified users blocked at 403
- tenantId persists via header or session claim

---

## Phase 03 — Customer Dashboard — Subscriptions + Invoices

**Priority:** P0 | **Effort:** 1.5d  
**Dependencies:** 02  
**Files to create:** `src/pages/saas/dashboard/index.tsx`  
**Files to modify:** `src/hooks/use-subscriptions.ts` (add `useMyInvoices()`), navigation/routing

### What
- Dashboard page visible under `/saas/dashboard` (locale-prefixed).
- Sections: current plan, next billing date, active invoices, container info (container_number, zone).
- Pulls from existing `GET /subscriptions` and `GET /subscriptions/invoices/list`.

### Acceptance
- Logged-in customer sees their subscription + invoices without admin role
- Empty state: "No subscription yet — see pricing"

---

## Phase 04 — Payment Gateway: Invoices → NowPayments

**Priority:** P0 | **Effort:** 1.5d  
**Dependencies:** 04 (03 provides dashboard button), 08 (deploy verification)  
**Files to modify:** `worker/src/tree/subscriptions/invoice-handlers.ts` (extend `payInvoice`), create `worker/src/tree/subscriptions/nowpayments.ts`  
**Files to create:** `worker/src/routes/payments-nowpayments.ts` (IPN webhook), `worker/src/routes/subscription-checkout.ts`

### What
- Invoice `status` currently only `pending`. Extend: `processing | paid | failed| overdue`.
- On POST /invoices/:id/pay → create NowPayments invoice, store `payment_ref`, set status `processing`.
- NowPayments IPN webhook → mark `paid`, extend `current_period_end` by +1 month (reuse existing logic).
- Fallback: if NowPayments env missing, mark `manual` + surface operator notice.

### Acceptance
- Customer clicks "Pay" on invoice → redirected to NowPayments checkout
- IPN updates invoice + subscription period automatically
- Manual fallback when gateway not configured

---

## Phase 05 — Onboarding Wizard (4-step)

**Priority:** P1 | **Effort:** 1d  
**Dependencies:** 02  
**Files to create:** `src/components/saas/onboarding-wizard/` (step components), page `src/pages/saas/onboard/index.tsx`  
**Files to modify:** onboarding design images in `/public/stitch-designs/06-onboarding-page.*` → implement as React

### What
- 4 steps: 1) Welcome + business name, 2) Container size selection (10ft/20ft/40ft), 3) Zone selection (A/B/C/D), 4) Confirmation → redirect to dashboard.
- Persist draft in session/localStorage; submit creates subscription with trial.

### Acceptance
- Step validation per page, back/next navigation, bilingual labels
- Completion triggers subscription creation with 14-day trial

---

## Phase 06 — Billing History + Receipt Download

**Priority:** P1 | **Effort:** 0.5d  
**Dependencies:** 04  
**Files to modify:** `src/pages/saas/dashboard/index.tsx` (add tab/section)  
**Files to create:** server action or route `worker/src/routes/subscription-invoices.ts` → add `GET /:id/receipt`

### What
- Dashboard shows invoice history table (date, amount, status, download button).
- Download generates text receipt (VN/EN) with invoice_number, period, amount, payment method.

### Acceptance
- Customer can download paid invoice receipt as .txt

---

## Phase 07 — Subscription Cancel / Plan Change UX

**Priority:** P1 | **Effort:** 0.5d  
**Dependencies:** 04  
**Files to modify:** `src/pages/saas/dashboard/index.tsx` (add cancel dialog), `worker/src/tree/subscriptions/sub-handlers.ts` (already has cancel endpoint)

### What
- "Cancel subscription" button → confirmation modal → calls `POST /subscriptions/:id/cancel`.
- "Change plan" → redirect to `/saas/pricing` with pre-selected current plan (upgrade/downgrade handled by creating new subscription, cancelling old — keep simple).

### Acceptance
- Cancel flow accessible from dashboard with confirmation
- Cancel sets status `cancelled`, records reason

---

## Phase 08 — E2E Smoke + Deploy Verification

**Priority:** P0 | **Effort:** 0.5d  
**Dependencies:** 01–07  
**Deliverable:** Smoke test script + checklist verifying each user-facing path end-to-end against deployed worker.

### What
- Script or manual checklist: register → create tenant → onboarding wizard → view dashboard → pay invoice (test mode) → cancel subscription.
- Verify `npm run build` 0 errors, `npm test` passing, `/api/version` SHA matches deploy.

### Acceptance
- All 8 phases pass smoke test before merge to main
- Deploy verification script passes

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| NowPayments sandbox not available | Medium | Fallback to manual payment status; defer live gateway to Phase 09 |
| KRW/VND currency mismatch in payment gateway | Low | Hardcode VND in invoice amount; pass `currency=vnd` to gateway |
| Tenant isolation edge case (session without tenantId) | Medium | Code review gate + test on `tenantMiddleware` fallback behavior |
| Onboarding wizard scope creep (5th step, settings, invites) | Medium | Strict 4-step scope; extras → Phase 09 |

---

## Open Questions

1. Should registration require email verification before workspace creation? (assume no for speed; add later)
2. Container selection in onboarding: free-input or predefined zones from `subscription_plans`? (assume predefined)
3. Receipt format: plain text or PDF (PDF needs extra dependency — defer).
