import { createLogger } from '../../middleware/logger';
import { resolvePilotStore, matchesTenantRow } from '../../middleware/tenant';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { resolvePayosReconcileCredentials } from '../../lib/merchant-payment';
type ResolvedPayosCredentials = NonNullable<Awaited<ReturnType<typeof resolvePayosReconcileCredentials>>>;
import {
  PAYOS_API,
  extractPayOSLinkId,
  verifyPayOSPaymentRequest,
} from '../../../../packages/domain/payment/commands/payos-provider-verify';
import { reconcilePayOSPayment } from '../../../../packages/domain/payment/commands/payos-reconcile';
import { isHeldOutOfKds } from '@aura/domain-kitchen';
import type { Env } from '../../types/env';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';

const SLA_MINUTES_DEFAULT = 15;
const OVERDUE_MAX_AGE_HOURS_DEFAULT = 24;
const UNPAID_ONLINE_TTL_MINUTES_DEFAULT = 30;
const log = createLogger({ route: 'cron' });

const OVERDUE_STATUS_CLAUSE = "status IN ('pending', 'confirmed', 'preparing', 'Bep tiep nhan', 'Dang pha che')";

const OVERDUE_COLUMN_SETS = [
  'items, notes, payment_method, payment_status, order_type, is_cod',
  'items, notes, payment_method, payment_status, order_type',
  'items, notes, payment_method, payment_status',
  'items, notes, payment_status, order_type',
  'items, notes',
  '',
] as const;

async function fetchOverdueCandidates(
  db: import('@cloudflare/workers-types').D1Database,
  minCreatedAt: string,
  cutoff: string,
  tenantId: string,
  scoped: boolean,
): Promise<Array<Record<string, unknown>>> {
  const runCascade = async (includeTenantColumn: boolean, filterTenant: boolean): Promise<Array<Record<string, unknown>> | null> => {
    const tenantSelect = includeTenantColumn ? ', tenant_id' : '';
    const tenantWhere = filterTenant ? "\n            AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?" : '';
    for (const extraCols of OVERDUE_COLUMN_SETS) {
      const colList = `id, customer_name, status, created_at${tenantSelect}${extraCols ? `, ${extraCols}` : ''}`;
      try {
        const stmt = db.prepare(`
          SELECT ${colList}
          FROM orders
          WHERE ${OVERDUE_STATUS_CLAUSE}
            AND datetime(created_at) >= datetime(?)
            AND datetime(created_at) < datetime(?)${tenantWhere}
        `);
        const res = await (
          filterTenant
            ? stmt.bind(minCreatedAt, cutoff, tenantId)
            : stmt.bind(minCreatedAt, cutoff)
        ).all<Record<string, unknown>>();
        return (res.results || []).filter(
          (row) => matchesTenantRow(row, tenantId) && !isHeldOutOfKds(row),
        );
      } catch {
        // Column absent in partial schema: step down while keeping payment/item hold columns where possible
      }
    }
    return null;
  };

  if (scoped && tenantId) {
    const scopedRows = await runCascade(true, true);
    if (scopedRows !== null) return scopedRows;
    if (tenantId === 'default') {
      const unscopedRows = await runCascade(false, false);
      if (unscopedRows !== null) return unscopedRows;
    }
    return [];
  }

  const withTenantRows = await runCascade(true, false);
  if (withTenantRows !== null) return withTenantRows;
  const legacyRows = await runCascade(false, false);
  return legacyRows ?? [];
}

