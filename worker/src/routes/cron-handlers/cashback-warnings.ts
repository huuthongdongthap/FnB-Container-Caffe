import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'cron' });

export async function sendCashbackExpiryWarnings(env: Record<string, unknown>): Promise<{ notified: number }> {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
    const now = new Date().toISOString();

    const { results: expiring } = await db.prepare(`
      SELECT ct.customer_id, c.phone, c.name, c.zalo, SUM(ct.amount) as total_expiring
      FROM cashback_transactions ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.type IN ('earn', 'bonus')
        AND ct.expires_at IS NOT NULL
        AND ct.expires_at <= ?
        AND ct.expires_at > datetime('now')
        AND (c.last_expiry_warning_at IS NULL OR c.last_expiry_warning_at < ?)
      GROUP BY ct.customer_id
    `).bind(sevenDaysFromNow, now).all<Record<string, unknown>>();

    for (const row of expiring) {
      const { notifyMember } = await import('../zalo.js');
      notifyMember(env, {
        customer_id: row.customer_id as string,
        template_key: 'cashback_expiring',
        data: { amount: row.total_expiring as number, days_left: 7, name: row.name as string } as Record<string, unknown>
      }).catch(() => {});

      await db.prepare('UPDATE customers SET last_expiry_warning_at = ? WHERE id = ?').bind(now, row.customer_id).run();
    }

    return { notified: expiring.length };
  } catch (err) {
    log.error('sendCashbackExpiryWarnings error:', { message: (err as Error).message });
    return { notified: 0 };
  }
}
