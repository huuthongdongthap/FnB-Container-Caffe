import { createLogger } from '../../middleware/logger';
import { resolvePilotStore, matchesTenantRow } from '../../middleware/tenant';
import { createMetricsCollector } from '../../lib/metrics-collector';

const SLA_MINUTES_DEFAULT = 15;
const log = createLogger({ route: 'cron' });

export async function checkOverdueOrders(env: Record<string, unknown>, tenantOverride?: string): Promise<void> {
  const slaMinutes = Number.isFinite(Number(env.SLA_THRESHOLD_MINUTES)) && Number(env.SLA_THRESHOLD_MINUTES) > 0
    ? Number(env.SLA_THRESHOLD_MINUTES)
    : SLA_MINUTES_DEFAULT;
  const tenantId = tenantOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);

  log.info('Checking overdue orders (SLA threshold:', { minutes: slaMinutes });

  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const cutoff = new Date(Date.now() - slaMinutes * 60 * 1000).toISOString();
    const scoped = Boolean(tenantId && tenantId !== '*');

    let overdue: Array<Record<string, unknown>> = [];
    if (scoped && tenantId) {
      try {
        const scopedRes = await db.prepare(`
          SELECT id, customer_name, status, created_at, tenant_id
          FROM orders
          WHERE status IN ('pending', 'confirmed', 'preparing', 'Bep tiep nhan', 'Dang pha che')
            AND created_at < ?
            AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
            AND (notes IS NULL OR notes NOT LIKE '%[OVERDUE]%')
        `).bind(cutoff, tenantId).all<Record<string, unknown>>();
        overdue = (scopedRes.results || []).filter(
          (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
        );
      } catch {
        const unscoped = await db.prepare(`
          SELECT id, customer_name, status, created_at
          FROM orders
          WHERE status IN ('pending', 'confirmed', 'preparing', 'Bep tiep nhan', 'Dang pha che')
            AND created_at < ?
            AND (notes IS NULL OR notes NOT LIKE '%[OVERDUE]%')
        `).bind(cutoff).all<Record<string, unknown>>();
        overdue = (unscoped.results || []).filter((row) =>
          'tenant_id' in row ? matchesTenantRow(row, tenantId) : tenantId === 'default'
        );
      }
    } else {
      const unscoped = await db.prepare(`
        SELECT id, customer_name, status, created_at
        FROM orders
        WHERE status IN ('pending', 'confirmed', 'preparing', 'Bep tiep nhan', 'Dang pha che')
          AND created_at < ?
          AND (notes IS NULL OR notes NOT LIKE '%[OVERDUE]%')
      `).bind(cutoff).all<Record<string, unknown>>();
      overdue = (unscoped.results || []).filter(
        (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
      );
    }

    if (!overdue.length) {
      log.info('No overdue orders found.');
      return;
    }

    log.info('Found overdue orders', { count: overdue.length });

    // Metrics: record order_stuck count + raise a Telegram-dispatchable alert.
    // The alert pipeline (cron-admin dispatchAlerts) delivers via Telegram when
    // TELEGRAM_BOT_TOKEN/CHAT_ID are configured; cooldown prevents repeat noise
    // for the same ongoing breach.
    const effectiveAlertTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
    const alertKey =
      effectiveAlertTenant === 'default'
        ? 'kds_sla_breach'
        : `kds_sla_breach:${effectiveAlertTenant}`;
    const mc = createMetricsCollector(db);
    await mc.recordMetric('order_stuck', overdue.length, { tenant_id: effectiveAlertTenant }).catch(() => {});
    await mc.recordAlert(
      alertKey,
      `${overdue.length} đơn vượt SLA ${slaMinutes} phút — kiểm tra KDS`,
      { severity: 'warning', cooldownMinutes: 30 }
    ).catch(() => {});

    const now = new Date().toISOString();
    if (tenantId && tenantId !== '*') {
      try {
        const scopedStmts = overdue.map(order =>
          db.prepare("UPDATE orders SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind('[OVERDUE]', '[OVERDUE]', now, order.id, tenantId)
        );
        await db.batch(scopedStmts);
        return;
      } catch {
        if (tenantId !== 'default') {
          return;
        }
      }
    }
    const stmts = overdue.map(order =>
      db.prepare('UPDATE orders SET notes = CASE WHEN notes IS NULL OR notes = \'\' THEN ? ELSE notes || \' | \' || ? END, updated_at = ? WHERE id = ?')
        .bind('[OVERDUE]', '[OVERDUE]', now, order.id)
    );
    await db.batch(stmts);
  } catch (err) {
    log.error('checkOverdueOrders error:', { message: (err as Error).message });
  }
}

export async function checkInventoryAlerts(env: Record<string, unknown>, tenantOverride?: string): Promise<number> {
  const tenantId = tenantOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    let items: Array<Record<string, unknown>> = [];
    try {
      const res = await db.prepare(`
        SELECT id, name, quantity, min_quantity, tenant_id
        FROM inventory_items
        WHERE quantity <= min_quantity
          AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
      `).bind(tenantId, tenantId).all<Record<string, unknown>>();
      items = (res.results || []).filter(
        (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
      );
    } catch {
      const res = await db.prepare(`
        SELECT id, name, quantity, min_quantity
        FROM inventory_items
        WHERE quantity <= min_quantity
      `).all<Record<string, unknown>>();
      items = (res.results || []).filter(
        (row) => !('tenant_id' in row) || matchesTenantRow(row, tenantId)
      );
    }

    const cutoffIso = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    let notified = 0;

    for (const item of items) {
      const itemId = String(item.id ?? '');
      if (!itemId) continue;
      const itemTenantId = typeof item.tenant_id === 'string' && item.tenant_id.trim()
        ? item.tenant_id.trim()
        : (tenantId === '*' ? 'default' : tenantId);

      let recent: Record<string, unknown> | null = null;
      try {
        recent = await db.prepare(`
          SELECT id FROM inventory_alerts
          WHERE item_id = ? AND notified_at > ?
            AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
          LIMIT 1
        `).bind(itemId, cutoffIso, itemTenantId, itemTenantId).first<Record<string, unknown>>();
      } catch {
        recent = await db.prepare(`
          SELECT id FROM inventory_alerts
          WHERE item_id = ? AND notified_at > ?
          LIMIT 1
        `).bind(itemId, cutoffIso).first<Record<string, unknown>>().catch(() => null);
      }
      if (recent) continue;

      const qty = Number(item.quantity ?? 0);
      const minQty = Number(item.min_quantity ?? 0);
      const alertType = qty <= 0 ? 'out_of_stock' : 'low_stock';
      const now = new Date().toISOString();

      try {
        await db.prepare(
          'INSERT INTO inventory_alerts (item_id, alert_type, current_qty, threshold, notified_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(itemId, alertType, qty, minQty, now, itemTenantId).run();
      } catch {
        await db.prepare(
          'INSERT INTO inventory_alerts (item_id, alert_type, current_qty, threshold, notified_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(itemId, alertType, qty, minQty, now).run().catch(() => {});
      }
      notified++;
    }

    return notified;
  } catch (err) {
    log.error('checkInventoryAlerts error:', { message: (err as Error).message });
    return 0;
  }
}
