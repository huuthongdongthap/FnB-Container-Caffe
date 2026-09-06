# Phase 2 — KDS SLA Escalation

## Overview
**Priority:** P0 · **Status:** Proposed

The cron definition exists but produces no operator-visible escalation. Make overdue orders escalate and surface.

## Steps
1. Audit `worker/src/routes/cron.ts` SLA trigger and the `SLA_THRESHOLD_MINUTES` config.
2. Add an SLA escalation action that flags overdue orders and records an escalation event.
3. Route escalated orders to a visible KDS column and admin dashboard.
4. Add optional staff notification via existing ZNS/SMS channels.
5. Add tests for escalation timing, threshold boundary, and idempotent re-escalation.

## Files
- Modify: `worker/src/routes/cron.ts`, KDS frontend, admin dashboard.
- Tests: SLA escalation suite.

## Success criteria
- An order overdue by the threshold is escalated once and visible.
- Re-running the cron does not double-escalate.