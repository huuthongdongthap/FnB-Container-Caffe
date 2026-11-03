/**
 * Mautic Bridge — Cron-scheduled full contact sync
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { createMauticClient } from '../../lib/mautic-client';
import type { MauticBatchResult } from '../../lib/mautic-client';
import type { KVNamespace, D1Database } from '@cloudflare/workers-types';
import { resolvePilotStore, matchesTenantRow } from '../../middleware/tenant';
import { toMauticContact } from './contact-mapper';
import { syncSegments } from './segment-sync';

export async function syncMauticContacts(env: Record<string, unknown>, tenantOverride?: string): Promise<{ synced: number; skipped?: boolean }> {
  const client = createMauticClient({
    MAUTIC_BASE_URL: env.MAUTIC_BASE_URL as string,
    MAUTIC_CLIENT_ID: env.MAUTIC_CLIENT_ID as string,
    MAUTIC_CLIENT_SECRET: env.MAUTIC_CLIENT_SECRET as string
  });
  if (!client) {
    return { synced: 0, skipped: true };
  }

  const db = env.AURA_DB as D1Database | undefined;
  if (!db) {
    return { synced: 0, skipped: true };
  }

  const tenantId = tenantOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  const isScopedTenant = Boolean(tenantId && tenantId !== 'default' && tenantId !== '*');
  const syncKvKey = isScopedTenant ? `mautic_last_sync_ts:${tenantId}` : 'mautic_last_sync_ts';
  const kv = env.AUTH_KV as KVNamespace | undefined;
  const lastSyncTs: string | null = kv ? await kv.get(syncKvKey) : null;
  const since = lastSyncTs || new Date(Date.now() - 3600000).toISOString();

  let results: Record<string, unknown>[] | undefined;
  if (isScopedTenant) {
    try {
      const res = await db.prepare(
        `SELECT c.phone, c.name, c.email, c.loyalty_tier, c.date_of_birth as birthday,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?2) as last_order_date,
          (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id AND COALESCE(NULLIF(TRIM(o2.tenant_id), ''), 'default') = ?2) as total_orders,
          c.updated_at
         FROM customers c
         WHERE c.updated_at > ?1
           AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?2
         ORDER BY c.updated_at ASC
         LIMIT 500`
      ).bind(since, tenantId).all();
      results = (res.results || []) as Array<Record<string, unknown>>;
    } catch (err) {
      const msg = String((err as Error)?.message || '');
      if (msg.includes('column')) {
        return { synced: 0, errors: 0 } as { synced: number; errors?: number; skipped?: boolean };
      } else {
        throw err;
      }
    }
  } else if (tenantId === 'default') {
    try {
      const res = await db.prepare(
        `SELECT c.phone, c.name, c.email, c.loyalty_tier, c.date_of_birth as birthday, c.tenant_id,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?2) as last_order_date,
          (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id AND COALESCE(NULLIF(TRIM(o2.tenant_id), ''), 'default') = ?2) as total_orders,
          c.updated_at
         FROM customers c
         WHERE c.updated_at > ?1
           AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?2
         ORDER BY c.updated_at ASC
         LIMIT 500`
      ).bind(since, tenantId).all();
      results = ((res.results || []) as Array<Record<string, unknown>>).filter(
        (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
      );
    } catch {
      try {
        const res = await db.prepare(
          `SELECT c.phone, c.name, c.email, c.loyalty_tier, c.date_of_birth as birthday,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date,
            (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id) as total_orders,
            c.updated_at
           FROM customers c
           WHERE c.updated_at > ?
           ORDER BY c.updated_at ASC
           LIMIT 500`
        ).bind(since).all();
        results = ((res.results || []) as Array<Record<string, unknown>>).filter(
          (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
        );
      } catch (err) {
        const msg = String((err as Error)?.message || '');
        if (msg.includes('column')) {
          const res = await db.prepare(
            `SELECT c.phone, c.name, c.email, c.tier as loyalty_tier, NULL as birthday,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date,
              (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id) as total_orders,
              c.created_at as updated_at
             FROM customers c
             WHERE c.created_at > ?
             ORDER BY c.created_at ASC
             LIMIT 500`
          ).bind(since).all();
          results = ((res.results || []) as Array<Record<string, unknown>>).filter(
            (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
          );
        } else {
          throw err;
        }
      }
    }
  } else {
    try {
      const res = await db.prepare(
        `SELECT c.phone, c.name, c.email, c.loyalty_tier, c.date_of_birth as birthday,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date,
          (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id) as total_orders,
          c.updated_at
         FROM customers c
         WHERE c.updated_at > ?
         ORDER BY c.updated_at ASC
         LIMIT 500`
      ).bind(since).all();
      results = ((res.results || []) as Array<Record<string, unknown>>).filter(
        (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
      );
    } catch (err) {
      const msg = String((err as Error)?.message || '');
      if (msg.includes('column')) {
        const res = await db.prepare(
          `SELECT c.phone, c.name, c.email, c.tier as loyalty_tier, NULL as birthday,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_order_date,
            (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_id = c.id) as total_orders,
            c.created_at as updated_at
           FROM customers c
           WHERE c.created_at > ?
           ORDER BY c.created_at ASC
           LIMIT 500`
        ).bind(since).all();
        results = ((res.results || []) as Array<Record<string, unknown>>).filter(
          (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
        );
      } else {
        throw err;
      }
    }
  }

  const customers = (results || []) as Array<Record<string, unknown>>;
  if (customers.length === 0) {
    if (kv) {
      await kv.put(syncKvKey, new Date().toISOString());
    }
    return { synced: 0 };
  }

  let synced = 0;
  const batchSize = 50;
  const contactIdMap: Record<string, number> = {};

  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    const contacts = batch.map(c => toMauticContact(c));

    try {
      const result: MauticBatchResult = await client.batchUpsertContacts(contacts);
      const created = result?.created || [];
      const updated = result?.updated || [];
      synced += created.length + updated.length;

      for (const item of created) {
        const email = item.email as string | undefined;
        if (email) {
          contactIdMap[email] = item.id as number;
        }
      }
      for (const item of updated) {
        const email = item.email as string | undefined;
        if (email) {
          contactIdMap[email] = item.id as number;
        }
      }
    } catch {
      // continue to next batch
    }
  }

  try {
    await syncSegments(env, client, customers, contactIdMap);
  } catch {
    // segment sync is best-effort
  }

  if (kv) {
    await kv.put(syncKvKey, new Date().toISOString());
  }
  return { synced };
}
