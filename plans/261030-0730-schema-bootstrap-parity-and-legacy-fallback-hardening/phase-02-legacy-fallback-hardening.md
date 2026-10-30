# Phase 02: Legacy Fallback Hardening (`shifts` & `tables`)

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-schema-bootstrap-parity-and-legacy-fallback-hardening.md)
- `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- `worker/src/tree/analytics/zone-analytics.ts`
- `worker/src/routes/tables-mobile.ts`
- `worker/src/routes/customer-assistant.ts`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Guard legacy `shifts` and `tables` fallback queries against throwing unhandled `no such table` exceptions on canonical D1 (`staff_shifts` / `cafe_tables`), and add a `cafe_tables` join fallback for `customer-assistant.ts` `table_bill` lookups.

## Related Code Files
- Modify: `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- Modify: `worker/src/tree/analytics/zone-analytics.ts`
- Modify: `worker/src/routes/tables-mobile.ts`
- Modify: `worker/src/routes/customer-assistant.ts`

## Todo List
- [x] Guard secondary `shifts` fallback in `cash-reconciliation-policy.ts`
- [x] Guard legacy `tables` fallback in `zone-analytics.ts`
- [x] Guard legacy `tables` fallback in `tables-mobile.ts`
- [x] Add `cafe_tables` join fallback in `customer-assistant.ts`
