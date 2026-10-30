/**
 * Canonical Smoke Test Adapter
 * Executes isolated HTTP probes against critical AURA workflows.
 */

import type { SmokeTestProbeResult, VersionParityResult } from '../model/deployment-types';

export interface ProbeDefinition {
  workflow: string;
  path: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  critical: boolean;
}

export interface SmokeProbeOptions {
  expectedSha?: string;
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

function shaMatches(actualFull: string, actualShort: string, expectedSha: string): boolean {
  const expected = expectedSha.trim().toLowerCase();
  const full = actualFull.trim().toLowerCase();
  const short = actualShort.trim().toLowerCase();
  if (!expected || !short || short === 'unknown' || full === 'unknown') return false;
  return (
    full.startsWith(expected) ||
    expected.startsWith(full) ||
    expected.startsWith(short) ||
    short.startsWith(expected)
  );
}

async function readResponsePayload(res: Response): Promise<{ hasBodyReader: boolean; rawText?: string; json?: Record<string, unknown> }> {
  if (typeof res.text === 'function') {
    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (!trimmed || trimmed.startsWith('<')) {
      return { hasBodyReader: true, rawText };
    }
    try {
      const parsed = JSON.parse(trimmed);
      return {
        hasBodyReader: true,
        rawText,
        json: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined,
      };
    } catch {
      return { hasBodyReader: true, rawText };
    }
  }
  if (typeof res.json === 'function') {
    try {
      const parsed = await res.json();
      return {
        hasBodyReader: true,
        json: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined,
      };
    } catch {
      return { hasBodyReader: true };
    }
  }
  return { hasBodyReader: false };
}

export async function executeSmokeProbe(
  baseUrl: string,
  probe: ProbeDefinition,
  fetchFn: typeof fetch = fetch,
  options: SmokeProbeOptions = {}
): Promise<SmokeTestProbeResult> {
  const start = Date.now();
  const url = `${baseUrl.replace(/\/$/, '')}${probe.path}`;

  try {
    const res = await fetchFn(url, {
      method: probe.method,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });

    const latencyMs = Date.now() - start;
    if (res.status !== probe.expectedStatus) {
      return {
        workflow: probe.workflow,
        endpoint: probe.path,
        method: probe.method,
        status: 'failed',
        httpCode: res.status,
        latencyMs,
        expectedStatus: probe.expectedStatus,
        error: `Expected HTTP ${probe.expectedStatus}, got ${res.status}`
      };
    }

    const isJsonEndpoint = probe.path.startsWith('/api/') || probe.path.endsWith('.json');
    const isVersionEndpoint = probe.path === '/api/version' || probe.path === '/version.json';
    const payload = await readResponsePayload(res);

    if (isVersionEndpoint && options.expectedSha && !payload.hasBodyReader) {
      return {
        workflow: probe.workflow,
        endpoint: probe.path,
        method: probe.method,
        status: 'failed',
        httpCode: res.status,
        latencyMs,
        expectedStatus: probe.expectedStatus,
        error: `Cannot verify expectedSha on ${probe.path}: response body unavailable`
      };
    }

    if (isJsonEndpoint && payload.hasBodyReader) {
      if (!payload.json) {
        return {
          workflow: probe.workflow,
          endpoint: probe.path,
          method: probe.method,
          status: 'failed',
          httpCode: res.status,
          latencyMs,
          expectedStatus: probe.expectedStatus,
          error: `Expected JSON payload on ${probe.path}, received non-JSON or HTML fallback`
        };
      }

      if (probe.path.startsWith('/api/health')) {
        const healthStatus = String(payload.json.status ?? '');
        const readiness = payload.json.readiness;
        if (healthStatus === 'unhealthy' || (probe.path.includes('ready=1') && readiness === false)) {
          return {
            workflow: probe.workflow,
            endpoint: probe.path,
            method: probe.method,
            status: 'failed',
            httpCode: res.status,
            latencyMs,
            expectedStatus: probe.expectedStatus,
            error: `Health endpoint reported ${healthStatus || 'unready'} state`
          };
        }
        if (healthStatus === 'degraded') {
          return {
            workflow: probe.workflow,
            endpoint: probe.path,
            method: probe.method,
            status: 'degraded',
            httpCode: res.status,
            latencyMs,
            expectedStatus: probe.expectedStatus,
            error: 'Health endpoint reported degraded state'
          };
        }
        if (healthStatus !== 'ok' && healthStatus !== 'healthy') {
          return {
            workflow: probe.workflow,
            endpoint: probe.path,
            method: probe.method,
            status: 'failed',
            httpCode: res.status,
            latencyMs,
            expectedStatus: probe.expectedStatus,
            error: `Unexpected health status "${healthStatus}"`
          };
        }
      }

      if (isVersionEndpoint) {
        const fullSha = String(payload.json.fullSha ?? payload.json.sha ?? payload.json.shortSha ?? '').trim();
        const shortSha = String(payload.json.shortSha ?? fullSha.slice(0, 8)).trim();
        if (!shortSha || shortSha === 'unknown' || fullSha === 'unknown') {
          return {
            workflow: probe.workflow,
            endpoint: probe.path,
            method: probe.method,
            status: 'failed',
            httpCode: res.status,
            latencyMs,
            expectedStatus: probe.expectedStatus,
            error: `Version endpoint ${probe.path} reported unknown or empty SHA`
          };
        }
        if (options.expectedSha && !shaMatches(fullSha, shortSha, options.expectedSha)) {
          return {
            workflow: probe.workflow,
            endpoint: probe.path,
            method: probe.method,
            status: 'failed',
            httpCode: res.status,
            latencyMs,
            expectedStatus: probe.expectedStatus,
            error: `SHA mismatch on ${probe.path}: expected ${options.expectedSha}, got ${shortSha}`
          };
        }
      }
    }

    return {
      workflow: probe.workflow,
      endpoint: probe.path,
      method: probe.method,
      status: 'passed',
      httpCode: res.status,
      latencyMs,
      expectedStatus: probe.expectedStatus
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
  fetchFn: typeof fetch = fetch,
  options: SmokeProbeOptions = {}
): Promise<SmokeTestProbeResult[]> {
  const results: SmokeTestProbeResult[] = [];
  for (const probe of probes) {
    const res = await executeSmokeProbe(baseUrl, probe, fetchFn, options);
    results.push(res);
  }
  return results;
}

export async function verifyDeploymentVersionParity(
  baseUrl: string,
  expectedSha?: string,
  fetchFn: typeof fetch = fetch
): Promise<VersionParityResult> {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  try {
    const [pagesRes, workerRes] = await Promise.all([
      fetchFn(`${normalizedBase}/version.json`, { method: 'GET', headers: { Accept: 'application/json' } }),
      fetchFn(`${normalizedBase}/api/version`, { method: 'GET', headers: { Accept: 'application/json' } }),
    ]);

    if (pagesRes.status !== 200 || workerRes.status !== 200) {
      return {
        matches: false,
        pagesSha: null,
        workerSha: null,
        expectedSha,
        error: `HTTP status mismatch: /version.json=${pagesRes.status}, /api/version=${workerRes.status}`,
      };
    }

    const [pagesPayload, workerPayload] = await Promise.all([
      readResponsePayload(pagesRes),
      readResponsePayload(workerRes),
    ]);

    if (!pagesPayload.json || !workerPayload.json) {
      return {
        matches: false,
        pagesSha: null,
        workerSha: null,
        expectedSha,
        error: 'One or both version endpoints returned non-JSON content',
      };
    }

    const pagesFull = String(pagesPayload.json.sha ?? pagesPayload.json.shortSha ?? '').trim();
    const pagesShort = String(pagesPayload.json.shortSha ?? pagesFull.slice(0, 8)).trim();
    const workerFull = String(workerPayload.json.fullSha ?? workerPayload.json.sha ?? workerPayload.json.shortSha ?? '').trim();
    const workerShort = String(workerPayload.json.shortSha ?? workerFull.slice(0, 8)).trim();

    if (!pagesShort || pagesShort === 'unknown' || !workerShort || workerShort === 'unknown') {
      return {
        matches: false,
        pagesSha: pagesShort || null,
        workerSha: workerShort || null,
        expectedSha,
        error: `Unknown SHA reported (pages=${pagesShort || 'empty'}, worker=${workerShort || 'empty'})`,
      };
    }

    if (!shaMatches(pagesFull || pagesShort, pagesShort, workerFull || workerShort)) {
      return {
        matches: false,
        pagesSha: pagesShort,
        workerSha: workerShort,
        expectedSha,
        error: `Pages/Worker SHA drift detected: pages=${pagesShort}, worker=${workerShort}`,
      };
    }

    if (expectedSha && (!shaMatches(pagesFull || pagesShort, pagesShort, expectedSha) || !shaMatches(workerFull || workerShort, workerShort, expectedSha))) {
      return {
        matches: false,
        pagesSha: pagesShort,
        workerSha: workerShort,
        expectedSha,
        error: `Deployed SHA (${pagesShort}) does not match expected SHA (${expectedSha})`,
      };
    }

    return {
      matches: true,
      pagesSha: pagesShort,
      workerSha: workerShort,
      expectedSha,
    };
  } catch (err) {
    return {
      matches: false,
      pagesSha: null,
      workerSha: null,
      expectedSha,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
