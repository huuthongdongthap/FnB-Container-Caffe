# Production Readiness Baseline Inventory — Phase 1

Date: 2026-08-25 | Method: direct code inspection (read-only, no runtime changes)

## 1. Critical flow map

| Flow | Entry | Backend path | State store | External dep |
|------|-------|--------------|-------------|--------------|
| Customer order (web/QR) | `orders.ts`, `orders-mobile.ts` | `tree/orders/create-order.ts` (KV idempotency) → loyalty-trigger | D1 orders + KV order idem | — |
| POS order | `pos-customer.ts`, `orders-hono.ts` | staff-auth middleware → same create-order | D1 + KV | — |
| Realtime status (SSE) | `order-stream.ts` | PATCH handler writes `order_event:<id>` KV TTL 60s → SSE poll | KV | EventSource clients |
| Payment PayOS | `payments.ts` | create-link → webhook `webhooks.ts` (HMAC verify + replay short-circuit) | D1 payments | PayOS API |
| Payment MoMo / NowPayments | `payments/momo-create.ts`, `payments-nowpayments.ts`, `webhooks/momo.ts` | provider webhooks | D1 payments | MoMo, NowPayments |
| Refunds | `refunds.ts` | PayOS refund columns in D1 | D1 | PayOS |
| Loyalty/cashback | `loyalty.ts`, `checkin.ts`, `referrals.ts` | idempotent earn (`loyalty-trigger.ts`) | D1 wallets/logs | — |
| KDS | `kds-mobile.ts`, `kitchen-stations.ts` | cron SLA check every 5min (`cron.ts:137-145`, log-only today) | D1 | — |
| Notifications | `push.ts`, `notifications-mobile.ts`, `zalo.ts`, `broadcast.ts` | Web Push via `tree/push/notifier.ts`; Zalo; audit-log row per send | D1 notification_audit_log | ZNS |
| Auth staff | `staff-auth.ts`, `auth*.ts` | JWT in AUTH_KV sessions | KV AUTH_KV | — |
| SaaS subscriptions | `subscriptions.ts`, `saas-tenants.ts`, MRR snapshots | invoice cycle | D1 | NowPayments |
| ERP sync | `erpnext-sync.ts` (log) vs `cron.ts` retry queue | outbound sync w/ retry_count | D1 erpnext_* | ERPNext |
| Cron (*/5 min) | wrangler triggers | overdue-order check + erpnext queue drain | D1/KV | — |

## 2. Existing observability & controls

- **Logging:** structured JSON logger w/ `request_id` correlation (`middleware/logger.ts`)
- **Health:** `/api/health` returns ok/degraded incl. D1 probe (`routes/health.ts`); `/api/version`
- **Rate limit:** `middleware/rate-limit.ts` present
- **Audit:** `admin-audit-logs.ts` + `notification_audit_log` table
- **Client errors:** `client_errors.ts` → D1 `client_errors` table (migration 20260820_08)
- **Smoke:** `scripts/smoke-saas.sh` covers register→tenant→pricing→subscriptions→receipt→version
- **Deploy rollback:** `scripts/deploy-rollback.sh` = Pages deployment rollback only. **No DB backup script.**

## 3. Provider dependencies

PayOS · MoMo · NowPayments · Zalo ZNS · Mautic · ERPNext · Odoo (legacy tables live-only) · Cal.com · Pretix · Xibo · Mixpost · Home Assistant · Frigate

## 4. Gaps (drive Phases 2–6)

| # | Gap | Phase |
|---|-----|-------|
| G1 | No latency/error metric aggregation — logs exist, no p95 rollup or alerting surface | P2 |
| G2 | KDS SLA cron only logs overdue orders — no escalation action/notification | P2/P6 |
| G3 | Webhook lag/success not measured as SLO signal | P3 |
| G4 | Admin mutations partially audited; no retention enforcement (90d target) | P4 |
| G5 | No DB backup/restore script or drill; Pages rollback only | P5 |
| G6 | Release pipeline lacks preflight+smoke gate wired to deploy script | P6 |
| G7 | Request-log retention: no TTL policy on any log sink (7d target) | P2 |

## 5. Approved SLO thresholds (user-approved 2026-08-25)

| SLO | Threshold | Severity ladder | Evidence source |
|-----|-----------|-----------------|-----------------|
| API availability | ≥99.5% / month | P0 <99%, P1 <99.5% | health probes + client_errors |
| p95 latency | <800ms | P1 >1.5s sustained 10min | request logs duration_ms |
| Payment success | >95% | P0 <90% | payments.status rollup |
| Webhook processing lag | <5min | P0 >15min | payments.created_at vs paid_at delta |
| KDS order SLA | 15min (= SLA_THRESHOLD_MINUTES) | P1 breach count >0/hr | cron overdue log |
| Notification delivery | >98% push accepted | P2 below | notification_audit_log.status |
| Log retention | request logs TTL 7d (KV), admin audit 90d, orders/payments indefinite | — | KV TTL config / cleanup cron |

## 6. Staging-safe validation targets

- Create staging D1 (`fnb-caffe-db-staging`) for backup drill + migration dry-runs (P5)
- Time Travel PITR is the primary restore mechanism (30-day window)
- Smoke gates run against production URLs read-only (health/version/pricing GETs)
