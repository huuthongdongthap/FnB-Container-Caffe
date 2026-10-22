/**
 * Canonical Health Route — /api/health
 * Distinguishes liveness from deep dependency readiness in Cloudflare Workers.
 */

import type { Env } from '../types/env';
import {
  executeHealthCheckProbe,
  evaluateSystemHealth,
  type DependencyHealth,
  type HealthStatus
} from '@aura/domain-observability';

const START_TIME = Date.now();

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number; // milliseconds since cold-start
  version?: string;
  liveness: boolean;
  readiness: boolean;
  d1?: 'connected' | 'error';
  error?: string;
  dependencies?: Record<string, DependencyHealth>;
}

export async function getHealth(env: Env, checkDependencies = false): Promise<HealthResponse> {
  const uptime = Date.now() - START_TIME;
  const version = env.GIT_COMMIT_SHA?.slice(0, 8) || 'unknown';

  // Fast Liveness Probe
  if (!checkDependencies) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      version,
      liveness: true,
      readiness: true
    };
  }

  // Deep Readiness Probe
  const dependencies: Record<string, DependencyHealth> = {};

  // Probe D1 Database
  const d1Probe = await executeHealthCheckProbe(
    'd1_database',
    'database',
    true, // Critical dependency
    async () => {
      if (!env.AURA_DB) throw new Error('AURA_DB binding not configured');
      await env.AURA_DB.prepare('SELECT 1').first();
    },
    2000
  );
  dependencies.d1_database = d1Probe;

  // Probe KV Cache (if bound)
  const kvCache = env.KV_CACHE;
  if (kvCache) {
    const kvProbe = await executeHealthCheckProbe(
      'kv_cache',
      'cache',
      false, // Non-critical
      async () => {
        await kvCache.get('__health_probe__');
      },
      1500
    );
    dependencies.kv_cache = kvProbe;
  }

  const evaluation = evaluateSystemHealth(dependencies, uptime, version);

  const mappedStatus: HealthStatus = evaluation.status;
  const legacyStatus = d1Probe.status === 'unhealthy' ? 'degraded' : (mappedStatus === 'healthy' ? 'ok' : mappedStatus);

  const isProd = env.ENVIRONMENT === 'production';
  const exposedError = isProd
    ? (d1Probe.error ? 'Database connectivity probe failed' : undefined)
    : (d1Probe.error || undefined);

  let sanitizedDeps = dependencies;
  if (isProd && dependencies) {
    sanitizedDeps = {};
    for (const [key, dep] of Object.entries(dependencies)) {
      sanitizedDeps[key] = {
        ...dep,
        error: dep.error ? `${dep.name} connectivity probe failed` : undefined,
      };
    }
  }

  return {
    status: legacyStatus,
    timestamp: evaluation.timestamp,
    uptime,
    version,
    liveness: evaluation.liveness,
    readiness: evaluation.readiness,
    d1: d1Probe.status === 'healthy' ? 'connected' : 'error',
    error: exposedError,
    dependencies: sanitizedDeps
  };
}
