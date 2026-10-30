/**
 * Canonical Deployment Policy
 * Enforces environment isolation, release gate evaluation, and migration safety invariants.
 */

import type {
  EnvironmentConfig,
  EnvironmentName,
  ReleaseGateCheck,
  ReleaseGateResult,
  D1MigrationEntry,
  SmokeTestProbeResult,
  StagingCredentialsValidation
} from '../model/deployment-types';

export const REQUIRED_STAGING_CREDENTIALS = [
  'CLOUDFLARE_API_TOKEN_STAGING',
  'AURA_DB_STAGING',
  'PAYOS_CLIENT_ID_STAGING',
  'PAYOS_API_KEY_STAGING',
  'PAYOS_CHECKSUM_KEY_STAGING',
  'JWT_SECRET_STAGING'
] as const;

export const ENVIRONMENTS: Record<EnvironmentName, EnvironmentConfig> = {
  local: {
    name: 'local',
    frontendUrl: 'http://localhost:5173',
    workerUrl: 'http://localhost:8787',
    isProduction: false,
    requiresExplicitAuth: false
  },
  test: {
    name: 'test',
    frontendUrl: 'http://localhost:3000',
    workerUrl: 'http://localhost:8787',
    isProduction: false,
    requiresExplicitAuth: false
  },
  staging: {
    name: 'staging',
    frontendUrl: 'https://staging.auraspace.cafe',
    workerUrl: 'https://aura-space-worker-staging.sadec-marketing-hub.workers.dev',
    databaseId: 'fnb-caffe-db-staging',
    isProduction: false,
    requiresExplicitAuth: false
  },
  production: {
    name: 'production',
    frontendUrl: 'https://auraspace.cafe',
    workerUrl: 'https://aura-space-worker.sadec-marketing-hub.workers.dev',
    databaseId: '97ae7a5f-fc4d-460d-b019-8535332bd81f',
    kvNamespaceId: '789e7cf1894e4d4c9e8f8cd51b2dbe16',
    isProduction: true,
    requiresExplicitAuth: true
  }
};

/**
 * Validates whether deployment to target environment is permitted
 */
export function evaluateReleaseGates(
  targetEnv: EnvironmentName,
  versionSha: string,
  checks: ReleaseGateCheck[],
  isExplicitlyAuthorized = false
): ReleaseGateResult {
  const envConfig = ENVIRONMENTS[targetEnv];
  const allChecksPassed = checks.every((c) => c.passed);

  if (envConfig.requiresExplicitAuth && !isExplicitlyAuthorized) {
    return {
      allowed: false,
      targetEnvironment: targetEnv,
      timestamp: new Date().toISOString(),
      versionSha,
      checks,
      blockingFailure: 'Production deployment requires explicit authorization.'
    };
  }

  const normalizedSha = typeof versionSha === 'string' ? versionSha.trim() : '';
  if (!normalizedSha || normalizedSha.toLowerCase() === 'unknown') {
    return {
      allowed: false,
      targetEnvironment: targetEnv,
      timestamp: new Date().toISOString(),
      versionSha,
      checks,
      blockingFailure: 'Release gate blocked: valid commit versionSha is required.'
    };
  }

  if (!Array.isArray(checks) || checks.length === 0) {
    return {
      allowed: false,
      targetEnvironment: targetEnv,
      timestamp: new Date().toISOString(),
      versionSha,
      checks: checks ?? [],
      blockingFailure: 'Release gate blocked: at least one release gate check must be executed.'
    };
  }

  const failedCheck = checks.find((c) => !c.passed);
  if (!allChecksPassed && failedCheck) {
    return {
      allowed: false,
      targetEnvironment: targetEnv,
      timestamp: new Date().toISOString(),
      versionSha,
      checks,
      blockingFailure: `Release gate failed: ${failedCheck.name} (${failedCheck.category})`
    };
  }

  return {
    allowed: true,
    targetEnvironment: targetEnv,
    timestamp: new Date().toISOString(),
    versionSha,
    checks
  };
}

/**
 * Validates migration ordering and safety invariants
 */
export function validateMigrationSequence(migrationFilenames: string[]): {
  valid: boolean;
  entries: D1MigrationEntry[];
  errors: string[];
} {
  const errors: string[] = [];
  const entries: D1MigrationEntry[] = [];
  const migrationPattern = /^(\d{8})_(\d{2})_([a-z0-9_]+?)(\.down)?\.sql$/;

  const seenVersions = new Set<string>();
  let lastVersion = '';

  for (const filename of migrationFilenames) {
    const match = filename.match(migrationPattern);
    if (!match) {
      errors.push(`Invalid migration filename convention: "${filename}". Expected YYYYMMDD_NN_slug.sql`);
      continue;
    }

    const [, date, seq, slug, isDown] = match;
    const version = `${date}_${seq}`;

    if (isDown) {
      const expectedForward = `${date}_${seq}_${slug}.sql`;
      if (!migrationFilenames.includes(expectedForward)) {
        errors.push(`Orphan down-migration without matching forward migration: ${filename}`);
      }
      continue; // Down-migration handled as companion
    }

    if (seenVersions.has(version)) {
      errors.push(`Duplicate migration version prefix: ${filename} (version ${version})`);
    }
    seenVersions.add(version);

    if (lastVersion && version < lastVersion) {
      errors.push(`Migration out of chronological order: ${filename} (version ${version} < ${lastVersion})`);
    }
    lastVersion = version;

    const hasDown = migrationFilenames.includes(`${date}_${seq}_${slug}.down.sql`);
    entries.push({
      filename,
      version,
      domain: slug || 'general',
      isReversible: hasDown,
      hasDownMigration: hasDown,
      isIdempotent: true
    });
  }

  return {
    valid: errors.length === 0,
    entries,
    errors
  };
}

/**
 * Evaluates smoke test suite results against critical path SLOs
 */
export function evaluateSmokeTests(results: SmokeTestProbeResult[]): {
  healthy: boolean;
  passedCount: number;
  totalCount: number;
  failedWorkflows: string[];
  degradedWorkflows: string[];
} {
  const failed = results.filter((r) => r.status === 'failed');
  const degraded = results.filter((r) => r.status === 'degraded');
  return {
    healthy: results.length > 0 && failed.length === 0,
    passedCount: results.filter((r) => r.status === 'passed').length,
    totalCount: results.length,
    failedWorkflows: failed.map((f) => f.workflow),
    degradedWorkflows: degraded.map((d) => d.workflow)
  };
}

/**
 * Validates presence of required staging credentials without exposing secret values
 */
export function validateStagingCredentials(
  envVars: Record<string, string | undefined>
): StagingCredentialsValidation {
  const present: string[] = [];
  const missing: string[] = [];

  for (const key of REQUIRED_STAGING_CREDENTIALS) {
    const val = envVars[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    ready: missing.length === 0,
    present,
    missing
  };
}

