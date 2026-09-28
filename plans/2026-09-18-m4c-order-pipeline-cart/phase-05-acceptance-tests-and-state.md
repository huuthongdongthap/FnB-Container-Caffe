# Phase 05: Acceptance Tests & State Synchronization

## Overview
- **Goal:** Verify M4-C functionality with contract, security, domain, and integration tests. Update project state artifacts.
- **Status:** COMPLETE
- **Dependency:** Phases 01-04.

## Acceptance Test Categories
1. **Domain Tests:** Pricing engine, channel resolution, price snapshot immutability, state machine transitions.
2. **Contract Tests:** OpenAPI schema matches runtime; request/response validation.
3. **Security Tests:** IDOR prevention, price tampering rejection, field leakage tests.
4. **Integration Tests:** Full order lifecycle (create → confirm → prepare → ready → served/delivered → completed).
4. **Regression Guards:** Existing 3,395 tests remain green; `tsc --noEmit` clean.

## Test Scenarios
- Channel pricing: dine_in base price, takeaway +service_fee, delivery +shipping_fee.
- Happy hour discount applies on eligible channel and time window.
- Modifier price_delta aggregated correctly into unitPriceCents.
- Order snapshot stored verbatim; catalog price change does not affect historical order total.
- Customer cannot read another customer's order.
- Customer cannot inject price/total/discount in create payload.
- State transition authorization: invalid actor/status rejected with machine-readable error.

## State Synchronization
- Update `.ai/state/current.md`, `.ai/state/progress.md`, `.ai/state/decisions.md`, `.ai/state/blockers.md` after each phase completion.
- Record decisions with rationale and evidence.

## Definition of Done
- [x] All Phase 01-04 code implemented and tested.
- [x] `npx tsc --noEmit` = 0 errors.
- [x] `npx vitest run` = 3,395+ tests PASS. (375 files / 3,464 tests)
- [x] New M4-C tests added and passing.
- [x] OpenAPI docs generated and mounted.
- [x] State files updated.