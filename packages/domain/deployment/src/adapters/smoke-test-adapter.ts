/**
 * Canonical Smoke Test Adapter
 * Executes isolated HTTP probes against critical AURA workflows.
 */

import type { SmokeTestProbeResult } from '../model/deployment-types';

export interface ProbeDefinition {
  workflow: string;
  path: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  critical: boolean;
}

export const CANONICAL_SMOKE_PROBES: ProbeDefinition[] = [
  { workflow: 'System Liveness', path: '/api/health', method: 'GET', expectedStatus: 200, critical: true },
  { workflow: 'System Deep Readiness', path: '/api/health?ready=1', method: 'GET', expectedStatus: 200, critical: true },
  { workflow: 'Worker Version SHA', path: '/api/version', method: 'GET', expectedStatus: 200, critical: true },
  { workflow: 'Catalog Products', path: '/api/products', method: 'GET', expectedStatus: 200, critical: true },
  { workflow: 'Cafe Tables', path: '/api/tables', method: 'GET', expectedStatus: 200, critical: true },
  { workflow: 'SaaS Pricing', path: '/api/saas/pricing', method: 'GET', expectedStatus: 200, critical: false },
  { workflow: 'Frontend Version Manifest', path: '/version.json', method: 'GET', expectedStatus: 200, critical: true }
];

export async function executeSmokeProbe(
  baseUrl: string,
  probe: ProbeDefinition,
  fetchFn: typeof fetch = fetch
): Promise<SmokeTestProbeResult> {
  const start = Date.now();
  const url = `${baseUrl.replace(/\/$/, '')}${probe.path}`;

  try {
    const res = await fetchFn(url, {
      method: probe.method,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });

    const latencyMs = Date.now() - start;
    const isSuccess = res.status === probe.expectedStatus;

    return {
      workflow: probe.workflow,
      endpoint: probe.path,
      method: probe.method,
      status: isSuccess ? 'passed' : 'failed',
      httpCode: res.status,
      latencyMs,
      expectedStatus: probe.expectedStatus,
      error: isSuccess ? undefined : `Expected HTTP ${probe.expectedStatus}, got ${res.status}`
    };
  } catch (err) {
    return {
      workflow: probe.workflow,
      endpoint: probe.path,
      method: probe.method,
      status: 'failed',
      httpCode: 0,
      latencyMs: Date.now() - start,
      expectedStatus: probe.expectedStatus,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function runCanonicalSmokeSuite(
  baseUrl: string,
  probes = CANONICAL_SMOKE_PROBES,
  fetchFn: typeof fetch = fetch
): Promise<SmokeTestProbeResult[]> {
  const results: SmokeTestProbeResult[] = [];
  for (const probe of probes) {
    const res = await executeSmokeProbe(baseUrl, probe, fetchFn);
    results.push(res);
  }
  return results;
}
