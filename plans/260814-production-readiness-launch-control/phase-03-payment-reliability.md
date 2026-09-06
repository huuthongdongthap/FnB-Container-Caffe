# Phase 3 — Payment Reliability and Webhook Hardening

## Overview
**Priority:** P0 · **Status:** Completed 2026-08-25

Make PayOS payment creation and webhook processing safe under retries, duplicates, delays, and provider failures.

## Delivered
1. Create-link idempotency: verified pre-existing guard reuses a pending payment link (`payments.ts:125-141`) instead of creating duplicates; UNIQUE partial index `idx_payments_txn_unique` on `transaction_id` (non-empty) applied remote + migration file `20260825_01_payments_txn_unique.sql` — belt-and-suspenders against duplicate rows.
2. Webhook atomic transition + race guard: `UPDATE payments ... WHERE transaction_id=? AND (status != 'completed' | status = 'pending')`; handler now checks `meta.changes` — a duplicate/concurrent webhook that loses the race (0 rows) is treated as "Already processed" without firing Telegram/email (no double notifications).
3. Out-of-order handling: late success webhook now supersedes a previously-failed payment (failed→completed allowed; completed is terminal, failure webhooks may only transition from pending).
4. Rejection observability: `webhook_rejected` metric with reason tags (invalid_signature, amount_mismatch, unknown_order) — operator-visible via `_metrics`; DLQ KV write on handler error pre-existed (verified).
5. Tests: payos-webhook-e2e expanded 4→9 (race-lost 0-changes, late-success-supersedes, malformed ack, unknown-order ack, + existing). Full suite 1533/1533 passed; tsc clean.

## Steps
1. Inventory payment/order status transitions and provider identifiers.
2. Enforce idempotency for payment creation using a durable order/provider key.
3. Verify webhook signature, amount, order identity, and allowed status transition before mutation.
4. Add replay protection and duplicate-event handling with a persisted event key.
5. Ensure atomic payment/order updates and safe notification dispatch after commit.
6. Add bounded retry/dead-letter handling for provider and notification failures.
7. Emit structured outcome metrics and operator-visible failure reasons.
8. Expand E2E tests for duplicate, replay, out-of-order, malformed, and timeout cases.

## Files
- Modify: PayOS route/service, payment schema/migrations, order status integration.
- Tests: PayOS webhook and payment flow suites.

## Success criteria
- Replaying any webhook does not double-complete, double-charge, or duplicate notifications.
- Invalid signatures and mismatched amounts are rejected and observable.
