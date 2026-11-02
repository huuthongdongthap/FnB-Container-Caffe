import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import { ALL_TRIGGERS } from './constants';

interface AggregatedTriggerStats {
  trigger: string;
  total_sent: number;
  success_count: number;
  last_run_at: string | null;
  unique_customers: number;
}

async function queryTenantScopedCampaignStats(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string
): Promise<AggregatedTriggerStats[] | null> {
  try {
    const rawLogsRes = await db.prepare(
      'SELECT trigger, status, sent_at, customer_id, tenant_id FROM campaign_logs'
    ).all<{
      trigger: string;
      status: string;
      sent_at: string | null;
      customer_id: string | null;
      tenant_id?: string | null;
    }>().catch(async () => {
      return db.prepare(
        'SELECT trigger, status, sent_at, customer_id FROM campaign_logs'
      ).all<{
        trigger: string;
        status: string;
        sent_at: string | null;
        customer_id: string | null;
        tenant_id?: string | null;
      }>();
    });

    const logRows = rawLogsRes?.results || [];
    if (logRows.length === 0) {
      return tenantId === 'default' ? null : [];
    }

    const custTenantMap = new Map<string, string>();
    try {
      const custRes = await db.prepare('SELECT id, tenant_id FROM customers').all<{
        id: string;
        tenant_id?: string | null;
      }>();
      for (const c of custRes?.results || []) {
        if (c && c.id) {
          custTenantMap.set(c.id, (c.tenant_id && String(c.tenant_id).trim()) || 'default');
        }
      }
    } catch {
      // Optional tenant_id column on customers
    }

    const byTrigger = new Map<string, {
      total_sent: number;
      success_count: number;
      last_run_at: string | null;
      customers: Set<string>;
    }>();

    for (const row of logRows) {
      const directTenant = row.tenant_id && String(row.tenant_id).trim();
      const custTenant = row.customer_id ? custTenantMap.get(row.customer_id) : undefined;
      const resolvedTenant = directTenant || custTenant || 'default';
      if (resolvedTenant !== tenantId) continue;

      const entry = byTrigger.get(row.trigger) || {
        total_sent: 0,
        success_count: 0,
        last_run_at: null,
        customers: new Set<string>(),
      };
      entry.total_sent += 1;
      if (row.status === 'sent') {
        entry.success_count += 1;
      }
      if (row.sent_at && (!entry.last_run_at || row.sent_at > entry.last_run_at)) {
        entry.last_run_at = row.sent_at;
      }
      if (row.customer_id) {
        entry.customers.add(row.customer_id);
      }
      byTrigger.set(row.trigger, entry);
    }

    return Array.from(byTrigger.entries()).map(([trigger, v]) => ({
      trigger,
      total_sent: v.total_sent,
      success_count: v.success_count,
      last_run_at: v.last_run_at,
      unique_customers: v.customers.size,
    }));
  } catch {
    return tenantId === 'default' ? null : [];
  }
}

export function registerCampaignStatsHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/campaigns/stats — aggregate stats from campaign_logs
  router.get('/stats/all', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c as any);

    let results: AggregatedTriggerStats[] | null = null;
    if (tenantId !== '*') {
      results = await queryTenantScopedCampaignStats(db, tenantId);
    }

    if (results === null) {
      const { results: groupRows } = await db.prepare(`
        SELECT
          trigger,
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
          MAX(sent_at) as last_run_at,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM campaign_logs
        GROUP BY trigger
        ORDER BY trigger
      `).all<AggregatedTriggerStats>();
      results = groupRows || [];
    }

    const stats: Record<string, {
      total_sent: number;
      success_count: number;
      success_rate: number;
      last_run_at: string | null;
      unique_customers: number;
    }> = {};

    for (const trigger of ALL_TRIGGERS) {
      const row = results.find((r) => r.trigger === trigger);
      stats[trigger] = row
        ? {
          total_sent: row.total_sent,
          success_count: row.success_count,
          success_rate: row.total_sent > 0
            ? Math.round((row.success_count / row.total_sent) * 100)
            : 0,
          last_run_at: row.last_run_at,
          unique_customers: row.unique_customers
        }
        : {
          total_sent: 0,
          success_count: 0,
          success_rate: 0,
          last_run_at: null,
          unique_customers: 0
        };
    }

    return c.json({ success: true, data: stats });
  });
}
