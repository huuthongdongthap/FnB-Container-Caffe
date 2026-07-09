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
