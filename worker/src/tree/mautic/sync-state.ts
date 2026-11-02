/**
 * Mautic Bridge — In-memory sync state (per-isolate)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { SyncStatus } from './types';

export const syncStatus: SyncStatus = {
  last_sync: null,
  contacts_synced: 0,
  campaigns_enrolled: 0,
  errors: [],
  status: 'idle'
};

const tenantSyncStatusMap = new Map<string, SyncStatus>([['default', syncStatus]]);

export function getSyncStatus(tenantId?: string): SyncStatus {
  const key = tenantId && tenantId !== '*' ? tenantId : 'default';
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
  if (tenantId === '*') return true;
  const effective = tenantId && tenantId !== '*' ? tenantId : 'default';
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === effective;
  }
  return effective === 'default';
}
