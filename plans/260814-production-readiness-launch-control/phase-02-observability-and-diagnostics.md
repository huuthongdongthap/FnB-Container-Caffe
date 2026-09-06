# Phase 2 — Observability and Diagnostics

## Overview
**Priority:** P0 · **Status:** Completed 2026-08-25

## Delivered
1. Correlation ID: `middleware/correlation-id.ts` — mints/propagates `X-Request-ID`, echoes response header, CORS-exposed. Wired globally in index.ts.
2. Log redaction: `redact()` in logger.ts — masks signature/token/secret/password/api_key/customer_phone/email keys + bare VN phone values, depth/array caps. Applied to every `emit()` payload.
3. KDS SLA escalation (gap G2 closed): cron `checkOverdueOrders` now raises `kds_sla_breach` alert (warning, 30-min cooldown) → Telegram dispatch pipeline.
4. Retention (G7): scheduled handler prunes `_metrics` at 7 days.
5. Tests: correlation-id.test.ts (4), logger-redaction.test.ts (5). Full suite 1529/1529 passed; tsc clean.
6. Runbook: `docs/runbook-incident-triage.md`.

Note: metrics/alerts pipeline (`_metrics`, `_alerts`, Telegram dispatch, health degraded state) pre-existed — verified in metrics-pipeline integration tests; no new counters needed beyond SLA alert wiring.

Extend existing structured logging and health checks into actionable request/order diagnostics.

## Steps
1. Ensure every request receives/propagates a correlation ID and response header.
2. Standardize JSON fields: route, method, status, latency, order ID, payment ID, provider, user ID (non-PII), and error code.
3. Redact tokens, signatures, phone numbers, email addresses, and payment payload secrets.
4. Extend `/api/health` with safe dependency checks and degraded status semantics.
5. Add counters/timers for 4xx/5xx, payment failures, webhook outcomes, D1 errors, and notification failures.
6. Add tests for correlation, redaction, health degradation, and metrics failure isolation.
7. Document Cloudflare log querying and incident triage commands.

## Files
- Modify: `worker/src/middleware/logger.ts`, request middleware, `worker/src/routes/health.ts`.
- Tests: middleware and health test suites.
- Docs: operational runbook.

## Success criteria
- A single order can be traced without exposing sensitive data.
- Logging/metrics failures never fail the customer request.
