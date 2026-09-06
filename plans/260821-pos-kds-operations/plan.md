# POS/KDS Operations — Offline-First & SLA

**Status:** Proposed · **Scope:** POS, KDS, table sessions, SLA, print/receipt

## Goals
- Make POS work offline and sync reliably when back online.
- Give KDS real SLA escalation instead of a cron definition with no action.
- Make print/receipt retry-safe with a queue.
- Close table session lifecycle gaps.
- All changes pass typecheck, unit tests, build, and smoke tests.

## Existing assets
- `src/components/stitch/StitchPOSNew*.tsx` — POS UI and 10 sub-components.
- `src/components/stitch/StitchKDSNew.tsx` + 11 KDS sub-components.
- `src/components/reservation/TableMap.tsx` — floor plan.
- `worker/src/routes/kitchen-stations.ts`, `staff-tips.ts`, `table-sessions.ts`, `floor-plan.ts`.
- `worker/src/routes/cron.ts` — SLA cron trigger definition.
- `worker/wrangler.toml` — `SLA_THRESHOLD_MINUTES = 15`, cron `*/5 * * * *`.
- `worker/src/tree/orders/order-state-machine.ts` — FSM with tests.

## Phases
1. [ ] POS offline queue and sync — [phase-01](phase-01-pos-offline-queue.md)
2. [ ] KDS SLA escalation — [phase-02](phase-02-kds-sla-escalation.md)
3. [ ] Print/receipt retry queue — [phase-03](phase-03-print-receipt-queue.md)
4. [ ] Table session lifecycle — [phase-04](phase-04-table-session-lifecycle.md)
5. [ ] Staff tips distribution and reports — [phase-05](phase-05-staff-tips-reports.md)
6. [ ] Operations smoke tests — [phase-06](phase-06-operations-smoke-tests.md)

## Definition of done
- Offline order submission is persisted and replays exactly once on reconnect.
- Overdue orders are escalated and visible in KDS and admin.
- Failed prints/receipts retry and are not lost.
- Table sessions expire and release tables without manual intervention.
- Staff tips report reconciles against orders and shifts.
- New code is covered by tests and passes typecheck, build, and smoke checks.

## Approval gate
Review whether offline queue may store order payloads in IndexedDB, and whether SLA escalation may notify staff via ZNS/SMS.