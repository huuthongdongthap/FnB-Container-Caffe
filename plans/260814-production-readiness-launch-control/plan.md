# Production Readiness & Launch Control Center

**Status:** Approved 2026-08-25 — implementation may begin  
**Scope:** Observability, payments, security, backup, rollback  
**Target:** Cloudflare Workers + D1 + KV production deployment

## Goals
- Trace every request/order/payment across frontend, Worker, D1, KV, and providers.
- Make payment and webhook processing replay-safe and operationally visible.
- Harden admin/API access without breaking existing customer flows.
- Prove D1 backup/restore and provide a tested rollback path.
- Gate production releases with automated smoke checks.

## Phases
1. [x] Baseline production inventory and SLOs — [phase-01](phase-01-baseline-and-slos.md) ✅ 2026-08-25
2. [x] Observability and incident diagnostics — [phase-02](phase-02-observability-and-diagnostics.md) ✅ 2026-08-25
3. [x] Payment reliability and webhook hardening — [phase-03](phase-03-payment-reliability.md) ✅ 2026-08-25
4. [x] Security controls and admin auditability — [phase-04](phase-04-security-controls.md) ✅ 2026-08-25
5. [x] D1 backup, restore, and disaster recovery — [phase-05](phase-05-backup-restore.md) ✅ 2026-08-25
6. [x] Release gates, smoke tests, and rollback — [phase-06](phase-06-release-and-rollback.md) ✅ 2026-08-25
7. [x] Final production readiness review — [phase-07](phase-07-final-readiness-review.md) ✅ 2026-08-25

## Key existing assets
- `worker/src/middleware/logger.ts` — structured JSON logging and request metrics.
- `worker/src/routes/health.ts` — worker/D1 health endpoint.
- `worker/src/middleware/rate-limit.ts` and `audit-log.ts` — existing controls to extend.
- `worker/src/tree/orders/create-order.ts` — KV order idempotency.
- `worker/src/routes/webhook*` and PayOS E2E tests — payment integration surface.
- `deploy-cloudflare.sh`, `scripts/deploy-rollback.sh`, `scripts/smoke-saas.sh` — deployment assets.
- `worker/wrangler.toml` — production bindings and cron configuration.

## Non-goals
- Replacing Cloudflare, Hono, D1, KV, PayOS, or the existing auth model.
- Building a new analytics product or redesigning customer/admin UI.
- Committing secrets, tokens, database credentials, or provider keys.

## Definition of done
- Tests cover correlation IDs, error metrics, replay/idempotency, auth/rate limits, and health degradation.
- Backup and restore are demonstrated against a safe database target.
- Production deploy runs preflight + smoke checks and has documented rollback.
- Sensitive logs are redacted; admin mutations are auditable.
- All changes pass typecheck, unit tests, build, and targeted production checks.

## Approval gate — RESOLVED 2026-08-25 (user-approved)

| Decision | Choice |
|----------|--------|
| Scope | Full 7 phases |
| SLO thresholds | Standard: API avail ≥99.5%/mo, p95 <800ms, payment success >95%, webhook lag <5min, KDS SLA 15min (= `SLA_THRESHOLD_MINUTES`), severity P0-P2 |
| Retention | Request logs KV TTL 7d; admin audit-log 90d; orders/payments retained indefinitely in D1 |
| Backup drill | D1 Time Travel (30-day PITR) as primary restore mechanism + drill on a newly created staging D1 DB |

Verified baseline before approval: request_id correlation exists in logger.ts; health endpoint has degraded state; PayOS webhook already verifies HMAC signature and short-circuits replayed transactions ("Already processed"); smoke-saas.sh covers SaaS flows; deploy-rollback.sh covers Pages only (no DB backup script); no staging D1 exists yet.
