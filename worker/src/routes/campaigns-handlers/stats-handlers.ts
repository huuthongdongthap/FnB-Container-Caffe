import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { ALL_TRIGGERS } from './constants';

export function registerCampaignStatsHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/campaigns/stats — aggregate stats from campaign_logs
  router.get('/stats/all', async (c) => {
    const db = c.env.AURA_DB;

    const { results } = await db.prepare(`
      SELECT
        trigger,
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
        MAX(sent_at) as last_run_at,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM campaign_logs
      GROUP BY trigger
      ORDER BY trigger
    `).all<{
      trigger: string;
      total_sent: number;
      success_count: number;
      last_run_at: string | null;
      unique_customers: number;
    }>();

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
