# Canonical Observability & Reliability Contract

## 1. Executive Summary

This document locks the canonical **Observability & Reliability Contract** across AURA OS (Cloudflare Workers, D1 Database, KV Cache, and Domain Commands). It establishes uniform telemetry invariants across Order → Payment → KDS → Notification workflows.

---

## 2. Invariant Rules & Guarantees

1. **Structured Log Schema**:
   - All server-side logs are formatted as uniform JSON with fields: `level`, `category`, `ts`, `trace`, `msg`, `context`.
   - Categories strictly partition events into: `business`, `application`, `infrastructure`, `audit`, and `security`.
2. **Distributed Tracing & Context Propagation**:
   - Inbound W3C `traceparent` headers (`00-{traceId}-{spanId}-{flags}`) are parsed, propagated through domain commands, and echoed on all API responses alongside `X-Correlation-ID` and `X-Request-ID`.
   - Cross-module async flows share the root `correlationId`.
3. **Error Classification**:
   - **Business Outcomes**: (HTTP 400/409/422, non-retryable) Validation errors, out of stock, voucher expired, table unavailable.
   - **Application Errors**: (HTTP 401/403/404, non-retryable) Auth required, token expired, forbidden, route missing.
   - **Infrastructure Failures**: (HTTP 500/503/504, retryable on timeout/network) D1 database unavailable, gateway timeout, runtime crash.
4. **Health Probe Segregation**:
   - **Liveness Probe** (`/api/health`): Sub-millisecond Worker runtime availability check returning HTTP 200 without touching database pools.
   - **Deep Readiness Probe** (`/api/health?ready=1`): Probes critical dependencies (D1) and non-critical caches (KV) with bounded timeouts (2000ms / 1500ms).
5. **Non-Interference Guarantee**:
   - Telemetry, logging, or metric recording failures (`recordSafeMetric`) never throw unhandled exceptions or abort active business transactions.
6. **Recursive Secret & PII Redaction**:
   - Fields matching `/^(signature|checksum|token|secret|password|authorization|api_key|apikey|payment_payload|customer_phone|customer_email|phone|email)$/i` or VN phone regex (`/^0\d{9}$/`) are scrubbed and replaced with `[REDACTED]`.
   - Deep inspection is capped at depth 4, arrays capped at 20 items.
7. **Low Cardinality Metrics**:
   - Metric labels only contain bounded categorical keys (`method`, `status_code`, `gateway`, `payment_method`). High-cardinality IDs are restricted to structured logs.

---

## 3. Log / Metric / Trace Schema

### Structured Log Entry Schema
```typescript
interface StructuredLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  category: 'business' | 'application' | 'infrastructure' | 'audit' | 'security';
  ts: string;
  trace: {
    traceId: string;
    spanId: string;
    parentId?: string | null;
    correlationId: string;
    sampled?: boolean;
  };
  emitter: string;
  msg: string;
  context?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    category: 'business' | 'application' | 'infrastructure';
    retryable: boolean;
    stack?: string;
  };
}
```

### Metric Record Schema
```typescript
interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string | number | boolean>;
  timestamp: string;
}
```

---

## 4. Health, SLO & Alert Matrix

| Component | Metric / Probe | SLO Target | Alert Threshold | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **Edge Worker** | Liveness Probe (`GET /api/health`) | 99.95% Availability | Fail rate > 0.1% over 5m | P1 Fatal |
| **D1 Database** | Readiness Probe (`d1_database`) | Latency < 150ms, 99.9% Success | Probe timeout > 2000ms | P1 Critical |
| **KV Cache** | Non-critical Probe (`kv_cache`) | Latency < 50ms, 99.5% Success | Degraded for > 15m | P3 Warning |
| **Order Pipeline** | Order Creation to Queued | p95 < 800ms, 99.9% Success | Error rate > 1.0% | P2 Urgent |
| **Payment Webhooks** | PayOS / Sepay Webhook Processing | p95 < 1200ms, 99.9% Success | Retry count > 3 | P2 Urgent |

---

## 5. Canonical Instrumentation Ownership

- **`@aura/domain-observability`**:
  - `model/observability-types.ts`: Single source of truth for telemetry interfaces.
  - `policies/observability-policy.ts`: W3C traceparent parsing, error classification, PII redaction, system health aggregator.
  - `adapters/canonical-observability-adapter.ts`: Isolated probes, safe metric recorder, structured logger.
- **`worker/src/middleware/correlation-id.ts`**:
  - Inbound header extraction and outbound propagation (`traceparent`, `X-Correlation-ID`, `X-Request-ID`).
- **`worker/src/middleware/error-handler.ts`**:
  - Boundary classification, Zod mapping, client masking of infrastructure stacks.
- **`worker/src/routes/health.ts`**:
  - Liveness vs readiness probe router.

---

## 6. Verification Results

All 9 contract invariants verified:
- `worker/src/__tests__/integrations/observability-reliability-contract.test.ts` (7/7 PASS)
- `worker/src/__tests__/integrations/observability-middleware-contract.test.ts` (4/4 PASS)
- Full repository test suite: **428 test files passed (3,866/3,866 tests PASS)**.
- Local CI verification: `typecheck:worker` (0 errors), `typecheck` (0 errors), `lint` (0 errors), `build` (OK).
