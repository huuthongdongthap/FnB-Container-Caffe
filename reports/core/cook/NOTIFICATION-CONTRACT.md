# Notification Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-09  
**Scope**: Canonical Server-Side Notification Orchestration across Order/Payment, Reservations, CRM Loyalty Campaigns, Web Push, Zalo ZNS, SMS (SpeedSMS), Email (Resend), and Telegram.

---

## 1. Canonical Notification Pipeline

```
DOMAIN EVENT
   │ (e.g. order.paid, reservation.confirmed, crm.campaign_triggered)
   ▼
NOTIFICATION INTENT (createNotificationIntent)
   │ (Generates stable idempotencyKey, sanitizes secrets, resolves correlation ID)
   ▼
ELIGIBILITY & CONSENT CHECK (evaluateChannelEligibility)
   │ (Verifies customer opt-in/consent for marketing, validates channel format)
   ▼
TEMPLATE VALIDATION (validateTemplatePayload)
   │ (Checks required fields, ensures safe payload)
   ▼
DELIVERY QUEUE / PROVIDER DISPATCH (processNotificationIntent)
   ├── Web Push (VAPID)
   ├── Zalo ZNS (Zalo API)
   ├── SMS (SpeedSMS)
   ├── Email (Resend)
   └── Telegram Bot
   ▼
DELIVERY RESULT & RETRY POLICY
   ├── Success → status = 'delivered'
   ├── Transient (5xx/Timeout) → retry with bounded backoff (maxRetries)
   └── Permanent (4xx/Invalid) → status = 'dead_letter' (no infinite retry)
   ▼
AUDIT LOG RECORDING (notification_audit_log)
```

---

## 2. Event / Channel / Provider Matrix

| Domain Event | Default Channel | Primary Provider | Consent / Eligibility Requirement | Failure Policy |
| :--- | :--- | :--- | :--- | :--- |
| `order.created` | Web Push / Telegram | VAPID / Telegram Bot | Active push subscription or staff chat ID | Bounded retry (max 3) |
| `order.paid` | Email / SMS / Push | Resend / SpeedSMS | Valid email / phone; non-blocking for payment | Bounded retry (max 3) |
| `order.status_updated` | Web Push / Zalo ZNS | VAPID / Zalo | Customer phone or device subscription | Bounded retry (max 3) |
| `reservation.confirmed` | SMS / Zalo ZNS | SpeedSMS / Zalo | Valid customer phone number | Bounded retry (max 3) |
| `crm.campaign_triggered` | Email / Zalo ZNS | Resend / Zalo | **Explicit Marketing Consent Required** (`consentMarketing = true`) | Suppressed if opted-out |
| `kds.alert` | Telegram / In-App | Telegram Bot / D1 | Staff group chat ID or active user session | Bounded retry (max 3) |

---

## 3. Core Contract Invariants

1. **Non-Interference with Business State**: Notification dispatch runs asynchronously and never mutates Order or Payment state. Provider outages or timeouts never abort customer checkout or payment capture.
2. **Deterministic Idempotency**: Intents use stable keys (`ntf_{event_id}_{channel}_{recipient}`). Repeated event delivery or duplicate provider webhooks are deduplicated.
3. **Bounded Retries with Backoff**: Transient errors (HTTP 502/504, timeouts) retry up to `maxRetries` (default 3). Permanent errors (bad phone, invalid template) immediately become `dead_letter`.
4. **Customer Consent Enforcement**: Marketing/CRM campaigns check active customer consents (`consents` table). If consent is missing or revoked, intent is marked `suppressed`.
5. **Zero Secret Leakage**: All payloads pass through `sanitizeNotificationPayload`. Passwords, tokens, API keys, PANs, and CVVs are automatically masked to `[REDACTED]`.
6. **Dual Schema Compatibility**: The delivery logger gracefully supports both unified schema (`event_id`, `idempotency_key`, `correlation_id`, `provider`) and legacy D1 columns.

---

## 4. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/notification-contract.test.ts` (10/10 PASS):
- `1. successful delivery: creates intent, dispatches to provider, records delivered state`: PASS
- `2. transient vs permanent failure: transient is retryable, permanent marks dead_letter`: PASS
- `3. duplicate event: stable idempotency key deduplicates identical dispatches`: PASS
- `4. retry/idempotency: bounded retries increment attempt count up to maxRetries`: PASS
- `5. provider timeout/outage: unhandled provider exception is caught safely without mutating business state`: PASS
- `6. invalid callback: rejects signature mismatch, deduplicates valid callbacks`: PASS
- `7. customer opt-out/preferences: suppresses marketing when consent is missing`: PASS
- `8. template/payload validation: masks secrets and rejects missing required fields`: PASS
- `9. delivery status and audit correlation: correlates event and correlation ID`: PASS
- `10. schema/migration compatibility: supports both canonical and legacy column binds`: PASS

---

## 5. Changed Files & Migration Status

- `packages/domain/notification/package.json`: Workspace registration for `@aura/domain-notification` (5 LOC).
- `packages/domain/notification/src/model/notification-types.ts`: Notification types and interfaces (79 LOC).
- `packages/domain/notification/src/policies/notification-eligibility-policy.ts`: Channel eligibility & secret sanitization (94 LOC).
- `packages/domain/notification/src/policies/notification-orchestration-policy.ts`: Canonical pipeline & retry policy (160 LOC).
- `packages/domain/notification/index.ts`: Public domain interface (8 LOC).
- `worker/db/migrations/20261009_02_notification_canonical_contract.sql`: Database schema migration for idempotency & correlation (10 LOC).
- `worker/src/__tests__/integrations/notification-contract.test.ts`: Integration test suite (161 LOC).
- `reports/core/cook/NOTIFICATION-CONTRACT.md`: Authoritative contract documentation.
- **Migration Requirements**: Run `worker/db/migrations/20261009_02_notification_canonical_contract.sql` against D1.
- **Blockers**: None.
