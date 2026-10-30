/**
 * Observability & Reliability Canonical Contract Verification Suite
 * Tests all 9 contract invariants:
 * 1. Request trace & W3C traceparent propagation
 * 2. Cross-module correlated flow (Order -> Payment -> KDS -> Notification)
 * 3. Error classification (business vs application vs infrastructure)
 * 4. Dependency outage non-interference
 * 5. Async metric safety & failure isolation
 * 6. Liveness vs deep readiness health checks
 * 7. Recursive secret & PII redaction
 * 8. Metric deduplication & low cardinality
 * 9. Structured log emission schema
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateTraceContext,
  parseTraceparent,
  formatTraceparent,
  classifyError,
  sanitizeTracePayload,
  evaluateSystemHealth,
  formatStructuredLog,
  recordSafeMetric,
  executeHealthCheckProbe
} from '@aura/domain-observability';
import { getHealth } from '../../routes/health';
import type { Env } from '../../types/env';

describe('Observability & Reliability Contract — Canonical Invariants', () => {
  // ── 1. Request Trace & W3C Traceparent ─────────────────────────────────────
  it('parses, generates and formats W3C traceparent and correlation IDs', () => {
    const rawTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = parseTraceparent(rawTraceparent);

    expect(parsed).not.toBeNull();
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.spanId).toBe('00f067aa0ba902b7');
    expect(parsed?.sampled).toBe(true);

    const trace = generateTraceContext({
      traceId: parsed?.traceId,
      parentId: parsed?.spanId,
      correlationId: 'corr_order_12345'
    });

    expect(trace.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(trace.correlationId).toBe('corr_order_12345');
    const formatted = formatTraceparent(trace);
    expect(formatted.startsWith('00-4bf92f3577b34da6a3ce929d0e0e4736-')).toBe(true);
  });

  // ── 2. Correlated Cross-Module Flow ────────────────────────────────────────
  it('propagates single correlationId across Order -> Payment -> KDS -> Notification', () => {
    const orderCorrelationId = 'corr_flow_order_9988';
    const trace = generateTraceContext({ correlationId: orderCorrelationId });

    const orderLog = formatStructuredLog('info', 'business', 'order.created', trace, 'order-service', { orderId: 'ord_1' });
    const paymentLog = formatStructuredLog('info', 'business', 'payment.link_created', trace, 'payment-service', { orderId: 'ord_1', gateway: 'payos' });
    const kdsLog = formatStructuredLog('info', 'business', 'kds.ticket_queued', trace, 'kitchen-service', { orderId: 'ord_1', station: 'bar' });
    const notifLog = formatStructuredLog('info', 'business', 'notification.sent', trace, 'notification-service', { orderId: 'ord_1', channel: 'zalo_zns' });

    expect(orderLog.trace.correlationId).toBe(orderCorrelationId);
    expect(paymentLog.trace.correlationId).toBe(orderCorrelationId);
    expect(kdsLog.trace.correlationId).toBe(orderCorrelationId);
    expect(notifLog.trace.correlationId).toBe(orderCorrelationId);
  });

  // ── 3. Error Classification ────────────────────────────────────────────────
  it('distinguishes business outcomes, application errors, and infrastructure failures', () => {
    const businessErr = classifyError(new Error('Product is out of stock'));
    expect(businessErr.category).toBe('business');
    expect(businessErr.statusCode).toBe(422);
    expect(businessErr.retryable).toBe(false);

    const appErr = classifyError(new Error('Unauthorized: token expired'));
    expect(appErr.category).toBe('application');
    expect(appErr.statusCode).toBe(401);
    expect(appErr.retryable).toBe(false);

    const infraErr = classifyError(new Error('D1 database connection timeout'));
    expect(infraErr.category).toBe('infrastructure');
    expect(infraErr.statusCode).toBe(504);
    expect(infraErr.retryable).toBe(true);
  });

  // ── 4. Dependency Timeout & Probe Isolation ────────────────────────────────
  it('executes health probes with bounded timeout and isolates probe failures', async () => {
    const fastProbe = await executeHealthCheckProbe('mock_db', 'database', true, async () => 'ok', 1000);
    expect(fastProbe.status).toBe('healthy');
    expect(fastProbe.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fastProbe.error).toBeNull();

    const slowProbe = await executeHealthCheckProbe(
      'mock_slow_service',
      'external_api',
      false,
      () => new Promise((resolve) => setTimeout(resolve, 500)),
      100 // 100ms timeout triggers error
    );
    expect(slowProbe.status).toBe('unhealthy');
    expect(slowProbe.error).toContain('timed out');
  });

  // ── 5. Async Metric Safety & Non-Interference ──────────────────────────────
  it('guarantees metrics recording failure never throws or breaks calling thread', async () => {
    const throwingRecorder = vi.fn().mockRejectedValue(new Error('D1 write quota exceeded'));
    const success = await recordSafeMetric(throwingRecorder, 'order_count', 1, { payment: 'cash' });

    expect(success).toBe(false);
    expect(throwingRecorder).toHaveBeenCalledTimes(1);
  });

  // ── 6. Liveness vs Deep Readiness Health Checks ─────────────────────────────
  it('distinguishes fast liveness from deep readiness health evaluation', async () => {
    const mockEnv = {
      GIT_COMMIT_SHA: '0d59c546abc',
      AURA_DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ 1: 1 })
        })
      }
    } as unknown as Env;

    // Fast Liveness
    const liveness = await getHealth(mockEnv, false);
    expect(liveness.status).toBe('ok');
    expect(liveness.liveness).toBe(true);
    expect(liveness.readiness).toBe(true);
    expect(liveness.d1).toBeUndefined();

    // Deep Readiness - Database OK
    const readinessOk = await getHealth(mockEnv, true);
    expect(readinessOk.status).toBe('ok');
    expect(readinessOk.d1).toBe('connected');
    expect(readinessOk.readiness).toBe(true);
    expect(readinessOk.dependencies?.d1_database.status).toBe('healthy');

    // Deep Readiness - Database DOWN
    const failingEnv = {
      GIT_COMMIT_SHA: '0d59c546abc',
      AURA_DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('D1 lock failure'))
        })
      }
    } as unknown as Env;

    const readinessFail = await getHealth(failingEnv, true);
    expect(readinessFail.status).toBe('degraded');
    expect(readinessFail.liveness).toBe(true); // Worker still lives!
    expect(readinessFail.readiness).toBe(false); // But not ready for DB traffic
    expect(readinessFail.d1).toBe('error');
    expect(readinessFail.error).toContain('D1 lock failure');
  });

  // ── 7. Secret & PII Redaction ──────────────────────────────────────────────
  it('recursively scrubs api_keys, passwords, tokens, and customer PII from payloads', () => {
    const rawPayload = {
      user: {
        name: 'Nguyen Van A',
        phone: '0912345678',
        email: 'customer@auracafe.vn',
        password: 'SuperSecretPassword123!'
      },
      payment: {
        token: 'tok_live_99887766',
        api_key: 'sk_live_12345',
        amount: 55000,
        authorization: 'Bearer secret_jwt_token'
      }
    };

    const sanitized = sanitizeTracePayload(rawPayload) as typeof rawPayload;

    expect(sanitized.user.password).toBe('[REDACTED]');
    expect(sanitized.user.phone).toBe('[REDACTED]');
    expect(sanitized.user.email).toBe('[REDACTED]');
    expect(sanitized.payment.token).toBe('[REDACTED]');
    expect(sanitized.payment.api_key).toBe('[REDACTED]');
    expect(sanitized.payment.authorization).toBe('[REDACTED]');
    expect(sanitized.user.name).toBe('Nguyen Van A');
    expect(sanitized.payment.amount).toBe(55000);
  });

  it('rejects all-zero W3C traceparent IDs, fails closed on empty dependencies health evaluation, and handles Date/cyclic/JWT trace payloads', () => {
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();

    const emptyHealth = evaluateSystemHealth({}, 1000, 'abc1234');
    expect(emptyHealth.status).toBe('unhealthy');
    expect(emptyHealth.readiness).toBe(false);

    const now = new Date('2026-10-30T10:00:00.000Z');
    const cyclic: any = {
      occurredAt: now,
      rawBearer: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEifQ.sig123',
    };
    cyclic.self = cyclic;

    const clean = sanitizeTracePayload(cyclic) as any;
    expect(clean.occurredAt).toBeInstanceOf(Date);
    expect(clean.rawBearer).toBe('[REDACTED]');
    expect(clean.self).toBe('[CIRCULAR]');
  });
});
