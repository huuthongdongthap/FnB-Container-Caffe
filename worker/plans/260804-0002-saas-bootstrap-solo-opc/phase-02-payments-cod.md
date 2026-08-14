---
phase: 2
title: "Payments + COD"
status: completed
priority: P0
effort: "4h"
dependencies: [1]
---

# Phase 2: Payments + COD

## Context Links
- Reports: `reports/scout-saas-bootstrap.md`, `reports/researcher-saas-scope.md`
- Existing: `src/routes/payments.ts`, `src/routes/payments-nowpayments.ts`

## Overview
Add COD (cash on delivery) flag to the existing PayOS payment flow. Solo OPC owner receives cash directly, no online payment needed for all orders.

## Requirements
- Add `is_cod INTEGER DEFAULT 0` column to orders table
- Add `payment_method TEXT DEFAULT 'payos'` column
- When is_cod=1, skip PayOS link, set status="cod_pending"
- Owner taps "Đã thu tiền" → status="completed"
- Update payments.ts to respect is_cod flag

## Architecture
Simple column additions. COD orders bypass payment webhook. Cash payout = SUM(total) WHERE status="completed" AND is_cod=1.

## Related Code Files
- Modify: `src/routes/payments.ts`
- Create: `migrations/014_cod_payment.sql`

## Implementation Steps
1. Create migration 014_cod_payment.sql
2. Update payments.ts create-link to skip PayOS when is_cod=1
3. Add PATCH /api/orders/:id/mark-paid route
4. Test COD flow end-to-end

## Success Criteria
- [ ] Migration applied
- [ ] COD orders skip PayOS
- [ ] Owner can mark COD as paid
- [ ] Existing PayOS flow unchanged

## Risk Assessment
- Zero impact on PayOS flow if gated correctly
- Mitigation: unit test both paths (COD + PayOS)

## Security Considerations
- mark-paid requires owner auth only

## Next Steps
Unblocks: Phases 3-6
