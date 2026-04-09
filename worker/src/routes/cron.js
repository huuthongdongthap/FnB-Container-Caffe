/**
 * Cron Route — SLA Overdue Order Check
 * Triggered by Cloudflare Cron (wrangler.toml: [triggers])
 * Uses AURA_DB (D1/SQLite) — no Supabase dependency
 */

const SLA_MINUTES = 15;

export async function checkOverdueOrders(env) {
  console.log('[CRON] Checking overdue orders (SLA threshold:', SLA_MINUTES, 'min)...');

  try {
    const db = env.AURA_DB;

    // Find orders stuck in "Dang pha che" beyond SLA threshold
    const cutoff = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();

    const { results: overdue } = await db.prepare(`
      SELECT id, customer_name, status, created_at
      FROM orders
      WHERE status IN ('Bep tiep nhan', 'Dang pha che')
        AND created_at < ?
    `).bind(cutoff).all();

    if (!overdue.length) {
      console.log('[CRON] No overdue orders found.');
      return;
    }

    console.log(`[CRON] Found ${overdue.length} overdue order(s). Escalating...`);

    // Mark overdue orders — append "(Qua SLA)" note to status
    const now = new Date().toISOString();
    const stmts = overdue.map(order =>
      db.prepare(`
        UPDATE orders
        SET notes = COALESCE(notes || ' ', '') || '[SLA OVERDUE]',
            updated_at = ?
        WHERE id = ?
      `).bind(now, order.id)
    );

    await db.batch(stmts);
    console.log(`[CRON] Escalated ${stmts.length} order(s) successfully.`);

  } catch (err) {
    console.error('[CRON] SLA check failed:', err.message);
  }
}