export async function checkOverdueOrders(env: Record<string, unknown>, tenantOverride?: string): Promise<void> {
  const slaMinutes = Number.isFinite(Number(env.SLA_THRESHOLD_MINUTES)) && Number(env.SLA_THRESHOLD_MINUTES) > 0
    ? Number(env.SLA_THRESHOLD_MINUTES)
    : SLA_MINUTES_DEFAULT;
  const rawOverride = typeof tenantOverride === 'string' ? tenantOverride.trim() : '';
  const normalizedOverride = rawOverride.toLowerCase() === 'hq' ? '*' : rawOverride;
  const rawTenant = normalizedOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;

  log.info('Checking overdue orders (SLA threshold:', { minutes: slaMinutes });

  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const maxAgeHours =
      Number.isFinite(Number(env.OVERDUE_MAX_AGE_HOURS)) && Number(env.OVERDUE_MAX_AGE_HOURS) > 0
        ? Number(env.OVERDUE_MAX_AGE_HOURS)
        : OVERDUE_MAX_AGE_HOURS_DEFAULT;
    const nowMs = Date.now();
    const minCreatedAt = new Date(nowMs - maxAgeHours * 3600 * 1000).toISOString();
    const cutoff = new Date(nowMs - slaMinutes * 60 * 1000).toISOString();
    const scoped = Boolean(tenantId && tenantId !== '*');

    const overdue = await fetchOverdueCandidates(db, minCreatedAt, cutoff, tenantId, scoped);

    if (!overdue.length) {
      log.info('No overdue orders found.');
      return;
    }

    log.info('Found overdue orders', { count: overdue.length });

    // Metrics: record order_stuck count + raise a Telegram-dispatchable alert per concrete tenant.
    // Do NOT mutate orders.notes with '[OVERDUE]' — customer/internal notes must remain clean.
    const resolveOrderTenant = (order: Record<string, unknown>): string => {
      const rawOrderTenant = typeof order.tenant_id === 'string' ? order.tenant_id.trim() : '';
      if (rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq') {
        return rawOrderTenant;
      }
      return tenantId && tenantId !== '*' ? tenantId : 'default';
    };

    const byTenant = new Map<string, Array<Record<string, unknown>>>();
    for (const order of overdue) {
      const orderTenant = resolveOrderTenant(order);
      const group = byTenant.get(orderTenant) || [];
      group.push(order);
      byTenant.set(orderTenant, group);
    }

    const mc = createMetricsCollector(db);
    for (const [effectiveAlertTenant, tenantOrders] of byTenant.entries()) {
      const alertKey =
        effectiveAlertTenant === 'default'
          ? 'kds_sla_breach'
          : `kds_sla_breach:${effectiveAlertTenant}`;
      await mc.recordMetric('order_stuck', tenantOrders.length, { tenant_id: effectiveAlertTenant }).catch(() => {});
      await mc.recordAlert(
        alertKey,
        `${tenantOrders.length} đơn vượt SLA ${slaMinutes} phút — kiểm tra KDS`,
        { severity: 'warning', cooldownMinutes: 30 }
      ).catch(() => {});
    }
  } catch (err) {
    log.error('checkOverdueOrders error:', { message: (err as Error).message });
  }
}

interface StalePayosOrderCandidate {
  id: string;
  tenant_id?: string | null;
  total?: number | null;
  created_at?: string | null;
}

interface PendingPayosPaymentRow {
  id: string;
  amount?: number | null;
  method?: string | null;
  status?: string | null;
  transaction_id?: string | null;
  payment_url?: string | null;
}

const EXPIRE_ONLINE_BATCH_LIMIT = 50;

