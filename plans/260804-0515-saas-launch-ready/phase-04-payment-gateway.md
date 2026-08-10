--- phase: 4
title: "Payment Gateway: Invoices → NowPayments"
status: completed
priority: P0
effort: "1.5d"
dependencies: [3]
---

# Phase 04: Payment Gateway: Invoices → NowPayments

## Overview
Connect invoice payment to NowPayments (with manual fallback), completing the revenue collection loop.

## Requirements
- Invoice statuses extended: processing | paid | failed | overdue
- POST /invoices/:id/pay → creates NowPayments invoice, stores payment_ref
- NowPayments IPN webhook → marks invoice + subscription period
- Fallback: manual payment when gateway not configured

## Architecture
- New file: `worker/src/tree/subscriptions/nowpayments.ts` — helper to create NowPayments invoice via REST API.
- New route: `worker/src/routes/payments-nowpayments.ts` — IPN webhook handler mounted at `/api/webhooks/nowpayments`.
- Modify: `worker/src/tree/subscriptions/invoice-handlers.ts` — extend `payInvoice` to call NowPayments helper.
- Env vars: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` (optional in `wrangler.toml` or `.dev.vars`).

## Related Code Files
- Create: `worker/src/tree/subscriptions/nowpayments.ts`, `worker/src/routes/payments-nowpayments.ts`
- Modify: `worker/src/tree/subscriptions/invoice-handlers.ts`, `worker/src/routes/subscriptions.ts`
- Read: `worker/src/routes/payments.ts` (existing PayOS/MoMo pattern for reference)
- Migration: `worker/migrations/013_invoice_payment_status.sql` (add/validate invoice status values + payment-related columns)

## Implementation Steps
1. Create `nowpayments.ts` helper: `createInvoice(invoiceId, amountVnd)` calls NowPayments `/v1/invoice` with `currency=vnd`, stores returned `payment_id` as `payment_ref`.
2. In `payInvoice` handler: check env vars → if present, call NowPayments helper; else, set status=manual, log operator alert.
3. IPN webhook: `payments-nowpayments.ts` validates IPN secret, looks up invoice by `payment_ref`, sets status=paid, calls existing `extendPeriodEnd` logic.
4. Mount webhook in `worker/src/index.ts` at `/api/webhooks/nowpayments`.
5. Frontend: dashboard "Pay" button redirects to `payment_data.checkout_url` from NowPayments response, or shows manual instructions in fallback.

## Success Criteria
- [ ] POST /invoices/:id/pay creates external invoice, stores payment_ref
- [ ] IPN webhook marks invoice paid + extends subscription period
- [ ] Fallback mode when NOWPAYMENTS_API_KEY absent
- [ ] npm test passes
- [ ] npm run build: 0 TypeScript errors
