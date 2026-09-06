# Runbook — Incident Triage & Log Querying (Cloudflare Workers)

Applies to: AURA CAFE worker (Cloudflare Workers + D1 + KV). Companion to
`plans/260814-production-readiness-launch-control/readiness-baseline-inventory.md`.

## Correlation

Every response carries `X-Request-ID`. Browser support requests should quote it.
Inbound IDs from upstream gateways are propagated unchanged (8–128 chars).

```bash
# Tail live logs filtered by request id
npx wrangler tail --format json | jq 'select(.message | contains("r_abc123"))'
```

## SLO thresholds & alerting (approved 2026-08-25)

| SLO | Threshold | Severity |
|-----|-----------|----------|
| API availability | ≥99.5%/mo | P0 <99% |
| p95 latency | <800ms | P1 >1.5s × 10min |
| Payment success | >95% | P0 <90% |
| Webhook lag | <5min | P0 >15min |
| KDS order SLA | 15min (`SLA_THRESHOLD_MINUTES`) | P1 any breach |

Alerts flow: metric breach → `_alerts` row (`recordAlert`, cooldown-gated) →
Telegram via cron-admin dispatch (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`
secrets required — unconfigured means alerts queue undelivered, never lost).
KDS SLA breaches raise `kds_sla_breach` warnings with 30-min cooldown.

## Metric queries (D1 `_metrics` table)

```bash
# 24h error rate by status bucket
npx wrangler d1 execute AURA_DB --remote --command "
  SELECT json_extract(tags,'$.status_code') AS status, COUNT(*) n
  FROM _metrics WHERE name='request' AND created_at > datetime('now','-1 day')
  GROUP BY 1"

# KDS stuck orders trend (hourly, last day)
npx wrangler d1 execute AURA_DB --remote --command "
  SELECT strftime('%H',created_at) hr, MAX(value) stuck
  FROM _metrics WHERE name='order_stuck' AND created_at > datetime('now','-1 day')
  GROUP BY 1"
```

## Retention (enforced in scheduled handler)

- `_metrics`: pruned daily at 7 days
- Admin audit log: 90 days (manual review; enforcement lands with Phase 4)
- Orders/payments: retained indefinitely

## Incident triage sequence

1. `GET /api/health?db=1` — degraded ⇒ D1 connectivity issue
2. `GET /api/version` — confirm deployed SHA vs expected
3. Check Telegram for recent `_alerts`; if silent, check dispatch config
4. Query `_metrics` for 5xx spike window (see queries above)
5. Pull payment state: `SELECT status, updated_at FROM payments WHERE order_id='<id>'`
6. Webhook replay check: PayOS webhook short-circuits already-final payments
   ("Already processed") — a stuck `pending` payment after webhook = signature
   mismatch (check logs for `Invalid PayOS webhook signature`)
