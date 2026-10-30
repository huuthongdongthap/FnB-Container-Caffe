/**
 * Canonical Business Continuity & Disaster Recovery Policies
 * Enforces RPO/RTO validation, recovery ordering, and cross-domain integrity.
 */

import type {
  StorageResourceContinuity,
  BackupManifest,
  RestorationPlan,
  ContinuityValidationResult
} from '../model/continuity-types';

export const CANONICAL_STORAGE_CONTINUITY: Record<string, StorageResourceContinuity> = {
  fnb_caffe_db: {
    resourceId: '97ae7a5f-fc4d-460d-b019-8535332bd81f',
    resourceName: 'fnb-caffe-db (Cloudflare D1)',
    type: 'd1_relational',
    criticality: 'TIER_1_CRITICAL',
    authoritativeSource: 'Cloudflare D1 Primary SQLite Engine',
    backupMechanism: 'Cloudflare Automated Point-in-Time Replication + On-Demand Logical SQL Export',
    backupFrequency: 'Continuous replication + Pre-migration export checkpoints',
    retentionDays: 30,
    rpoMinutes: 15,
    rtoMinutes: 10,
    encryptionAtRest: true,
    isolatedAccess: true
  },
  auth_kv: {
    resourceId: '789e7cf1894e4d4c9e8f8cd51b2dbe16',
    resourceName: 'AUTH_KV (Cloudflare KV)',
    type: 'kv_ephemeral',
    criticality: 'TIER_3_EPHEMERAL',
    authoritativeSource: 'Ephemeral Cache / D1 Replay',
    backupMechanism: 'Self-healing / reconstructable from D1 audit logs',
    backupFrequency: 'On-demand / stateless',
    retentionDays: 7,
    rpoMinutes: 0,
    rtoMinutes: 1,
    encryptionAtRest: true,
    isolatedAccess: true
  },
  order_broadcaster: {
    resourceId: 'OrderBroadcaster',
    resourceName: 'OrderBroadcaster (Cloudflare Durable Objects)',
    type: 'durable_object',
    criticality: 'TIER_3_EPHEMERAL',
    authoritativeSource: 'Realtime WebSocket sessions / D1 Rehydration',
    backupMechanism: 'Client auto-reconnect + D1 order state query',
    backupFrequency: 'Stateless / in-memory',
    retentionDays: 0,
    rpoMinutes: 0,
    rtoMinutes: 1,
    encryptionAtRest: true,
    isolatedAccess: true
  },
  pages_frontend: {
    resourceId: 'fnb-caffe-container',
    resourceName: 'fnb-caffe-container (Cloudflare Pages)',
    type: 'pages_static',
    criticality: 'TIER_2_OPERATIONAL',
    authoritativeSource: 'Immutable Git Commit SHA (main branch)',
    backupMechanism: 'Git Version History + Cloudflare Pages Instant Deployment Rollback',
    backupFrequency: 'Every production merge / release',
    retentionDays: 90,
    rpoMinutes: 0,
    rtoMinutes: 5,
    encryptionAtRest: true,
    isolatedAccess: true
  }
};

const SAFE_CONTINUITY_IDENTIFIER_REGEX = /^[a-zA-Z0-9._-]+$/;
const HEX_CHECKSUM_REGEX = /^[0-9a-fA-F]{16,64}$/;

