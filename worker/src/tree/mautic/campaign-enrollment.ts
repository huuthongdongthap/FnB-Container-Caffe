/**
 * Mautic Bridge — Campaign enrollment (MASTER tier + new customers)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { createLogger } from '../../utils/logger.js';
import { getMauticClient } from './client-factory';
import { syncStatus } from './sync-state';
import type { MauticBridgeEnv, MauticClientDuck } from './types';

const log = createLogger({ route: 'mautic-bridge' });

export async function enrollCampaigns(env: MauticBridgeEnv): Promise<{ success: boolean; enrolled: number; errors: string[] }> {
  const client = getMauticClient(env) as MauticClientDuck | null;
  if (!client) {
    return { success: false, enrolled: 0, errors: ['Mautic not configured'] };
  }

  const db = env.AURA_DB;
  if (!db) {
    return { success: false, enrolled: 0, errors: ['Database not available'] };
  }

  let enrolled = 0;
  const errors: string[] = [];

  try {
    const { results: masterCustomers } = await db.prepare(
      "SELECT id, email, phone FROM customers WHERE tier = 'MASTER' AND (email != '' OR phone != '') LIMIT 100"
    ).all<{ id: string; email: string; phone: string }>();

    for (const customer of masterCustomers || []) {
      try {
        await client.addToCampaign(customer.email || customer.phone, 'vip-master');
        enrolled++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${customer.id}: ${msg}`);
      }
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { results: newCustomers } = await db.prepare(
      "SELECT id, email, phone FROM customers WHERE created_at >= ? AND (email != '' OR phone != '') LIMIT 100"
    ).bind(weekAgo).all<{ id: string; email: string; phone: string }>();

    for (const customer of newCustomers || []) {
      try {
        await client.addToCampaign(customer.email || customer.phone, 'welcome-series');
        enrolled++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${customer.id}: ${msg}`);
      }
    }

    syncStatus.campaigns_enrolled += enrolled;

    return { success: true, enrolled, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, enrolled, errors: [...errors, msg] };
  }
}