export async function expireUnpaidOnlineOrders(
  env: Record<string, unknown>,
  tenantOverride?: string,
): Promise<number> {
  const ttlMinutes =
    Number.isFinite(Number(env.UNPAID_ONLINE_ORDER_TTL_MINUTES)) &&
    Number(env.UNPAID_ONLINE_ORDER_TTL_MINUTES) > 0
      ? Number(env.UNPAID_ONLINE_ORDER_TTL_MINUTES)
      : UNPAID_ONLINE_TTL_MINUTES_DEFAULT;
  const rawOverride = typeof tenantOverride === 'string' ? tenantOverride.trim() : '';
  const normalizedOverride = rawOverride.toLowerCase() === 'hq' ? '*' : rawOverride;
  // Multi-tenant by default on scheduled ticks; only scope when a concrete tenant override is supplied.
  const tenantId = normalizedOverride || '*';
  const scoped = Boolean(tenantId && tenantId !== '*');

  try {
    const db = env.AURA_DB as D1Database;
    const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    let candidates: StalePayosOrderCandidate[] = [];
    let hasOrderTenantCol = true;
    try {
      const sql = scoped
        ? `SELECT id, tenant_id, total, created_at
           FROM orders
           WHERE LOWER(COALESCE(status, 'pending')) = 'pending'
             AND LOWER(COALESCE(payment_method, '')) = 'payos'
             AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded')
             AND julianday(created_at) < julianday(?)
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
           ORDER BY julianday(created_at) ASC
           LIMIT ?`
        : `SELECT id, tenant_id, total, created_at
           FROM orders
           WHERE LOWER(COALESCE(status, 'pending')) = 'pending'
             AND LOWER(COALESCE(payment_method, '')) = 'payos'
             AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded')
             AND julianday(created_at) < julianday(?)
           ORDER BY julianday(created_at) ASC
           LIMIT ?`;
      const res = scoped
        ? await db.prepare(sql).bind(cutoff, tenantId, EXPIRE_ONLINE_BATCH_LIMIT).all<StalePayosOrderCandidate>()
        : await db.prepare(sql).bind(cutoff, EXPIRE_ONLINE_BATCH_LIMIT).all<StalePayosOrderCandidate>();
      candidates = res.results ?? [];
    } catch {
      if (scoped && tenantId !== 'default') {
        return 0;
      }
      hasOrderTenantCol = false;
      const fallbackRes = await db
        .prepare(
          `SELECT id, total, created_at
           FROM orders
           WHERE LOWER(COALESCE(status, 'pending')) = 'pending'
             AND LOWER(COALESCE(payment_method, '')) = 'payos'
             AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded')
             AND julianday(created_at) < julianday(?)
           ORDER BY julianday(created_at) ASC
           LIMIT ?`,
        )
        .bind(cutoff, EXPIRE_ONLINE_BATCH_LIMIT)
        .all<StalePayosOrderCandidate>();
      candidates = fallbackRes.results ?? [];
    }

    if (candidates.length === 0) return 0;

    const credsCache = new Map<string, ResolvedPayosCredentials | null>();
    const getCreds = async (targetTenant: string): Promise<ResolvedPayosCredentials | null> => {
      if (credsCache.has(targetTenant)) return credsCache.get(targetTenant) ?? null;
      const resolved = await resolvePayosReconcileCredentials(db, env as unknown as Env, targetTenant).catch(() => null);
      credsCache.set(targetTenant, resolved);
      return resolved;
    };

    let expiredCount = 0;
    for (const order of candidates) {
      const rawOrderTenant = typeof order.tenant_id === 'string' ? order.tenant_id.trim() : '';
      const orderTenant =
        rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq'
          ? rawOrderTenant
          : (scoped ? tenantId : 'default');

      let pendingPayments: PendingPayosPaymentRow[] = [];
      let paymentsTableAvailable = true;
      try {
        const payRes = await db
          .prepare(
            `SELECT id, amount, method, status, transaction_id, payment_url
             FROM payments
             WHERE order_id = ?
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               AND LOWER(COALESCE(status, '')) = 'pending'`,
          )
          .bind(order.id, orderTenant)
          .all<PendingPayosPaymentRow>();
        pendingPayments = payRes.results ?? [];
      } catch {
        try {
          const payRes = await db
            .prepare(
              `SELECT id, amount, status
               FROM payments
               WHERE order_id = ?
                 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                 AND LOWER(COALESCE(status, '')) = 'pending'`,
            )
            .bind(order.id, orderTenant)
            .all<PendingPayosPaymentRow>();
          pendingPayments = payRes.results ?? [];
        } catch {
          paymentsTableAvailable = false;
          pendingPayments = [];
        }
      }

      let canExpire = true;
      for (const payment of pendingPayments) {
        const txId = typeof payment.transaction_id === 'string' ? payment.transaction_id.trim() : '';
        const linkId = extractPayOSLinkId(typeof payment.payment_url === 'string' ? payment.payment_url : null);
        if (!txId && !linkId) continue;

        const creds = await getCreds(orderTenant);
        if (!creds) {
          // Live upstream PayOS link exists but tenant credentials cannot be resolved — fail closed.
          canExpire = false;
          break;
        }

        const expectedAmount = Number(payment.amount ?? order.total ?? 0);
        const verified = await verifyPayOSPaymentRequest({
          transactionId: txId,
          expectedAmount,
          expectedLinkId: linkId,
          clientId: creds.clientId,
          apiKey: creds.apiKey,
          checksumKey: creds.checksumKey,
          timeoutMs: 5000,
        });

        if (verified.ok) {
          const upperStatus = verified.status.toUpperCase();
          if (upperStatus === 'PAID' || verified.amountPaid > 0) {
            await reconcilePayOSPayment({
              db,
              kv: (env.AUTH_KV as KVNamespace | undefined) ?? null,
              env,
              paymentId: payment.id,
              tenantId: orderTenant,
              clientId: creds.clientId,
              apiKey: creds.apiKey,
              checksumKey: creds.checksumKey,
              source: 'cron',
              preVerified: verified,
            }).catch((err) => {
              log.error('Failed to reconcile paid PayOS order during expiry check', {
                orderId: order.id,
                paymentId: payment.id,
                message: err instanceof Error ? err.message : String(err),
              });
            });
            canExpire = false;
            break;
          }

          if (upperStatus === 'PENDING' || upperStatus === 'PROCESSING') {
            const cancelRef = verified.orderCode || txId || linkId || '';
            if (!cancelRef) {
              canExpire = false;
              break;
            }
            try {
              const cancelRes = await fetch(`${PAYOS_API}/${encodeURIComponent(cancelRef)}/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-client-id': creds.clientId,
                  'x-api-key': creds.apiKey,
                },
                body: JSON.stringify({ cancellationReason: 'order_expired' }),
                signal: AbortSignal.timeout(5000),
              });
              if (!cancelRes.ok && cancelRes.status !== 404) {
                canExpire = false;
                break;
              }
              if (cancelRes.ok) {
                const cancelBody = (await cancelRes.json().catch(() => null)) as
                  | { code?: string; data?: { status?: string } }
                  | null;
                if (cancelBody?.code && cancelBody.code !== '00') {
                  canExpire = false;
                  break;
                }
                if (String(cancelBody?.data?.status ?? '').toUpperCase() === 'PAID') {
                  canExpire = false;
                  break;
                }
              }
            } catch {
              canExpire = false;
              break;
            }
          }
          // CANCELLED / EXPIRED upstream — safe to expire locally.
        } else if (verified.reason !== 'not_found') {
          // Transient upstream error, timeout, bad signature, or mismatch — retry next tick.
          canExpire = false;
          break;
        }
      }

      if (!canExpire) continue;

      const batchStmts: D1PreparedStatement[] = [];
      for (const payment of pendingPayments) {
        batchStmts.push(
          db
            .prepare(
              `UPDATE payments
               SET status = 'expired', updated_at = ?
               WHERE id = ? AND LOWER(COALESCE(status, '')) = 'pending'`,
            )
            .bind(now, payment.id),
        );
      }

      const paidGuard = paymentsTableAvailable
        ? ` AND NOT EXISTS (
             SELECT 1 FROM payments p
             WHERE p.order_id = orders.id
               AND LOWER(COALESCE(p.status, '')) IN ('paid', 'completed', 'refunded', 'partially_refunded')
           )`
        : '';
      const orderTenantGuard = hasOrderTenantCol
        ? ` AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        : '';
      const orderSql = `UPDATE orders
        SET status = 'expired', updated_at = ?
        WHERE id = ?
          AND LOWER(COALESCE(status, 'pending')) = 'pending'
          AND LOWER(COALESCE(payment_method, '')) = 'payos'
          AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'completed', 'partially_refunded', 'refunded')${paidGuard}${orderTenantGuard}`;
      const orderStmt = hasOrderTenantCol
        ? db.prepare(orderSql).bind(now, order.id, orderTenant)
        : db.prepare(orderSql).bind(now, order.id);
      batchStmts.push(orderStmt);

      const batchResults = await db.batch(batchStmts);
      const orderUpdateResult = batchResults[batchResults.length - 1] as { meta?: { changes?: number } } | undefined;
      if (Number(orderUpdateResult?.meta?.changes ?? 0) > 0) {
        expiredCount += 1;
      }
    }

    return expiredCount;
  } catch (err) {
    log.error('expireUnpaidOnlineOrders error:', { message: (err as Error).message });
    return 0;
  }
}

export async function checkInventoryAlerts(env: Record<string, unknown>, tenantOverride?: string): Promise<number> {
  const rawOverride = typeof tenantOverride === 'string' ? tenantOverride.trim() : '';
  const normalizedOverride = rawOverride.toLowerCase() === 'hq' ? '*' : rawOverride;
  const rawTenant = normalizedOverride || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  const tenantId = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
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
        (row) => matchesTenantRow(row, tenantId)
      );
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
        const res = await db.prepare(`
          SELECT id, name, quantity, min_quantity
          FROM inventory_items
          WHERE quantity <= min_quantity
        `).all<Record<string, unknown>>();
        items = (res.results || []).filter(
          (row) => matchesTenantRow(row, tenantId)
        );
      } else {
        items = [];
      }
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
        if (itemTenantId === 'default' || itemTenantId === '*') {
          recent = await db.prepare(`
            SELECT id FROM inventory_alerts
            WHERE item_id = ? AND notified_at > ?
            LIMIT 1
          `).bind(itemId, cutoffIso).first<Record<string, unknown>>().catch(() => null);
        } else {
          recent = null;
        }
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
        if (itemTenantId === 'default') {
          await db.prepare(
            'INSERT INTO inventory_alerts (item_id, alert_type, current_qty, threshold, notified_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(itemId, alertType, qty, minQty, now).run().catch(() => {});
        }
      }
      notified++;
    }

    return notified;
  } catch (err) {
    log.error('checkInventoryAlerts error:', { message: (err as Error).message });
    return 0;
  }
}
