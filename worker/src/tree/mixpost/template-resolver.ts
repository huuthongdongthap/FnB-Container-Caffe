import { matchesTenantRow } from '../../lib/db';
import type { MixpostEnv } from './types';

export async function resolveTemplate(template: string, env: MixpostEnv, tenantId = 'default'): Promise<string> {
  let content = template;

  if (content.includes('{{total_customers}}') && env.AURA_DB) {
    let count = 0;
    if (tenantId !== '*') {
      try {
        const { results } = await env.AURA_DB.prepare('SELECT tenant_id FROM customers').all<Record<string, unknown>>();
        count = (results || []).filter((r) => matchesTenantRow(r, tenantId)).length;
      } catch {
        const res = await env.AURA_DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>();
        count = res?.count ?? 0;
      }
    } else {
      const res = await env.AURA_DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>();
      count = res?.count ?? 0;
    }
    content = content.replace('{{total_customers}}', String(count));
  }

  if (content.includes('{{today_orders}}') && env.AURA_DB) {
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;
    if (tenantId !== '*') {
      try {
        const { results } = await env.AURA_DB.prepare(
          "SELECT tenant_id FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'"
        ).bind(today).all<Record<string, unknown>>();
        count = (results || []).filter((r) => matchesTenantRow(r, tenantId)).length;
      } catch {
        const res = await env.AURA_DB.prepare(
          "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'"
        ).bind(today).first<{ count: number }>();
        count = res?.count ?? 0;
      }
    } else {
      const res = await env.AURA_DB.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'"
      ).bind(today).first<{ count: number }>();
      count = res?.count ?? 0;
    }
    content = content.replace('{{today_orders}}', String(count));
  }

  return content;
}
