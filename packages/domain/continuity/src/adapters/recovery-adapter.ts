/**
 * Recovery Adapter & Verification Helpers
 * Validates integrity checksums, simulate isolated restorations, and inspect record parity.
 */

import type { BackupManifest } from '../model/continuity-types';
import { validateBackupManifest } from '../policies/continuity-policy';

export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function evaluateBackupIntegrity(
  manifest: BackupManifest,
  actualContentHash: string,
  actualTableCount: number,
  actualRecordsCount?: Record<string, number>
): { valid: boolean; error?: string } {
  const manifestCheck = validateBackupManifest(manifest);
  if (!manifestCheck.valid) {
    return {
      valid: false,
      error: `Invalid backup manifest: ${manifestCheck.errors.join('; ')}`
    };
  }
  if (!actualContentHash || manifest.checksumSha256.toLowerCase() !== actualContentHash.toLowerCase()) {
    return {
      valid: false,
      error: `Checksum mismatch: expected ${manifest.checksumSha256}, received ${actualContentHash}`
    };
  }
  if (manifest.tablesCount !== actualTableCount) {
    return {
      valid: false,
      error: `Table count mismatch: manifest expected ${manifest.tablesCount}, found ${actualTableCount}`
    };
  }
  if (actualRecordsCount) {
    for (const [table, expectedCount] of Object.entries(manifest.recordsCount)) {
      const actualCount = actualRecordsCount[table];
      if (actualCount !== expectedCount) {
        return {
          valid: false,
          error: `Record count mismatch for table ${table}: manifest expected ${expectedCount}, found ${actualCount ?? 'missing'}`
        };
      }
    }
  }
  return { valid: true };
}

export function checkRestorationChecklist(checklist: {
  isolatedEnvAvailable: boolean;
  preRecoverySnapshotTaken: boolean;
  credentialsVerified: boolean;
  postRecoverySmokeTestReady: boolean;
}): { ready: boolean; pendingItems: string[] } {
  const pendingItems: string[] = [];
  if (!checklist.isolatedEnvAvailable) pendingItems.push('Isolated sandbox/test database not provisioned');
  if (!checklist.preRecoverySnapshotTaken) pendingItems.push('Checkpoint snapshot prior to restoration missing');
  if (!checklist.credentialsVerified) pendingItems.push('Target environment credentials not verified');
  if (!checklist.postRecoverySmokeTestReady) pendingItems.push('Post-recovery smoke test probe not armed');

  return {
    ready: pendingItems.length === 0,
    pendingItems
  };
}
