---
phase: 6
title: "Owner Admin + Payout Summary"
status: completed
priority: P0
effort: "2h"
dependencies: [2]
---

# Phase 6: Owner Admin + Payout Summary

## Context Links
- Reports: `reports/researcher-saas-scope.md` (F5)
- Existing: `src/routes/analytics-hono.ts`

## Overview
One endpoint on existing analytics router. Adds payout = paid - refunded - COD summary for solo OPC.

## Requirements
- Payout card: total paid (PayOS) + total COD - total refunded
- Simple query on orders table
- Owner-only access

## Architecture
Extend analytics-hono.ts with new `/api/owner/payout` endpoint. Query: SUM(CASE WHEN status='completed' AND is_cod=1 THEN total ELSE 0 END) + SUM(CASE WHEN payment_method='payos' AND status='paid' THEN total ELSE 0 END) - SUM(refunded).

## Related Code Files
- Modify: `src/routes/analytics-hono.ts`

## Implementation Steps
1. Add POST /api/owner/payout route
2. Query aggregated payout from orders
3. Return JSON with breakdown (PayOS, COD, refunded, net)
4. Test with sample data

## Success Criteria
- [ ] Payout endpoint returns correct totals
- [ ] Owner can see daily/weekly breakdown
- [ ] Zero new tables

## Risk Assessment
- Low risk: read-only query on existing schema

## Security Considerations
- Owner auth required (JWT)
- Rate-limit to prevent abuse

## Next Steps
Final phase. All features complete.
