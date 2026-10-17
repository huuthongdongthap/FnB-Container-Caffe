/**
 * Observability & Reliability Canonical Policy
 * Implements error classification, W3C traceparent propagation,
 * recursive secret/PII redaction, and health status evaluation.
 */

import type {
  TraceContext,
  ErrorClassification,
  DependencyHealth,
  SystemHealthReport,
  HealthStatus
} from '../model/observability-types';

const REDACTED_KEYS = /^(password|token|secret|authorization|api_key|apikey|checksum|signature|credit_card|cvv|phone|email|customer_phone|customer_email)$/i;
const REDACTED = '[REDACTED]';

export function sanitizeTracePayload(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[DEPTH_LIMIT]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeTracePayload(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACTED_KEYS.test(k) ? REDACTED : sanitizeTracePayload(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') {
    if (/^0\d{9}$/.test(value)) return REDACTED; // VN phone pattern
    if (/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(value)) return REDACTED;
  }
  return value;
}

export function classifyError(err: unknown, defaultStatus = 500): ErrorClassification {
  const message = err instanceof Error ? err.message : String(err || 'Unknown error');
  const msgLower = message.toLowerCase();

  // 1. Business Outcomes (Domain Rejections)
  if (
    msgLower.includes('validation') ||
    msgLower.includes('out of stock') ||
    msgLower.includes('insufficient') ||
    msgLower.includes('table not available') ||
    msgLower.includes('voucher') ||
    msgLower.includes('invalid status') ||
    msgLower.includes('closed')
  ) {
    return {
      category: 'business',
      code: 'BUSINESS_RULE_VIOLATION',
      statusCode: 422,
      retryable: false,
      actionableMessage: message
    };
  }

  // 2. Application Errors (Auth / Client / Routing)
  if (
    msgLower.includes('unauthorized') ||
    msgLower.includes('forbidden') ||
    msgLower.includes('token expired') ||
    msgLower.includes('permission denied') ||
    msgLower.includes('not found')
  ) {
    const isAuth = msgLower.includes('unauthorized') || msgLower.includes('token');
    const isForbidden = msgLower.includes('forbidden') || msgLower.includes('permission');
    return {
      category: 'application',
      code: isAuth ? 'AUTH_REQUIRED' : isForbidden ? 'FORBIDDEN' : 'RESOURCE_NOT_FOUND',
      statusCode: isAuth ? 401 : isForbidden ? 403 : 404,
      retryable: false,
      actionableMessage: message
    };
  }

  // 3. Infrastructure Failures (DB / Network / 5xx)
  const isTimeout = msgLower.includes('timeout') || msgLower.includes('abort');
  const isNetwork = msgLower.includes('network') || msgLower.includes('fetch') || msgLower.includes('d1');
  return {
    category: 'infrastructure',
    code: isTimeout ? 'DEPENDENCY_TIMEOUT' : isNetwork ? 'DATABASE_NETWORK_ERROR' : 'INTERNAL_SERVER_ERROR',
    statusCode: isTimeout ? 504 : isNetwork ? 503 : defaultStatus,
    retryable: isTimeout || isNetwork,
    actionableMessage: 'An internal infrastructure error occurred. Action logged for investigation.'
  };
}

export function generateTraceContext(existing?: Partial<TraceContext>): TraceContext {
  const randomHex = (bytes: number) => {
    let result = '';
    for (let i = 0; i < bytes; i++) {
      result += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    }
    return result;
  };

  const traceId = existing?.traceId || randomHex(16);
  const spanId = existing?.spanId || randomHex(8);
  const correlationId = existing?.correlationId || `corr_${Date.now()}_${randomHex(4)}`;

  return {
    traceId,
    spanId,
    parentId: existing?.parentId || null,
    correlationId,
    sampled: existing?.sampled ?? true
  };
}

export function parseTraceparent(header?: string | null): { traceId: string; spanId: string; sampled: boolean } | null {
  if (!header || typeof header !== 'string') return null;
  const match = header.trim().match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    traceId: match[1].toLowerCase(),
    spanId: match[2].toLowerCase(),
    sampled: match[3] === '01'
  };
}

export function formatTraceparent(trace: TraceContext): string {
  const flags = trace.sampled !== false ? '01' : '00';
  return `00-${trace.traceId}-${trace.spanId}-${flags}`;
}

export function evaluateSystemHealth(
  dependencies: Record<string, DependencyHealth>,
  uptimeMs: number,
  version: string
): SystemHealthReport {
  let hasCriticalUnhealthy = false;
  let hasAnyDegraded = false;
  let hasAnyUnhealthy = false;

  for (const dep of Object.values(dependencies)) {
    if (dep.status === 'unhealthy') {
      hasAnyUnhealthy = true;
      if (dep.critical) hasCriticalUnhealthy = true;
    } else if (dep.status === 'degraded') {
      hasAnyDegraded = true;
    }
  }

  const overallStatus: HealthStatus = hasCriticalUnhealthy
    ? 'unhealthy'
    : hasAnyUnhealthy || hasAnyDegraded
    ? 'degraded'
    : 'healthy';

  return {
    status: overallStatus,
    version,
    uptimeMs,
    timestamp: new Date().toISOString(),
    liveness: true, // Worker is executing
    readiness: !hasCriticalUnhealthy,
    dependencies
  };
}
