/**
 * Canonical Backup, Recovery, and Business Continuity Contracts
 * Defines RPO/RTO targets, storage resource mappings, and integrity invariants.
 */

export type StorageResourceType = 'd1_relational' | 'kv_ephemeral' | 'durable_object' | 'pages_static';

export type CriticalityTier = 'TIER_1_CRITICAL' | 'TIER_2_OPERATIONAL' | 'TIER_3_EPHEMERAL';

export interface StorageResourceContinuity {
  resourceId: string;
  resourceName: string;
  type: StorageResourceType;
  criticality: CriticalityTier;
  authoritativeSource: string;
  backupMechanism: string;
  backupFrequency: string;
  retentionDays: number;
  rpoMinutes: number;
  rtoMinutes: number;
  encryptionAtRest: boolean;
  isolatedAccess: boolean;
}

export interface BackupManifest {
  backupId: string;
  resourceName: string;
  databaseId?: string;
  timestamp: string;
  schemaVersion: string;
  tablesCount: number;
  recordsCount: Record<string, number>;
  checksumSha256: string;
  format: 'sql_dump' | 'sqlite_snapshot' | 'git_commit_sha';
  preMigrationCheckpoint: boolean;
}

export interface RestorationPlan {
  planId: string;
  incidentType: 'database_corruption' | 'failed_migration' | 'bad_deployment' | 'infrastructure_outage';
  targetEnvironment: 'isolated_test' | 'staging' | 'production';
  manifest: BackupManifest;
  steps: RestorationStep[];
  status: 'draft' | 'in_progress' | 'verified' | 'completed' | 'aborted';
}

export interface RestorationStep {
  stepNumber: number;
  service: string;
  action: string;
  commandSnippet?: string;
  estimatedMinutes: number;
  validationCheck: string;
  reversible: boolean;
}

export interface ContinuityValidationResult {
  healthy: boolean;
  schemaValid: boolean;
  foreignKeyIntegrity: boolean;
  duplicateProtectionActive: boolean;
  recordCountMatches: boolean;
  errors: string[];
}
