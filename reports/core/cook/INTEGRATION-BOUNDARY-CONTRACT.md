# Integration Boundary Contract

**Status**: LOCKED & AUTHORITATIVE  
**Date**: 2026-10-09  
**Scope**: Canonical External Integration Boundary across ERPNext, PayOS, Zalo ZNS, SpeedSMS, Resend, Web Push, and Analytics.

---

## 1. Canonical Boundary Flow

```
AURA DOMAIN (Canonical Authority)
   │
   ▼
APPLICATION PORT (Typed Contract Interface)
   │
   ▼
INTEGRATION ADAPTER (Canonical Boundary Wrapper)
   ├── 1. Bounded Timeout & AbortSignal (default 5000ms)
   ├── 2. Secret Redaction (Masks API keys, tokens, credentials)
   ├── 3. Error Classification (Transient vs Permanent vs Auth vs RateLimit)
   └── 4. Non-Interference Guarantee (External failures never abort internal transactions)
   ▼
EXTERNAL PROVIDER (ERPNext / PayOS / Zalo / Resend / SpeedSMS)
   ▼
NORMALIZED RESULT (NormalizedIntegrationResult)
   ├── Status: success | pending | rejected | failed | timeout
   ├── Retryable Flag: true for 5xx/network; false for 4xx/auth
   └── Reconciliation Flag: triggers reconciliation if external desync detected
```

---

## 2. Port / Adapter Ownership Map

| Integration | Application Port | Boundary Adapter | Canonical Authority | Target Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **ERPNext** | `ErpnextAccountingPort` | `executeExternalIntegration('erpnext')` | **AURA** | Downstream accounting ledger, GL journal entries, supplier sync |
| **PayOS** | `PaymentGatewayPort` | `executeExternalIntegration('payos')` | **AURA** | External QR payment checkout links, webhook checksum validation |
| **Zalo ZNS** | `CustomerNotificationPort` | `executeExternalIntegration('zalo_zns')` | **AURA** | Transactional order status & pickup alerts via Zalo OTT |
| **SpeedSMS** | `SmsNotificationPort` | `executeExternalIntegration('speedsms')` | **AURA** | OTP delivery, table reservation confirmation SMS |
| **Resend** | `EmailDeliveryPort` | `executeExternalIntegration('resend')` | **AURA** | E-receipts, marketing newsletters (consent-gated) |
| **Web Push** | `PushNotificationPort` | `executeExternalIntegration('web_push')` | **AURA** | Real-time device order status updates via VAPID |

---

## 3. Provider Failure & Retry Matrix

| Provider | Error Condition | Classified Type | Retry Policy | Reconciliation Action |
| :--- | :--- | :--- | :--- | :--- |
| **ERPNext** | HTTP 502/504 / Connection Timeout | `transient` | Retry with exponential backoff (max 3) | Mark `pending` in `integration_sync_logs`; retry via cron |
| **ERPNext** | Invalid Item Code / 400 Bad Request | `malformed_payload` | No retry (`retryable: false`) | Log discrepancy in `integration_sync_logs` for admin review |
| **PayOS** | Webhook Checksum Mismatch | `signature_mismatch` | Fail closed (HTTP 401); reject | Do not update payment status; alert security telemetry |
| **PayOS** | Duplicate Webhook Callback | `duplicate` | Idempotent acknowledgment (HTTP 200) | No duplicate state mutation; record callback deduplication |
| **Resend / SMS** | Provider API Outage / Network Crash | `transient` | Async background retry via `waitUntil` | Never abort user checkout or order completion |
| **All** | Expired API Key / 401 Unauthorized | `auth_failure` | No retry; alert ops immediately | Flag integration offline; notify admin |

---

## 4. Verification Suite

All contract invariants verified in `worker/src/__tests__/integrations/integration-boundary-contract.test.ts` (10/10 PASS):
- `1. provider success: maps raw status to canonical success and returns sanitized payload`: PASS
- `2. timeout/unavailable provider: bounded timeout returns timeout status and retryable flag`: PASS
- `3. transient vs permanent error: classifies 502 as transient and 401 as auth_failure`: PASS
- `4. retry/idempotency: deduplicates repeated webhook events using idempotency keys`: PASS
- `5. duplicate/invalid webhook: rejects invalid signature and duplicate deliveries`: PASS
- `6. malformed external payload: rejects non-object or empty webhook payloads`: PASS
- `7. ID/status mapping: maps ERPNext, PayOS, and Resend statuses to canonical model`: PASS
- `8. partial sync and reconciliation: flags discrepancy when external total or status mismatches`: PASS
- `9. secret redaction: masks API keys, secrets, tokens, and credentials from logs`: PASS
- `10. internal transaction integrity: external integration failure does not break internal state`: PASS

---

## 5. Changed Files & Migration Status

- `packages/domain/integration/package.json`: Workspace registration for `@aura/domain-integration` (5 LOC).
- `packages/domain/integration/src/model/integration-types.ts`: Ports, adapters, and normalized types (65 LOC).
- `packages/domain/integration/src/policies/integration-boundary-policy.ts`: Normalization, error classification, webhook security, and reconciliation (152 LOC).
- `packages/domain/integration/src/adapters/canonical-integration-adapter.ts`: Canonical boundary wrapper (62 LOC).
- `packages/domain/integration/index.ts`: Public domain interface (8 LOC).
- `worker/db/migrations/20261009_03_integration_boundary_contract.sql`: Database migration for `integration_sync_logs` (18 LOC).
- `worker/src/__tests__/integrations/integration-boundary-contract.test.ts`: Integration test suite (121 LOC).
- `reports/core/cook/INTEGRATION-BOUNDARY-CONTRACT.md`: Authoritative contract documentation.
- `tsconfig.json`, `worker/tsconfig.json`, `vite.config.js`, `vitest.config.ts`: Workspace aliases for `@aura/domain-integration`.
- **Migration Requirements**: Run `worker/db/migrations/20261009_03_integration_boundary_contract.sql` against D1.
- **Blockers**: None.
