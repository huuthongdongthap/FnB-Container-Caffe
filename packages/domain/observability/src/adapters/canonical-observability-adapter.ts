/**
 * Canonical Observability Adapter
 * Structured logger formatting, non-interfering metric recording,
 * and isolated health check probes.
 */

import type {
  LogLevel,
  LogCategory,
  TraceContext,
  StructuredLogEntry,
  DependencyType,
  DependencyHealth
} from '../model/observability-types';
import { sanitizeTracePayload, classifyError } from '../policies/observability-policy';

export function formatStructuredLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  trace: TraceContext,
  service = 'aura-edge-worker',
  extra?: Record<string, unknown>,
  err?: unknown
): StructuredLogEntry {
  const sanitizedContext = extra ? (sanitizeTracePayload(extra) as Record<string, unknown>) : undefined;

  let errorInfo: StructuredLogEntry['error'] = undefined;
  if (err) {
    const classified = classifyError(err);
    const errorObj = err instanceof Error ? err : new Error(String(err));
    errorInfo = {
      name: errorObj.name || 'Error',
      message: errorObj.message,
      code: classified.code,
      category: classified.category,
      stack: errorObj.stack
    };
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    trace,
    service,
    context: sanitizedContext,
    error: errorInfo
  };
}

export async function recordSafeMetric(
  recorderFn: (metricName: string, value: number, tags: Record<string, string | number | boolean>) => Promise<unknown> | unknown,
  metricName: string,
  value = 1,
  tags: Record<string, string | number | boolean> = {}
): Promise<boolean> {
  try {
    const sanitizedTags = (sanitizeTracePayload(tags) as Record<string, string | number | boolean>) || {};
    await Promise.resolve(recorderFn(metricName, value, sanitizedTags));
    return true;
  } catch (_err) {
    // Non-interference invariant: Metrics recording must never throw or break core logic
    return false;
  }
}

export async function executeHealthCheckProbe(
  name: string,
  type: DependencyType,
  critical: boolean,
  probeFn: () => Promise<unknown>,
  timeoutMs = 3000
): Promise<DependencyHealth> {
  const start = Date.now();
  const now = new Date().toISOString();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Health probe for ${name} timed out after ${timeoutMs}ms`)), timeoutMs)
    );
    await Promise.race([probeFn(), timeoutPromise]);
    const latencyMs = Date.now() - start;

    return {
      name,
      type,
      status: latencyMs > 2000 ? 'degraded' : 'healthy',
      critical,
      latencyMs,
      error: null,
      lastCheckedAt: now
    };
  } catch (err: any) {
    return {
      name,
      type,
      status: 'unhealthy',
      critical,
      latencyMs: Date.now() - start,
      error: err?.message || 'Health probe failed',
      lastCheckedAt: now
    };
  }
}
