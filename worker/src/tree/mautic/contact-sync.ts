/**
 * Mautic Bridge — Contact sync (batch upsert from DB to Mautic)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { createLogger } from '../../utils/logger.js';
import { getMauticClient } from './client-factory';
import { syncStatus } from './sync-state';
import type { MauticContactInput, MauticBatchResult } from '../../lib/mautic-client';
import type { CustomerContact, SyncContactsResponse, MauticBridgeEnv, MauticClientDuck } from './types';

const log = createLogger({ route: 'mautic-bridge' });

export async function syncContacts(env: MauticBridgeEnv): Promise<{ success: boolean; synced: number; errors: string[] }> {
  const client = getMauticClient(env) as MauticClientDuck | null;
  if (!client) {
    return { success: false, synced: 0, errors: ['Mautic not configured'] };
  }

  const db = env.AURA_DB;
  if (!db) {
    return { success: false, synced: 0, errors: ['Database not available'] };
  }

  syncStatus.status = 'running';
  syncStatus.errors = [];
  let synced = 0;
  const errors: string[] = [];

  try {
    const since = syncStatus.last_sync || new Date(Date.now() - 3600000).toISOString();

    const { results } = await db.prepare(
      `SELECT id, name, phone, email, tier, total_spent, visit_count,
        (SELECT MAX(created_at) FROM orders WHERE customer_id = customers.id) as last_visit
       FROM customers WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT 200`
    ).bind(since).all<CustomerContact>();

    if (!results || results.length === 0) {
      syncStatus.status = 'completed';
      syncStatus.last_sync = new Date().toISOString();
      return { success: true, synced: 0, errors: [] };
    }

    const batchSize = 20;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const contacts: MauticContactInput[] = batch.map(c => ({
        firstname: c.name || 'Unknown',
        email: c.email || `${c.phone || c.id}@aura-fnb.local`,
        mobile: c.phone || '',
        tier: c.tier || 'BASIC',
        total_spent: String(c.total_spent || 0),
        visit_count: String(c.visit_count || 0),
        last_visit: c.last_visit || '',
      }));

      try {
        const result = await client.syncContacts(contacts) as SyncContactsResponse;
        synced += result.created + result.updated;
        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors.map((e: { email: string; error: string }) => `Batch ${i}: ${e.error || e.email}`));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Batch ${i}: ${msg}`);
      }
    }

    syncStatus.contacts_synced += synced;
    syncStatus.status = 'completed';
    syncStatus.last_sync = new Date().toISOString();

    return { success: true, synced, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    syncStatus.status = 'failed';
    syncStatus.errors.push({ customer_id: 'batch', error: msg });
    return { success: false, synced, errors: [...errors, msg] };
  }
}
