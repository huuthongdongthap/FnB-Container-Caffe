import { matchesTenantRow } from '../../lib/db';
import type { MixpostEnv } from './types';

const BUILTIN_TEMPLATES: Record<string, string> = {
  daily_special: 'Món đặc biệt hôm nay: {{item_name}} - {{price}}đ ({{today_orders}} đơn hôm nay)',
};

export async function resolveTemplate(
  template: string,
  envOrVars: MixpostEnv | Record<string, string>,
  tenantOrEnv: string | MixpostEnv = 'default',
  maybeTenantId?: string
): Promise<string> {
  const hasVariablesObj =
    typeof tenantOrEnv === 'object' && tenantOrEnv !== null;
  const variables = hasVariablesObj ? (envOrVars as Record<string, string>) : undefined;
  const env = (hasVariablesObj ? tenantOrEnv : envOrVars) as MixpostEnv;
  const tenantId = hasVariablesObj
    ? (typeof maybeTenantId === 'string' && maybeTenantId.trim() ? maybeTenantId.trim() : 'default')
    : (typeof tenantOrEnv === 'string' && tenantOrEnv.trim() ? tenantOrEnv.trim() : 'default');

  let content = BUILTIN_TEMPLATES[template] ?? template;
  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
    }
  }

  if (content.includes('{{total_customers}}') && env.AURA_DB) {
    let count = 0;
    if (tenantId !== '*') {
      try {
        const { results } = await env.AURA_DB.prepare('SELECT tenant_id FROM customers').all<Record<string, unknown>>();
        count = (results || []).filter((r) => matchesTenantRow(r, tenantId)).length;
      } catch {
        if (tenantId === 'default') {
          const res = await env.AURA_DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>();
          count = res?.count ?? 0;
        }
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
          "SELECT tenant_id FROM orders WHERE DATE(created_at) = ? AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'failed', 'rejected', 'expired', 'refunded')"
        ).bind(today).all<Record<string, unknown>>();
        count = (results || []).filter((r) => matchesTenantRow(r, tenantId)).length;
      } catch {
        if (tenantId === 'default') {
          const res = await env.AURA_DB.prepare(
            "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'"
          ).bind(today).first<{ count: number }>();
          count = res?.count ?? 0;
        }
      }
    } else {
      const res = await env.AURA_DB.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ? AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'failed', 'rejected', 'expired', 'refunded')"
      ).bind(today).first<{ count: number }>();
      count = res?.count ?? 0;
    }
    content = content.replace('{{today_orders}}', String(count));
  }

  return content;
}
