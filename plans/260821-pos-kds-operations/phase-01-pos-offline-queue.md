# Phase 1 — POS Offline Queue and Sync

## Overview
**Priority:** P0 · **Status:** Proposed

POS must keep working when the network drops and replay exactly once on reconnect.

## Steps
1. Audit `StitchPOSNew` submit path and its dependencies on `create-order`, cart, menu, and table session.
2. Add an IndexedDB-backed queue keyed by a client-generated UUID.
3. Persist the full order payload plus table/session context before sending.
4. Dequeue on success or permanent failure, preserving the client UUID as the idempotency key.
5. Add a sync status indicator and manual retry control in POS UI.
6. Add unit tests for enqueue, replay-on-success, replay-on-failure, and duplicate replay.

## Files
- Modify: POS submit component, order idempotency integration, cart/table context.
- Tests: offline queue and sync suites.

## Success criteria
- A submitted order survives a simulated disconnect and replays exactly once.
- Duplicate replays do not create duplicate orders.