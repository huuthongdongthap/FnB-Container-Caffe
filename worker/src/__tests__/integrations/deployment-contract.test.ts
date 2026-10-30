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
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateConfig } from '../../../../setup/aura-deploy/src/template/generate';
import {
  toDomainSlug,
  isValidDomainSlug,
  validateDomainSlug,
  validateWizardAnswers,
  validateDeployTarget,
} from '../../../../setup/aura-deploy/src/wizard/validators';
import { getQuestions } from '../../../../setup/aura-deploy/src/wizard/questions';
import {
  validateGeneratedArtifacts,
  deployToCloudflare,
} from '../../../../setup/aura-deploy/src/deploy/cloudflare';
import {
  checkApiHealth,
  checkVersionParity,
  checkBranding,
} from '../../../../setup/aura-deploy/src/commands/verify-checks';
import {
  ENVIRONMENTS,
  REQUIRED_STAGING_CREDENTIALS,
  evaluateReleaseGates,
  validateMigrationSequence,
  validateStagingCredentials,
  evaluateSmokeTests,
  executeSmokeProbe,
  verifyDeploymentVersionParity,
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

    // Empty check suite must fail closed (NOT_RUN is never PASS)
    const emptyGates = evaluateReleaseGates('staging', 'def5678', []);
    expect(emptyGates.allowed).toBe(false);
    expect(emptyGates.blockingFailure).toContain('at least one release gate check');

    // Unknown or blank versionSha must fail closed
    const unknownSha = evaluateReleaseGates('staging', 'unknown', [
      { id: '1', name: 'Unit Tests', category: 'test', passed: true, durationMs: 1200 },
    ]);
    expect(unknownSha.allowed).toBe(false);
    expect(unknownSha.blockingFailure).toContain('valid commit versionSha is required');
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

    // Duplicate version prefix test
    const duplicateVersion = ['20261003_01_users.sql', '20261003_01_roles.sql'];
    const duplicateInvalid = validateMigrationSequence(duplicateVersion);
    expect(duplicateInvalid.valid).toBe(false);
    expect(duplicateInvalid.errors[0]).toContain('Duplicate migration version prefix');

    // Orphan down-migration test
    const orphanDown = ['20261001_01_init.sql', '20261005_01_ghost.down.sql'];
    const orphanInvalid = validateMigrationSequence(orphanDown);
    expect(orphanInvalid.valid).toBe(false);
    expect(orphanInvalid.errors[0]).toContain('Orphan down-migration without matching forward migration');

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

    // Empty probe results must fail closed (NOT_RUN is never healthy)
    const emptyEvaluation = evaluateSmokeTests([]);
    expect(emptyEvaluation.healthy).toBe(false);
    expect(emptyEvaluation.totalCount).toBe(0);
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

  // ── 8. Target-Scoped Post-Deploy Verification Across All Deploy Entrypoints ─
  it('scopes Worker and Pages post-deploy SHA checks to the deployed target and fails closed across deploy scripts and CI', async () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(currentDir, '../../../..');
    const deployScript = readFileSync(resolve(repoRoot, 'deploy-cloudflare.sh'), 'utf8');
    const brandedScript = readFileSync(resolve(repoRoot, 'scripts/deploy-branded.sh'), 'utf8');
    const fixScript = readFileSync(resolve(repoRoot, 'scripts/deploy-fix.sh'), 'utf8');
    const githubWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/deploy.yml'), 'utf8');
    const auraDeployCmd = readFileSync(resolve(repoRoot, 'setup/aura-deploy/src/commands/deploy.ts'), 'utf8');

    for (const script of [deployScript, brandedScript]) {
      expect(script).toContain('if [[ "$PAGES_ONLY" == "false" ]]; then');
      expect(script).toContain('if [[ "$WORKER_ONLY" == "false" ]]; then');
      expect(script).toMatch(/Health: FAILED after \$MAX_RETRIES attempts[\s\S]*?exit 1/);
      expect(script).toMatch(/SHA MISMATCH after \$MAX_RETRIES attempts[\s\S]*?exit 1/);
      expect(script).toMatch(/Custom domain SHA DISCREPANCY after \$MAX_RETRIES attempts[\s\S]*?exit 1/);
    }

    expect(fixScript).toMatch(/Custom domain SHA DISCREPANCY after \$MAX_RETRIES attempts[\s\S]*?exit 1/);
    expect(githubWorkflow).toContain('cat > dist/version.json << VERSIONEOF');
    expect(githubWorkflow).toContain('"deployScript": "github-actions-deploy-pages"');
    expect(auraDeployCmd).toContain("writeFileSync(resolve(distDir, 'version.json')");
    expect(auraDeployCmd).toMatch(/if \(!workerDeployOk\) \{\s*console\.error[\s\S]*?process\.exit\(1\)/);

    const tempOut = mkdtempSync(join(tmpdir(), 'aura-template-test-'));
    try {
      const paths = await generateConfig(
        {
          cafeName: 'Aura "Industrial" \\ Cafe',
          domainSlug: 'aura-industrial',
          primaryColor: '#D4A574',
          tagline: 'Specialty "Container" \\ Coffee',
          adminEmail: 'ops@auraspace.cafe',
          adminPassword: 'p@ss"word\\123',
        },
        tempOut,
      );
      const parsedBrand = JSON.parse(readFileSync(paths.brandJson, 'utf8'));
      expect(parsedBrand.brand.name).toBe('Aura "Industrial" \\ Cafe');
      expect(parsedBrand.brand.tagline).toBe('Specialty "Container" \\ Coffee');

      const wranglerToml = readFileSync(paths.wranglerToml, 'utf8');
      expect(wranglerToml).toContain('binding = "AURA_DB"');
      expect(wranglerToml).toContain('binding = "AUTH_KV"');
      expect(wranglerToml).toContain('name = "ORDER_BROADCASTER"');
      expect(wranglerToml).toContain('compatibility_flags = ["nodejs_compat"]');
    } finally {
      rmSync(tempOut, { recursive: true, force: true });
    }
  });

  // ── 9. Post-Deploy Smoke Payload, Version Parity & aura-deploy verify Fail-Closed ─
  it('rejects HTML SPA fallbacks, detects Pages/Worker SHA drift, and enforces fail-closed health and version checks', async () => {
    const healthProbe = CANONICAL_SMOKE_PROBES.find((p) => p.path === '/api/health')!;
    const readyProbe = CANONICAL_SMOKE_PROBES.find((p) => p.path === '/api/health?ready=1')!;
    const versionProbe = CANONICAL_SMOKE_PROBES.find((p) => p.path === '/api/version')!;

    // 1. HTML SPA fallback on /api/health -> failed
    const htmlFallbackFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => '<!doctype html><html><body>SPA Fallback</body></html>',
    });
    const htmlResult = await executeSmokeProbe(
      'https://auraspace.cafe',
      healthProbe,
      htmlFallbackFetch as unknown as typeof fetch,
    );
    expect(htmlResult.status).toBe('failed');
    expect(htmlResult.error).toContain('non-JSON or HTML fallback');

    // 2. Degraded readiness payload -> degraded
    const degradedFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ status: 'degraded', readiness: true }),
    });
    const degradedResult = await executeSmokeProbe(
      'https://auraspace.cafe',
      readyProbe,
      degradedFetch as unknown as typeof fetch,
    );
    expect(degradedResult.status).toBe('degraded');
    const evalDegraded = evaluateSmokeTests([degradedResult]);
    expect(evalDegraded.degradedWorkflows).toContain('System Deep Readiness');

    // 3. Version probe with expectedSha mismatch -> failed
    const shaFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ shortSha: 'deadbeef', fullSha: 'deadbeef12345678' }),
    });
    const mismatchResult = await executeSmokeProbe(
      'https://auraspace.cafe',
      versionProbe,
      shaFetch as unknown as typeof fetch,
      { expectedSha: 'cafebabe99887766' },
    );
    expect(mismatchResult.status).toBe('failed');
    expect(mismatchResult.error).toContain('SHA mismatch');

    const matchResult = await executeSmokeProbe(
      'https://auraspace.cafe',
      versionProbe,
      shaFetch as unknown as typeof fetch,
      { expectedSha: 'deadbeef12345678' },
    );
    expect(matchResult.status).toBe('passed');

    // 4. verifyDeploymentVersionParity detects split-brain Pages vs Worker SHA drift
    const driftFetch = vi.fn().mockImplementation(async (url: string) => ({
      status: 200,
      text: async () =>
        url.endsWith('/version.json')
          ? JSON.stringify({ sha: '1111222233334444', shortSha: '11112222' })
          : JSON.stringify({ fullSha: '9999888877776666', shortSha: '99998888' }),
    }));
    const driftParity = await verifyDeploymentVersionParity(
      'https://auraspace.cafe',
      undefined,
      driftFetch as unknown as typeof fetch,
    );
    expect(driftParity.matches).toBe(false);
    expect(driftParity.error).toContain('Pages/Worker SHA drift detected');

    const syncedFetch = vi.fn().mockImplementation(async () => ({
      status: 200,
      text: async () => JSON.stringify({ sha: 'fab0904011223344', fullSha: 'fab0904011223344', shortSha: 'fab09040' }),
    }));
    const syncedParity = await verifyDeploymentVersionParity(
      'https://auraspace.cafe',
      'fab0904011223344',
      syncedFetch as unknown as typeof fetch,
    );
    expect(syncedParity.matches).toBe(true);
    expect(syncedParity.pagesSha).toBe('fab09040');
    expect(syncedParity.workerSha).toBe('fab09040');

    // 5. setup/aura-deploy verify helpers fail closed on HTML health and SHA drift
    const htmlHealthCheck = await checkApiHealth('auraspace.cafe', async () => ({
      status: 200,
      body: '<!doctype html><html></html>',
    }));
    expect(htmlHealthCheck.status).toBe('FAIL');

    const okHealthCheck = await checkApiHealth('auraspace.cafe', async () => ({
      status: 200,
      body: JSON.stringify({ status: 'ok', d1: 'connected' }),
    }));
    expect(okHealthCheck.status).toBe('PASS');

    const parityFailCheck = await checkVersionParity('auraspace.cafe', 'fab09040', async (url) => ({
      status: 200,
      body: url.endsWith('/version.json')
        ? JSON.stringify({ shortSha: 'fab09040' })
        : JSON.stringify({ shortSha: '1deddb64' }),
    }));
    expect(parityFailCheck.status).toBe('FAIL');
    expect(parityFailCheck.detail).toContain('Pages/Worker SHA mismatch');

    const parityPassCheck = await checkVersionParity('auraspace.cafe', 'fab0904011223344', async () => ({
      status: 200,
      body: JSON.stringify({ sha: 'fab0904011223344', shortSha: 'fab09040' }),
    }));
    expect(parityPassCheck.status).toBe('PASS');

    const brandPassCheck = await checkBranding('auraspace.cafe', 'AURA CAFE', async () => ({
      status: 200,
      body: '<html><title>AURA CAFE — Sa Dec</title></html>',
    }));
    expect(brandPassCheck.status).toBe('PASS');

    // 6. Verify smoke-saas.sh fail-closed version contract
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(currentDir, '../../../..');
    const smokeSaasScript = readFileSync(resolve(repoRoot, 'scripts/smoke-saas.sh'), 'utf8');
    expect(smokeSaasScript).not.toContain('pass "version (no sha)"');
    expect(smokeSaasScript).toContain('fail "version-invalid-sha: $VER"');
    expect(smokeSaasScript).toContain('fail "version-sha-mismatch: expected $EXPECTED_SHORT, got $SHORT_SHA"');
  });

  // ── 10. aura-deploy Wizard, Template Guard, Cloudflare Preflight & Deploy Target Validation ─
  it('validates hyphenated domain slugs, rejects invalid wizard answers and missing artifacts, and guards deploy targets', async () => {
    expect(toDomainSlug('AURA CAFE — Sa Đéc 2')).toBe('aura-cafe-sa-dec-2');
    expect(isValidDomainSlug('aura-industrial')).toBe(true);
    expect(isValidDomainSlug('sadec-2')).toBe(true);
    expect(isValidDomainSlug('ab')).toBe(false);
    expect(isValidDomainSlug('-leading')).toBe(false);
    expect(isValidDomainSlug('trailing-')).toBe(false);
    expect(isValidDomainSlug('double--hyphen')).toBe(false);
    expect(isValidDomainSlug('../evil')).toBe(false);
    expect(validateDomainSlug('my_cafe!')).toContain('lowercase alphanumeric');

    const slugQuestion = getQuestions().find((q) => q.name === 'domainSlug')!;
    expect(slugQuestion.transform?.('', { cafeName: 'AURA Space — Đéc' })).toBe('aura-space-dec');
    // Transform must not strip invalid characters before validate runs
    const transformedInvalid = slugQuestion.transform?.('../evil_slug', { cafeName: 'Aura' }) ?? '';
    expect(slugQuestion.validate(transformedInvalid)).not.toBeNull();

    const invalidErrors = validateWizardAnswers({
      cafeName: '',
      domainSlug: '../evil',
      primaryColor: 'not-a-color',
      tagline: 'x'.repeat(101),
      adminEmail: 'invalid-email',
      adminPassword: 'short',
    });
    expect(Object.keys(invalidErrors)).toEqual([
      'cafeName',
      'domainSlug',
      'primaryColor',
      'tagline',
      'adminEmail',
      'adminPassword',
    ]);

    const tempOut = mkdtempSync(join(tmpdir(), 'aura-preflight-test-'));
    try {
      await expect(
        generateConfig(
          {
            cafeName: 'Aura Cafe',
            domainSlug: '../bad-slug',
            primaryColor: '#D4A574',
            tagline: 'Specialty Coffee',
            adminEmail: 'ops@auraspace.cafe',
            adminPassword: 'strongpassword123',
          },
          tempOut,
        ),
      ).rejects.toThrow(/Invalid wizard answers for config generation/);

      const validAnswers = {
        cafeName: 'Aura Sa Dec',
        domainSlug: 'aura-sadec',
        primaryColor: '#D4A574',
        tagline: 'Specialty Container Coffee',
        adminEmail: 'ops@auraspace.cafe',
        adminPassword: 'strongpassword123',
      };
      const generated = await generateConfig(validAnswers, tempOut);

      const validCheck = validateGeneratedArtifacts(generated, validAnswers);
      expect(validCheck.valid).toBe(true);
      expect(validCheck.errors).toEqual([]);

      const cfResult = await deployToCloudflare(generated, validAnswers, () => true);
      expect(cfResult).toEqual({
        projectName: 'aura-cafe-aura-sadec',
        pagesUrl: 'https://aura-sadec.pages.dev',
        apiUrl: 'https://aura-sadec.pages.dev/api',
      });

      await expect(
        deployToCloudflare(
          { ...generated, brandJson: join(tempOut, 'missing-brand.json') },
          validAnswers,
          () => false,
        ),
      ).rejects.toThrow(/brandJson does not exist/);
    } finally {
      rmSync(tempOut, { recursive: true, force: true });
    }

    expect(validateDeployTarget('aura-sadec', 'aura-cafe-aura-sadec').valid).toBe(true);
    expect(validateDeployTarget('aura-sadec; rm -rf /', 'aura-cafe').valid).toBe(false);
    expect(validateDeployTarget('aura-sadec', 'bad_project; whoami').valid).toBe(false);
  });
});

