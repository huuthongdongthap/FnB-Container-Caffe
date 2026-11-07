/**
 * Mautic Bridge — Campaign enrollment (MASTER tier + new customers)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { getMauticClient } from './client-factory';
import { isAlreadyEnrolled, trackEnrollment } from './enrollment-tracker';
import { getSyncStatus, matchesMauticTenant } from './sync-state';
import type { MauticBridgeEnv, MauticClientDuck } from './types';

export async function enrollCampaigns(
  env: MauticBridgeEnv,
  tenantId?: string
): Promise<{ success: boolean; enrolled: number; errors: string[] }> {
  const client = getMauticClient(env) as MauticClientDuck | null;
  if (!client) {
    return { success: false, enrolled: 0, errors: ['Mautic not configured'] };
  }

  const db = env.AURA_DB;
  if (!db) {
    return { success: false, enrolled: 0, errors: ['Database not available'] };
  }

  const state = getSyncStatus(tenantId);
  let enrolled = 0;
  const errors: string[] = [];

  try {
    const rawTenant = !tenantId || !tenantId.trim() ? 'default' : tenantId.trim();
    const normalizedTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
    const isWildcard = normalizedTenant === '*';
    const tenantSql = isWildcard ? '' : " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
    const tenantParams = isWildcard ? [] : [normalizedTenant];

    let masterCustomers: Array<{ id: string; email: string; phone: string }> = [];
    try {
      const stmt = db.prepare(
        `SELECT id, email, phone, tenant_id FROM customers WHERE tier = 'MASTER' AND (email != '' OR phone != '')${tenantSql} LIMIT 100`
      );
      const bound = tenantParams.length > 0 && typeof (stmt as any).bind === 'function' ? stmt.bind(...tenantParams) : stmt;
      const res = await bound.all<{ id: string; email: string; phone: string }>();
      masterCustomers = (res.results || []).filter((r) =>
        matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
      );
    } catch (colErr) {
      const msg = String((colErr as Error)?.message || '');
      if (msg.includes('no such column')) {
        try {
          const stmt = db.prepare(
            `SELECT id, email, phone, tenant_id FROM customers WHERE LOWER(loyalty_tier) IN ('platinum', 'master') AND (email != '' OR phone != '')${tenantSql} LIMIT 100`
          );
          const bound = tenantParams.length > 0 && typeof (stmt as any).bind === 'function' ? stmt.bind(...tenantParams) : stmt;
          const fallbackTenant = await bound.all<{ id: string; email: string; phone: string }>();
          masterCustomers = (fallbackTenant.results || []).filter((r) =>
            matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
          );
        } catch {
          if (isWildcard || normalizedTenant === 'default') {
            const fallback = await db.prepare(
              'SELECT id, email, phone FROM customers WHERE LOWER(loyalty_tier) IN (\'platinum\', \'master\') AND (email != \'\' OR phone != \'\') LIMIT 100'
            ).all<{ id: string; email: string; phone: string }>();
            masterCustomers = (fallback.results || []).filter((r) =>
              matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
            );
          } else {
            masterCustomers = [];
          }
        }
      } else {
        throw colErr;
      }
    }

    for (const customer of masterCustomers || []) {
      try {
        const rawCustomerTenant = typeof (customer as unknown as Record<string, unknown>).tenant_id === 'string' &&
          ((customer as unknown as Record<string, unknown>).tenant_id as string).trim() &&
          ((customer as unknown as Record<string, unknown>).tenant_id as string).trim() !== '*'
          ? ((customer as unknown as Record<string, unknown>).tenant_id as string).trim()
          : 'default';
        const rowTenant = isWildcard ? rawCustomerTenant : normalizedTenant;
        let alreadyEnrolled = false;
        try {
          alreadyEnrolled = await isAlreadyEnrolled(db, customer.id, 'vip-master', 30, rowTenant);
        } catch {
          alreadyEnrolled = false;
        }
        if (alreadyEnrolled) {
          continue;
        }
        await client.addToCampaign(customer.email || customer.phone, 'vip-master');
        try {
          await trackEnrollment(db, customer.id, 'vip-master', 'vip-master', 0, 'enrolled', rowTenant);
        } catch {
          // Best-effort enrollment tracking
        }
        enrolled++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${customer.id}: ${msg}`);
      }
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    let newCustomersRaw: Array<{ id: string; email: string; phone: string }> | undefined;
    try {
      const res = await db.prepare(
        `SELECT id, email, phone, tenant_id FROM customers WHERE created_at >= ? AND (email != '' OR phone != '')${tenantSql} LIMIT 100`
      ).bind(weekAgo, ...tenantParams).all<{ id: string; email: string; phone: string }>();
      newCustomersRaw = res.results;
    } catch {
      if (isWildcard || normalizedTenant === 'default') {
        const res = await db.prepare(
          'SELECT id, email, phone FROM customers WHERE created_at >= ? AND (email != \'\' OR phone != \'\') LIMIT 100'
        ).bind(weekAgo).all<{ id: string; email: string; phone: string }>();
        newCustomersRaw = res.results;
      } else {
        newCustomersRaw = [];
      }
    }
    const newCustomers = (newCustomersRaw || []).filter((r) =>
      matchesMauticTenant(r as unknown as Record<string, unknown>, tenantId)
    );

    for (const customer of newCustomers || []) {
      try {
        const rawCustomerTenant = typeof (customer as unknown as Record<string, unknown>).tenant_id === 'string' &&
          ((customer as unknown as Record<string, unknown>).tenant_id as string).trim() &&
          ((customer as unknown as Record<string, unknown>).tenant_id as string).trim() !== '*'
          ? ((customer as unknown as Record<string, unknown>).tenant_id as string).trim()
          : 'default';
        const rowTenant = isWildcard ? rawCustomerTenant : normalizedTenant;
        let alreadyEnrolled = false;
        try {
          alreadyEnrolled = await isAlreadyEnrolled(db, customer.id, 'welcome-series', 30, rowTenant);
        } catch {
          alreadyEnrolled = false;
        }
        if (alreadyEnrolled) {
          continue;
        }
        await client.addToCampaign(customer.email || customer.phone, 'welcome-series');
        try {
          await trackEnrollment(db, customer.id, 'welcome-series', 'welcome-series', 0, 'enrolled', rowTenant);
        } catch {
          // Best-effort enrollment tracking
        }
        enrolled++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${customer.id}: ${msg}`);
      }
    }

    state.campaigns_enrolled += enrolled;

    return { success: true, enrolled, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, enrolled, errors: [...errors, msg] };
  }
}
