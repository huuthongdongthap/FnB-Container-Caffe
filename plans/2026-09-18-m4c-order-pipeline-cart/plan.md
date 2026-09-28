# Plan: M4-C Order Pipeline & Server-Authoritative Cart Engine

## Overview
- **Milestone:** M4-C
- **Target:** Order creation, server-authoritative price snapshot, channel pricing (Gap Y-03), and state machine enforcement.
- **Foundation:** Reuses `@aura/domain-catalog` and customer projection from M4-B with zero model duplication.
- **Verification Baseline:** 371 test files / 3,395 tests PASS, 0 TypeScript errors (`tsc --noEmit`).

## Phases
1. [Phase 01: Pricing Engine & Channel Pricing Resolution (Gap Y-03)](./phase-01-pricing-engine-and-channel.md)
2. [Phase 02: Order Price Snapshot & Immutable Line Items](./phase-02-price-snapshot-and-cart.md)
3. [Phase 03: Order State Machine & Transition Authorization](./phase-03-order-state-machine-guards.md)
4. [Phase 04: Customer Security Boundary & OpenAPI Contract](./phase-04-customer-security-and-api-contract.md)
5. [Phase 05: Acceptance Tests & State Synchronization](./phase-05-acceptance-tests-and-state.md)

## Key Invariants
- Route ≠ Business Logic; DTO ≠ Domain Model.
- Zero client-side price tampering: client supplies only `menuItemId`, `quantity`, `modifiers`, `orderType/channel`. Server evaluates all `priceCents`.
- Historical orders snapshot prices at creation; catalog updates never alter historical totals.
- Reuses `@aura/domain-catalog` and `@aura/domain-order` without introducing parallel schemas.
