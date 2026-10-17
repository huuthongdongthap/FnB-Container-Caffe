/**
 * Observability & Reliability Canonical Types
 * Strict boundary models for structured logging, distributed tracing,
 * metrics collection, error classification, and health assessment.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogCategory = 'business' | 'application' | 'infrastructure' | 'audit' | 'security';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentId?: string | null;
  correlationId: string;
  sampled?: boolean;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  trace: TraceContext;
  service: string;
  environment?: string;
  tenantId?: string | null;
  operatingUnitId?: string | null;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    code?: string;
    category?: LogCategory;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricRecord {
  name: string;
  type: MetricType;
  value: number;
  unit?: string;
  tags: Record<string, string | number | boolean>;
  timestamp: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type DependencyType = 'database' | 'cache' | 'external_api' | 'queue' | 'runtime';

export interface DependencyHealth {
  name: string;
  type: DependencyType;
  status: HealthStatus;
  critical: boolean;
  latencyMs: number;
  error?: string | null;
  lastCheckedAt: string;
}

export interface SystemHealthReport {
  status: HealthStatus;
  version: string;
  uptimeMs: number;
  timestamp: string;
  liveness: boolean;
  readiness: boolean;
  dependencies: Record<string, DependencyHealth>;
}

export interface ErrorClassification {
  category: 'business' | 'application' | 'infrastructure';
  code: string;
  statusCode: number;
  retryable: boolean;
  actionableMessage: string;
}

export interface SloTarget {
  name: string;
  targetPercent: number; // e.g. 99.9
  window: string; // e.g. '30d' or '24h'
  metric: string;
  thresholdMs?: number;
}
