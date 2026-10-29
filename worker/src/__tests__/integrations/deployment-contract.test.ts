/**
 * Canonical Environment & Deployment Contract Verification Suite
 * Tests all core invariants:
 * 1. Environment isolation & taxonomy
 * 2. Accidental production protection & authorization gate
 * 3. Release gate failure handling
 * 4. Migration ordering & naming validation
 * 5. Down-migration & rollback readiness
 * 6. Smoke probe execution & SLO evaluation
 * 7. Secret exclusion from deployment manifest
 */

import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENVIRONMENTS,
  REQUIRED_STAGING_CREDENTIALS,
  evaluateReleaseGates,
  validateMigrationSequence,
  validateStagingCredentials,
  evaluateSmokeTests,
  executeSmokeProbe,
  CANONICAL_SMOKE_PROBES
} from '@aura/domain-deployment';
import type { ReleaseGateCheck, SmokeTestProbeResult } from '@aura/domain-deployment';

describe('Environment & Deployment Contract — Canonical Invariants', () => {
  // ── 1. Environment Isolation ───────────────────────────────────────────────
  it('strictly isolates environments with explicit endpoints and flags', () => {
    expect(ENVIRONMENTS.local.isProduction).toBe(false);
    expect(ENVIRONMENTS.staging.isProduction).toBe(false);
    expect(ENVIRONMENTS.production.isProduction).toBe(true);

    expect(ENVIRONMENTS.production.frontendUrl).toBe('https://auraspace.cafe');
    expect(ENVIRONMENTS.production.workerUrl).toContain('workers.dev');
    expect(ENVIRONMENTS.production.databaseId).toBe('97ae7a5f-fc4d-460d-b019-8535332bd81f');
    expect(ENVIRONMENTS.production.kvNamespaceId).toBe('789e7cf1894e4d4c9e8f8cd51b2dbe16');
  });

  // ── 2. Accidental Production Target Prevention ────────────────────────────
  it('blocks unauthenticated / accidental production deployment', () => {
    const passingChecks: ReleaseGateCheck[] = [
      { id: '1', name: 'Tests', category: 'test', passed: true, durationMs: 1200 },
      { id: '2', name: 'Typecheck', category: 'typecheck', passed: true, durationMs: 800 },
      { id: '3', name: 'Lint', category: 'lint', passed: true, durationMs: 400 },
      { id: '4', name: 'Build', category: 'build', passed: true, durationMs: 2500 }
    ];

    // Attempting production deploy without explicit auth flag -> BLOCKED
    const unauthProduction = evaluateReleaseGates('production', 'abc1234', passingChecks, false);
    expect(unauthProduction.allowed).toBe(false);
    expect(unauthProduction.blockingFailure).toContain('explicit authorization');

    // Staging does not block
    const stagingDeploy = evaluateReleaseGates('staging', 'abc1234', passingChecks, false);
    expect(stagingDeploy.allowed).toBe(true);

    // Authorized production deploy -> ALLOWED
    const authProduction = evaluateReleaseGates('production', 'abc1234', passingChecks, true);
    expect(authProduction.allowed).toBe(true);
  });

  // ── 3. Release Gate Failure Handling ──────────────────────────────────────
  it('halts deployment if any release gate fails', () => {
    const checksWithFailedTest: ReleaseGateCheck[] = [
      { id: '1', name: 'Unit Tests', category: 'test', passed: false, durationMs: 1200 },
      { id: '2', name: 'Typecheck', category: 'typecheck', passed: true, durationMs: 800 }
    ];

    const result = evaluateReleaseGates('staging', 'def5678', checksWithFailedTest);
    expect(result.allowed).toBe(false);
    expect(result.blockingFailure).toContain('Release gate failed: Unit Tests');
  });

  // ── 4. Migration Ordering & Validation ────────────────────────────────────
  it('validates migration chronology and companion down-migration pairing', () => {
    const validMigrations = [
      '20261001_01_init.sql',
      '20261001_01_init.down.sql',
      '20261003_01_users.sql',
      '20261003_01_users.down.sql',
      '20261007_01_orders.sql'
    ];

    const validation = validateMigrationSequence(validMigrations);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
    expect(validation.entries.length).toBe(3); // 3 forward migrations

    const initEntry = validation.entries.find((e) => e.version === '20261001_01');
    expect(initEntry?.hasDownMigration).toBe(true);
    expect(initEntry?.isReversible).toBe(true);

    const ordersEntry = validation.entries.find((e) => e.version === '20261007_01');
    expect(ordersEntry?.hasDownMigration).toBe(false);

    // Out of order test
    const outOfOrder = ['20261007_01_orders.sql', '20261003_01_users.sql'];
    const invalid = validateMigrationSequence(outOfOrder);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors[0]).toContain('chronological order');

    // Live repository worker/db/migrations directory validation
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(currentDir, '../../../db/migrations');
    const liveFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const liveValidation = validateMigrationSequence(liveFiles);
    expect(liveValidation.valid).toBe(true);
    expect(liveValidation.errors).toEqual([]);
    expect(liveValidation.entries.length).toBeGreaterThanOrEqual(35);
  });

  // ── 5. Smoke Test Probes Execution & Aggregation ──────────────────────────
  it('executes smoke probes and aggregates workflow health correctly', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/health')) {
        return { status: 200, ok: true };
      }
      if (url.includes('/api/products')) {
        return { status: 200, ok: true };
      }
      return { status: 500, ok: false };
    });

    const probe = CANONICAL_SMOKE_PROBES[0]!;
    const probeResult = await executeSmokeProbe('https://mock.aura.cafe', probe, mockFetch as unknown as typeof fetch);

    expect(probeResult.status).toBe('passed');
    expect(probeResult.httpCode).toBe(200);
    expect(probeResult.latencyMs).toBeGreaterThanOrEqual(0);

    const sampleResults: SmokeTestProbeResult[] = [
      { workflow: 'System Liveness', endpoint: '/api/health', method: 'GET', status: 'passed', httpCode: 200, latencyMs: 30, expectedStatus: 200 },
      { workflow: 'Catalog Products', endpoint: '/api/products', method: 'GET', status: 'passed', httpCode: 200, latencyMs: 50, expectedStatus: 200 },
      { workflow: 'Cafe Tables', endpoint: '/api/tables', method: 'GET', status: 'failed', httpCode: 503, latencyMs: 250, expectedStatus: 200, error: 'DB locked' }
    ];

    const evaluation = evaluateSmokeTests(sampleResults);
    expect(evaluation.healthy).toBe(false);
    expect(evaluation.passedCount).toBe(2);
    expect(evaluation.totalCount).toBe(3);
    expect(evaluation.failedWorkflows).toContain('Cafe Tables');
  });

  // ── 6. Secret Exclusion Invariant ─────────────────────────────────────────
  it('guarantees environment configurations never expose raw secret values', () => {
    for (const env of Object.values(ENVIRONMENTS)) {
      expect((env as Record<string, unknown>).JWT_SECRET).toBeUndefined();
      expect((env as Record<string, unknown>).PAYOS_API_KEY).toBeUndefined();
      expect((env as Record<string, unknown>).API_KEY).toBeUndefined();
      expect((env as Record<string, unknown>).SECRET).toBeUndefined();
    }
  });

  // ── 7. Staging Credentials Inventory Validation ──────────────────────────
  it('validates staging credentials presence without leaking secret values', () => {
    const emptyValidation = validateStagingCredentials({});
    expect(emptyValidation.ready).toBe(false);
    expect(emptyValidation.missing).toEqual([...REQUIRED_STAGING_CREDENTIALS]);
    expect(emptyValidation.present).toEqual([]);

    const fullEnv: Record<string, string> = {};
    for (const key of REQUIRED_STAGING_CREDENTIALS) {
      fullEnv[key] = 'staging-mock-secret-value';
    }
    const readyValidation = validateStagingCredentials(fullEnv);
    expect(readyValidation.ready).toBe(true);
    expect(readyValidation.missing).toEqual([]);
    expect(readyValidation.present).toEqual([...REQUIRED_STAGING_CREDENTIALS]);
    expect(JSON.stringify(readyValidation)).not.toContain('staging-mock-secret-value');
  });

  // ── 8. Target-Scoped Post-Deploy Verification in deploy-cloudflare.sh ─────
  it('scopes Worker and Pages post-deploy SHA checks to the deployed target and fails closed on mismatch', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const deployScript = readFileSync(resolve(currentDir, '../../../../deploy-cloudflare.sh'), 'utf8');

    expect(deployScript).toContain('if [[ "$PAGES_ONLY" == "false" ]]; then');
    expect(deployScript).toContain('if [[ "$WORKER_ONLY" == "false" ]]; then');
    expect(deployScript).toMatch(
      /Custom domain SHA DISCREPANCY after \$MAX_RETRIES attempts[\s\S]*?exit 1/,
    );
  });
});

