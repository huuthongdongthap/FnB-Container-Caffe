/**
 * Health Route -- /api/health
 * Returns worker status, uptime, and optional D1 connectivity check.
 */

import type { Env } from '../types/env';

// Capture cold-start time once at module load
const START_TIME = Date.now();

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number; // milliseconds since cold-start
  d1?: 'connected' | 'error';
  error?: string;
}

export async function getHealth(env: Env, checkDb = false): Promise<HealthResponse> {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - START_TIME
  };

  if (checkDb) {
    try {
      await env.AURA_DB.prepare('SELECT 1').first();
      response.d1 = 'connected';
    } catch (err) {
      response.d1 = 'error';
      response.error = (err as Error).message;
      response.status = 'degraded';
    }
  }

  return response;
}
