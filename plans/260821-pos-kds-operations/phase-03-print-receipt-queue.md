# Phase 3 — Print/Receipt Retry Queue

## Overview
**Priority:** P0 · **Status:** Proposed

Receipts and kitchen prints must not be lost when the printer or email provider fails.

## Steps
1. Audit `worker/src/routes/webhooks.ts` receipt dispatch and `renderReceipt`.
2. Add a persisted print/receipt queue with attempt tracking and backoff.
3. Persist failed attempts with the same payload and a next-retry timestamp.
4. Add a cron-driven retry loop that picks due entries and re-dispatches.
5. Make success/failure metrics observable.
6. Add tests for enqueue, retry-on-failure, backoff, and dead-letter.

## Files
- Modify: receipt dispatch, cron retry loop, metrics.
- Tests: print/receipt queue suite.

## Success criteria
- A failed print retries and eventually succeeds or is dead-lettered.
- Successful dispatch is not re-sent.