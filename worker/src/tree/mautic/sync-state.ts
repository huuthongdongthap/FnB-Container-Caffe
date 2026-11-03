/**
 * Mautic Bridge — In-memory sync state (per-isolate)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { SyncStatus } from './types';
import { matchesTenantRow } from '../../lib/db';

export const syncStatus: SyncStatus = {
  last_sync: null,
  contacts_synced: 0,
  campaigns_enrolled: 0,
  errors: [],
  status: 'idle'
};

const tenantSyncStatusMap = new Map<string, SyncStatus>([['default', syncStatus]]);

export function getSyncStatus(tenantId?: string): SyncStatus {
  const clean = tenantId ? tenantId.trim() : '';
  const key = clean && clean !== '*' ? clean : 'default';
  if (key === 'default') {
    return syncStatus;
  }
  let state = tenantSyncStatusMap.get(key);
  if (!state) {
    state = {
      last_sync: null,
      contacts_synced: 0,
      campaigns_enrolled: 0,
      errors: [],
      status: 'idle'
    };
    tenantSyncStatusMap.set(key, state);
  }
  return state;
}

export function matchesMauticTenant(
  row: Record<string, unknown> | null | undefined,
  tenantId?: string
): boolean {
  if (!row) return false;
  const clean = tenantId ? tenantId.trim() : '';
  if (clean === '*') return true;
  return matchesTenantRow(row, clean || 'default');
}