export function validateBackupManifest(manifest: BackupManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!manifest.backupId || !manifest.backupId.trim()) {
    errors.push('Missing backupId');
  } else if (!SAFE_CONTINUITY_IDENTIFIER_REGEX.test(manifest.backupId)) {
    errors.push('Invalid backupId format: only alphanumeric, dot, underscore, and hyphen are allowed');
  }
  if (manifest.databaseId !== undefined) {
    if (!manifest.databaseId.trim() || !SAFE_CONTINUITY_IDENTIFIER_REGEX.test(manifest.databaseId)) {
      errors.push('Invalid databaseId format: only alphanumeric, dot, underscore, and hyphen are allowed');
    }
  }
  if (!manifest.timestamp || !manifest.timestamp.trim()) errors.push('Missing timestamp');
  if (!manifest.checksumSha256 || !HEX_CHECKSUM_REGEX.test(manifest.checksumSha256)) {
    errors.push('Invalid checksum SHA-256');
  }
  if (!Number.isInteger(manifest.tablesCount) || manifest.tablesCount <= 0) {
    errors.push('Tables count must be greater than zero');
  }
  if (!manifest.recordsCount || typeof manifest.recordsCount !== 'object') {
    errors.push('Missing recordsCount map');
  } else {
    for (const [table, count] of Object.entries(manifest.recordsCount)) {
      if (!Number.isInteger(count) || count < 0) {
        errors.push(`Invalid record count for table ${table}: must be a non-negative integer`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function generateRestorationPlan(
  incidentType: RestorationPlan['incidentType'],
  manifest: BackupManifest,
  targetEnv: RestorationPlan['targetEnvironment'] = 'isolated_test'
): RestorationPlan {
  const manifestValidation = validateBackupManifest(manifest);
  if (!manifestValidation.valid) {
    throw new Error(
      `Cannot generate restoration plan from invalid backup manifest: ${manifestValidation.errors.join('; ')}`
    );
  }

  const steps = [
    {
      stepNumber: 1,
      service: 'Cloudflare Pages / Frontend',
      action: 'Lock maintenance banner or freeze incoming non-idempotent traffic',
      commandSnippet: 'npx wrangler pages deployment rollback <stable-id>',
      estimatedMinutes: 2,
      validationCheck: 'Health probe returns HTTP 200 or 503 Maintenance',
      reversible: true
    },
    {
      stepNumber: 2,
      service: 'Cloudflare D1 Database',
      action: 'Restore schema and relational data to isolated verification database',
      commandSnippet: `npx wrangler d1 execute ${manifest.databaseId || 'fnb-caffe-db'} --file=${manifest.backupId}.sql`,
      estimatedMinutes: 5,
      validationCheck: 'Verify table counts, foreign keys, and checksum matching manifest',
      reversible: false
    },
    {
      stepNumber: 3,
      service: 'Cloudflare Worker & Durable Objects',
      action: 'Redeploy stable worker commit and trigger DO reconnection re-hydration',
      commandSnippet: 'cd worker && npx wrangler deploy --config wrangler.toml',
      estimatedMinutes: 3,
      validationCheck: 'GET /api/health?ready=1 passes with D1 connected',
      reversible: true
    }
  ];

  return {
    planId: `restore_${Date.now()}`,
    incidentType,
    targetEnvironment: targetEnv,
    manifest,
    steps,
    status: 'draft'
  };
}

export function verifyReferentialInvariants(sample: {
  ordersCount: number;
  orderItemsCount: number;
  paymentsCount: number;
  unlinkedItemsCount: number;
  duplicateTransactionsCount: number;
}): ContinuityValidationResult {
  const errors: string[] = [];
  const hasNegativeCounts =
    sample.ordersCount < 0 ||
    sample.orderItemsCount < 0 ||
    sample.paymentsCount < 0 ||
    sample.unlinkedItemsCount < 0 ||
    sample.duplicateTransactionsCount < 0;

  if (hasNegativeCounts) {
    errors.push('Invalid negative record count in continuity sample');
  }
  if (sample.unlinkedItemsCount > 0) {
    errors.push(`Detected ${sample.unlinkedItemsCount} orphan order_items missing valid order_id`);
  }
  if (sample.duplicateTransactionsCount > 0) {
    errors.push(`Detected ${sample.duplicateTransactionsCount} duplicate payment transactions violating unique constraint`);
  }
  if (sample.ordersCount > 0 && sample.orderItemsCount === 0) {
    errors.push('Inconsistent dataset: orders exist but order_items count is zero');
  }
  if (sample.ordersCount === 0 && sample.paymentsCount > 0) {
    errors.push(`Detected ${sample.paymentsCount} orphan payments with zero parent orders`);
  }

  return {
    healthy: errors.length === 0,
    schemaValid: errors.length === 0,
    foreignKeyIntegrity: sample.unlinkedItemsCount === 0 && !(sample.ordersCount === 0 && sample.paymentsCount > 0),
    duplicateProtectionActive: sample.duplicateTransactionsCount === 0,
    recordCountMatches: !hasNegativeCounts,
    errors
  };
}
