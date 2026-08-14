--- phase: 6
title: "Billing History + Receipt Download"
status: completed
priority: P1
effort: "0.5d"
dependencies: [4]
---

# Phase 06: Billing History + Receipt Download

## Overview
Add invoice history table to dashboard with receipt download for paid invoices.

## Requirements
- Invoice history table in dashboard (date, amount, status, download)
- Receipt download as .txt (invoice_number, period, amount, payment method)
- Bilingual receipt content

## Architecture
- Modify existing dashboard page to include "Billing History" tab/section.
- New route: `worker/src/routes/subscription-invoices.ts` → add `GET /:id/receipt`.
- Receipt content returned as text/plain with `Content-Disposition: attachment`.

## Related Code Files
- Modify: `src/pages/saas/dashboard/index.tsx` (add billing section)
- Create: `worker/src/routes/subscription-invoices.ts` (receipt endpoint)
- Read: `worker/src/tree/subscriptions/invoice-handlers.ts` (existing invoice logic)

## Implementation Steps
1. Add `GET /subscriptions/invoices/:id/receipt` to invoice routes.
2. Receipt handler: fetch invoice + subscription + plan, format text with VN + EN template based on locale, return as text/plain.
3. Dashboard billing section: table of invoices with status badges, download button for paid invoices.
4. Download button opens receipt URL in new tab.
5. Bilingual receipt template: VN header + EN fallback.

## Success Criteria
- [ ] Paid invoices show download button
- [ ] Downloaded receipt contains invoice_number, period, amount, payment_method
- [ ] Receipt bilingual (VN primary)
- [ ] npm test passes
