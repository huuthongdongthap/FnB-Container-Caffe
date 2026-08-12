---
phase: 3
title: "Dine-In QR Flow"
status: completed
priority: P0
effort: "4h"
dependencies: [2]
---

# Phase 3: Dine-In QR Flow

## Context Links
- Reports: `reports/researcher-saas-scope.md` (F2)
- Existing: `src/routes/tables.ts`, `src/routes/orders-mobile.ts`, `tree/qr/signer.ts`

## Overview
QR code per table → guest scans → sees menu → adds items → enters phone → submits order. Reuses existing QR signer + tables + orders-mobile.

## Requirements
- Guest flow: scan QR → menu → add → phone → submit
- Table status auto-updates to "Occupied" on order
- Order status: pending → paid/preparing → ready → completed
- No login required for guest

## Architecture
QR codes already exist per table. orders-mobile.ts already handles waiter-role orders. Extend to allow guest-role (no auth) with phone verification.

## Related Code Files
- Modify: `src/routes/orders-mobile.ts`
- Read: `src/routes/tables.ts`, `src/routes/checkin.ts`

## Implementation Steps
1. Add guest checkout endpoint (POST /api/orders/guest-checkout)
2. Link table_id via QR slug param
3. Auto-set payment_method from query or default
4. Create placeholder order, guest adds items via cart
5. Owner marks preparing → ready → completed

## Success Criteria
- [ ] Guest can scan table QR and start order
- [ ] Table status becomes Occupied
- [ ] Order flows to owner dashboard
- [ ] No login required for guest

## Risk Assessment
- QR camera permissions may need HTTPS
- Mitigation: direct URL fallback (table slug link)

## Security Considerations
- Validate QR signature before accepting table_id
- Rate-limit guest checkout per IP

## Next Steps
Unblocks: Phase 4 (takeaway reuses same order code)
