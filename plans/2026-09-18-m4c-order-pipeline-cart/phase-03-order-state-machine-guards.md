# Phase 03: Order State Machine & Transition Authorization

## Overview
- **Goal:** Enforce strict order lifecycle transitions (`canTransition`) and role-based guard policies.
- **Status:** READY FOR IMPLEMENTATION
- **Dependency:** Phase 02 Order Snapshot.

## Requirements
1. **Canonical State Transitions:**
   - `pending` → `confirmed` | `cancelled`
   - `confirmed` → `preparing` | `cancelled`
   - `preparing` → `ready` | `cancelled`
   - `ready` → `served` | `delivered` | `cancelled`
   - `served` → `completed`
   - `delivered` → `completed`
   - `completed`, `cancelled` = TERMINAL (no outgoing transitions allowed).
2. **Actor Authorization Rules:**
   - Customer: Can cancel only in `pending` status.
   - Staff/Barista/Kitchen: Can transition between operational states (`confirmed` → `preparing` → `ready` → `served`).
   - Rider/Delivery: Can transition `ready` → `delivered` → `completed`.
   - Admin/Manager: Full operational override except on terminal states.
3. **Transition Side Effects:**
   - Table status auto-update on order progression.
   - KDS station notification on `confirmed`.
   - Loyalty accrual on `completed`.

## Implementation Tasks
- [ ] Connect `updateOrder` in `@aura/domain-order` strictly to `canTransition()`.
- [ ] Implement actor authorization guard `canActorTransition(actorRole, from, to)`.
- [ ] Verify unit tests in `packages/domain/order/__tests__/order-state-machine.test.ts`.
