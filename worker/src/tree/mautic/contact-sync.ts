/**
 * Mautic Bridge — Contact sync (batch upsert from DB to Mautic)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { getMauticClient } from './client-factory';
import { getSyncStatus, matchesMauticTenant } from './sync-state';
import type { MauticContactInput } from '../../lib/mautic-client';
import type { CustomerContact, SyncContactsResponse, MauticBridgeEnv, MauticClientDuck } from './types';

export async function syncContacts(
  env: MauticBridgeEnv,
  tenantId?: string
): Promise<{ success: boolean; synced: number; errors: string[] }> {
  const client = getMauticClient(env) as MauticClientDuck | null;
  if (!client) {
    return { success: false, synced: 0, errors: ['Mautic not configured'] };
  }

  const db = env.AURA_DB;
  if (!db) {
    return { success: false, synced: 0, errors: ['Database not available'] };
  }

  const state = getSyncStatus(tenantId);
  state.status = 'running';
  state.errors = [];
  let synced = 0;
  const errors: string[] = [];

  try {
    const since = state.last_sync || new Date(Date.now() - 3600000).toISOString();
    const normalizedTenant = !tenantId || !tenantId.trim() ? 'default' : tenantId.trim();
    const isWildcard = normalizedTenant === '*';
    const tenantSql = isWildcard ? '' : " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
    const tenantParams = isWildcard ? [] : [normalizedTenant];

    let results: CustomerContact[] = [];
    try {
      const res = await db.prepare(
        `SELECT id, name, phone, email, tier, total_spent, visit_count, tenant_id,
          (SELECT MAX(created_at) FROM orders WHERE customer_id = customers.id AND COALESCE(NULLIF(TRIM(orders.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(customers.tenant_id), ''), 'default')) as last_visit
         FROM customers WHERE updated_at >= ?${tenantSql} ORDER BY updated_at ASC LIMIT 200`
      ).bind(since, ...tenantParams).all<CustomerContact>();
      results = (res.results || []).filter((r) =>
        matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
      );
    } catch (colErr) {
      const msg = String((colErr as Error)?.message || '');
      if (msg.includes('no such column')) {
        try {
          const fallbackTenant = await db.prepare(
            `SELECT id, name, phone, email, loyalty_tier as tier, total_spent, loyalty_points as visit_count, tenant_id,
              (SELECT MAX(created_at) FROM orders WHERE customer_id = customers.id AND COALESCE(NULLIF(TRIM(orders.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(customers.tenant_id), ''), 'default')) as last_visit
             FROM customers WHERE updated_at >= ?${tenantSql} ORDER BY updated_at ASC LIMIT 200`
          ).bind(since, ...tenantParams).all<CustomerContact>();
          results = (fallbackTenant.results || []).filter((r) =>
            matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
          );
        } catch {
          if (isWildcard || normalizedTenant === 'default') {
            const fallback = await db.prepare(
              `SELECT id, name, phone, email, loyalty_tier as tier, total_spent, loyalty_points as visit_count,
                (SELECT MAX(created_at) FROM orders WHERE customer_id = customers.id) as last_visit
               FROM customers WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT 200`
            ).bind(since).all<CustomerContact>();
            results = (fallback.results || []).filter((r) =>
              matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
            );
          } else {
            results = [];
          }
        }
      } else {
        throw colErr;
      }
    }

    if (!results || results.length === 0) {
      state.status = 'completed';
      state.last_sync = new Date().toISOString();
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
        last_visit: c.last_visit || ''
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

    state.contacts_synced += synced;
    state.status = 'completed';
    state.last_sync = new Date().toISOString();

    return { success: true, synced, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    state.status = 'failed';
    state.errors.push({ customer_id: 'batch', error: msg });
    return { success: false, synced, errors: [...errors, msg] };
  }
}
