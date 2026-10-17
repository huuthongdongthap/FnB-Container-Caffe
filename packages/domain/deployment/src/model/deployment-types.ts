/**
 * Canonical Deployment Types & Domain Model
 * Defines environment taxonomy, release gates, migration manifest, and smoke test contracts.
 */

export type EnvironmentName = 'local' | 'test' | 'staging' | 'production';

export interface EnvironmentConfig {
  name: EnvironmentName;
  frontendUrl: string;
  workerUrl: string;
  databaseId?: string;
  kvNamespaceId?: string;
  isProduction: boolean;
  requiresExplicitAuth: boolean;
}

export interface ReleaseGateCheck {
  id: string;
  name: string;
  category: 'test' | 'typecheck' | 'lint' | 'build' | 'migration' | 'authorization';
  passed: boolean;
  details?: string;
  durationMs: number;
}

export interface ReleaseGateResult {
  allowed: boolean;
  targetEnvironment: EnvironmentName;
  timestamp: string;
  versionSha: string;
  checks: ReleaseGateCheck[];
  blockingFailure?: string;
}

export interface D1MigrationEntry {
  filename: string;
  version: string;
  domain: string;
  isReversible: boolean;
  hasDownMigration: boolean;
  isIdempotent: boolean;
}

export interface SmokeTestProbeResult {
  workflow: string;
  endpoint: string;
  method: 'GET' | 'POST';
  status: 'passed' | 'failed' | 'degraded';
  httpCode: number;
  latencyMs: number;
  error?: string;
  expectedStatus: number;
}

export interface DeploymentManifest {
  versionSha: string;
  shortSha: string;
  deployedAt: string;
  environment: EnvironmentName;
  deployedBy?: string;
  migrationsApplied: string[];
  smokeResults: SmokeTestProbeResult[];
  rollbackReady: boolean;
}

export interface StagingCredentialsValidation {
  ready: boolean;
  present: string[];
  missing: string[];
}

