/* eslint-disable no-console */
/**
 * Cron Route — SLA Overdue Order Check + Cashback Expiry Warning (Zalo ZNS)
 * Triggered by Cloudflare Cron (wrangler.toml: [triggers])
 * Uses AURA_DB (D1/SQLite) — no Supabase dependency
 */
import { notifyMember } from './zalo.js';

const SLA_MINUTES_DEFAULT = 15;

export async function checkOverdueOrders(env) {
  // Allow override via env.SLA_THRESHOLD_MINUTES (wrangler.toml [vars])
  const slaMinutes = Number.isFinite(Number(env.SLA_THRESHOLD_MINUTES)) && Number(env.SLA_THRESHOLD_MINUTES) > 0
    ? Number(env.SLA_THRESHOLD_MINUTES)
    : SLA_MINUTES_DEFAULT;

  console.log('[CRON] Checking overdue orders (SLA threshold:', slaMinutes, 'min)...');

  try {
    const db = env.AURA_DB;

    // Find orders stuck in "Dang pha che" beyond SLA threshold
    const cutoff = new Date(Date.now() - slaMinutes * 60 * 1000).toISOString();

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

/**
 * Cashback expiry warning — send Zalo ZNS to members with balance expiring within 7 days.
 * Triggered by cron (add to wrangler.toml triggers when Zalo OA is approved).
 */
export async function sendCashbackExpiryWarnings(env) {
  const db = env.AURA_DB;
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();

  let expiringSoon;
  try {
    expiringSoon = await db.prepare(`
      SELECT c.id AS customer_id, c.name,
             CAST(SUM(ct.amount) AS INTEGER) AS expiring_amount
      FROM customers c
      JOIN cashback_transactions ct ON ct.customer_id = c.id
      WHERE ct.type IN ('earn', 'bonus')
        AND ct.expires_at IS NOT NULL
        AND ct.expires_at <= ?
        AND ct.expires_at > datetime('now')
      GROUP BY c.id
      HAVING expiring_amount > 1000
    `).bind(sevenDaysFromNow).all();
  } catch (err) {
    console.error('[CRON] Expiry query failed:', err.message);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const row of (expiringSoon.results || [])) {
    const result = await notifyMember(env, {
      customer_id:  row.customer_id,
      template_key: 'cashback_expiry_warning',
      data: { amount: row.expiring_amount, days: 7 },
    }).catch(() => ({ ok: false }));

    if (result.ok) { sent++; } else { failed++; }
  }

  console.log(`[CRON] Expiry warnings: sent=${sent}, failed=${failed}, total=${expiringSoon.results?.length || 0}`);
  return { sent, failed };
}

/**
 * FIX 2: Scan stuck payments (>1hr pending) and alert via Telegram.
 * Detects amount-mismatch payments flagged by webhook in KV.
 */
export async function alertStuckPayments(env) {
  const db = env.AURA_DB;
  const kv = env.AUTH_KV;
  if (!kv || !db) {
    console.warn('[CRON] alertStuckPayments: missing AUTH_KV or AURA_DB');
    return { alerted: 0 };
  }

  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { results: stuckPayments } = await db.prepare(`
     SELECT p.id, p.order_id, p.amount, p.transaction_id, p.created_at,
            o.customer_name, o.customer_phone, o.total AS order_total
     FROM payments p
     LEFT JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'pending'
       AND p.created_at < ?
   `).bind(oneHourAgo).all();

    if (!stuckPayments.length) {
      console.log('[CRON] No stuck payments found.');
      return { alerted: 0 };
    }

    let alerted = 0;
    for (const p of stuckPayments) {
      const flagKey = `payment:stuck:${p.order_id}`;
      const flagRaw = await kv.get(flagKey);
      if (!flagRaw) {continue;}

      try {
        const flag = JSON.parse(flagRaw);
        console.warn(`[ALERT] Payment stuck >1hr | order=${p.order_id} | db=${p.amount} | webhook=${flag.webhookAmount}`);
        const { notifyTelegram } = await import('./orders.js');
        await notifyTelegram(env, {
          id: p.order_id,
          items: [],
          total: p.order_total || p.amount,
          customer_name: p.customer_name,
          customer_phone: p.customer_phone,
        }).catch(e => console.error('[CRON] Telegram alert failed:', e.message));
        alerted++;
        await kv.delete(flagKey);
      } catch (e) {
        console.error('[CRON] alertStuckPayments row error:', e.message);
      }
    }
    console.log(`[CRON] Stuck payment alerts: ${alerted}`);
    return { alerted };
  } catch (err) {
    console.error('[CRON] alertStuckPayments failed:', err.message);
    return { alerted: 0 };
  }
}
