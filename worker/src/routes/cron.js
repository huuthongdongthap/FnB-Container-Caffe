/* eslint-disable no-console */
/**
 * Cron Route — SLA Overdue Order Check + Cashback Expiry Warning + Odoo Retry Queue
 * Triggered by Cloudflare Cron (wrangler.toml: [triggers])
 * Uses AURA_DB (D1/SQLite) — no Supabase dependency
 */
import { notifyMember } from './zalo.js';
import { createOdooClient } from '../clients/odoo-client.js';

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
 * Phase 1: Odoo Retry Queue
 * Process failed Odoo syncs every 5 minutes.
 * Retries up to 3 attempts total before giving up.
 */
export async function processOdooRetryQueue(env) {
  const db = env.AURA_DB;
  const odooClient = createOdooClient(env);

  if (!odooClient) {
    console.log('[CRON] Odoo not configured, skipping retry queue');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  try {
    // Find failed mappings with attempts < 3
    const { results: failedMappings } = await db.prepare(`
      SELECT id, local_type, local_id, odoo_model, attempts, error_message
      FROM odoo_mappings
      WHERE sync_status = 'failed' AND attempts < 3
      ORDER BY last_synced_at ASC
      LIMIT 20
    `).all();

    if (!failedMappings?.length) {
      console.log('[CRON] No failed Odoo mappings to retry');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`[CRON] Processing ${failedMappings.length} failed Odoo mappings...`);

    let succeeded = 0;
    let failed = 0;
    const startTimes = new Map();

    for (const mapping of failedMappings) {
      const mappingId = mapping.id;
      startTimes.set(mappingId, Date.now());

      try {
        if (mapping.local_type === 'order') {
          // Retry invoice creation for orders
          const orderResult = await db.prepare(`
            SELECT id, status, total, customer_name, customer_email, customer_phone, items
            FROM orders WHERE id = ?
          `).bind(mapping.local_id).first();

          if (!orderResult) {
            console.warn(`[CRON] Order ${mapping.local_id} not found, skipping`);
            await logOdooSyncAttempt(db, mappingId, mapping.attempts + 1, 'failed', 'Order not found', 0);
            failed++;
            continue;
          }

          let items;
          try {
            items = typeof orderResult.items === 'string' ? JSON.parse(orderResult.items) : orderResult.items;
          } catch (e) {
            console.error(`[CRON] Invalid items for order ${mapping.local_id}:`, e.message);
            await logOdooSyncAttempt(db, mappingId, mapping.attempts + 1, 'failed', `Invalid items: ${e.message}`, 0);
            failed++;
            continue;
          }

          // Retry via OdooClient.createInvoice (idempotent)
          await odooClient.createInvoice(orderResult, items);

          // Log success
          const latency = Date.now() - startTimes.get(mappingId);
          await logOdooSyncAttempt(db, mappingId, mapping.attempts + 1, 'success', null, latency);
          succeeded++;
          console.log(`[CRON] Retry succeeded for order ${mapping.local_id}`);
        } else {
          // Other local_types (customer, product) not yet implemented in Phase 1
          console.log(`[CRON] Skipping unsupported local_type: ${mapping.local_type}`);
          await logOdooSyncAttempt(db, mappingId, mapping.attempts + 1, 'failed', `Unsupported local_type: ${mapping.local_type}`, 0);
          failed++;
        }
      } catch (retryErr) {
        failed++;
        const latency = Date.now() - startTimes.get(mappingId);
        console.error(`[CRON] Retry failed for mapping ${mapping.id} (${mapping.local_type}/${mapping.local_id}):`, retryErr.message);

        // Log failure to odoo_sync_logs
        await logOdooSyncAttempt(db, mappingId, mapping.attempts + 1, 'failed', retryErr.message, latency);

        // Update mapping with new error
        try {
          await db.prepare(`
            UPDATE odoo_mappings
            SET sync_status = 'failed',
                error_message = ?,
                attempts = attempts + 1,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(retryErr.message, mappingId).run();
        } catch (updateErr) {
          console.error('[CRON] Failed to update mapping after retry:', updateErr.message);
        }
      }
    }

    console.log(`[CRON] Odoo retry queue: ${succeeded} succeeded, ${failed} failed`);
    return { processed: failedMappings.length, succeeded, failed };

  } catch (err) {
    console.error('[CRON] Odoo retry queue failed:', err.message);
    return { processed: 0, succeeded: 0, failed: 0 };
  }
}

/**
 * Helper: Insert a sync attempt log into odoo_sync_logs
 * @param {Object} db - D1 database connection
 * @param {number} mappingId - odoo_mappings.id
 * @param {number} attempt - Attempt number (1-indexed)
 * @param {string} status - 'success' or 'failed'
 * @param {string|null} errorMessage - Error message if failed
 * @param {number} latencyMs - Request latency in milliseconds
 */
async function logOdooSyncAttempt(db, mappingId, attempt, status, errorMessage, latencyMs) {
  try {
    await db.prepare(`
      INSERT INTO odoo_sync_logs (mapping_id, attempt, status, error_message, latency_ms, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(mappingId, attempt, status, errorMessage, latencyMs).run();
  } catch (logErr) {
    // Logging failure should not break retry flow
    console.error('[CRON] Failed to insert sync log:', logErr.message);
  }
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
