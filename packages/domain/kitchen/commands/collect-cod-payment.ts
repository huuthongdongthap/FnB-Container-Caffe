import type { D1Database } from '@cloudflare/workers-types';
import { isTerminal } from '../../order/model/order-state-machine';

type CollectionResult = { success: true; status: string; idempotent?: boolean }
  | { success: false; statusCode: 404 | 409; error: string };
type Order = { total?: number; total_amount?: number; status: string; payment_status: string; payment_method?: string; is_cod?: number; tenant_id?: string | null };

/** Cash collection is one ledger transaction and never changes kitchen fulfillment. */
/**
 * Credit a settled cash sale to the collecting staff member's open attendance shift in one
 * statement so concurrent collections never lose an increment. Absent table/columns (minimal
 * schemas) or no open shift leave the settlement itself untouched.
 */
async function attributeCashToOpenShift(db: D1Database, staffId: string | undefined, tenant: string, amount: number): Promise<void> {
  const staff = (staffId || '').trim();
  if (!staff || !Number.isFinite(amount) || amount <= 0) return;
  try {
    await db.prepare(
      `UPDATE staff_shifts
          SET cash_sales = COALESCE(cash_sales, 0) + ?,
              total_sales = COALESCE(total_sales, 0) + ?,
              order_count = COALESCE(order_count, 0) + 1
        WHERE id = (
          SELECT id FROM staff_shifts
           WHERE staff_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND clock_in IS NOT NULL AND clock_out IS NULL
           ORDER BY clock_in DESC LIMIT 1)`
    ).bind(amount, amount, staff, tenant).run();
  } catch {
    // staff_shifts or its sales columns are optional in minimal schemas
  }
}

export async function collectCodPayment(db: D1Database, id: string, tenantId: string, staffId?: string): Promise<CollectionResult> {
  const rawTenant = (tenantId || '').trim() || 'default';
  const normTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  const tenantClause = normTenant === '*'
    ? ''
    : normTenant === 'default'
      ? " AND (tenant_id = ? OR TRIM(tenant_id) = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?)';
  const tenantBinds = normTenant === '*' ? [] : [normTenant, normTenant];
  let order: Order | null;
  if (normTenant === '*') {
    try {
      order = await db.prepare('SELECT total, status, payment_status, payment_method, tenant_id FROM orders WHERE id = ?')
        .bind(id).first<Order>();
    } catch {
      try {
        order = await db.prepare('SELECT total, status, payment_status, payment_method FROM orders WHERE id = ?')
          .bind(id).first<Order>();
      } catch {
        order = await db.prepare('SELECT total_amount AS total, status, payment_status, is_cod FROM orders WHERE id = ?')
          .bind(id).first<Order>();
      }
    }
  } else {
    try {
      order = await db.prepare(`SELECT total, status, payment_status, payment_method FROM orders WHERE id = ?${tenantClause}`)
        .bind(id, ...tenantBinds).first<Order>();
    } catch {
      // Legacy money column compatibility retains the same signed tenant predicate.
      order = await db.prepare(`SELECT total_amount AS total, status, payment_status, is_cod FROM orders WHERE id = ?${tenantClause}`)
        .bind(id, ...tenantBinds).first<Order>();
    }
  }
  if (!order) return { success: false, statusCode: 404, error: 'Order not found' };
  const hasOrderTenant =
    normTenant !== '*' ||
    (order.tenant_id !== undefined && order.tenant_id !== null && String(order.tenant_id).trim() !== '' && String(order.tenant_id).trim() !== '*');
  const effectiveOrderTenant = normTenant === '*'
    ? (order.tenant_id && String(order.tenant_id).trim() && String(order.tenant_id).trim() !== '*'
        ? String(order.tenant_id).trim()
        : 'default')
    : normTenant;
  const effectiveOrderClause = !hasOrderTenant
    ? ''
    : effectiveOrderTenant === 'default'
      ? " AND (tenant_id = ? OR TRIM(tenant_id) = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?)';
  const effectiveOrderBinds = !hasOrderTenant ? [] : [effectiveOrderTenant, effectiveOrderTenant];
  const normalizedStatus = String(order.status || '').trim().toLowerCase();
  const normalizedPaymentStatus = String(order.payment_status || '').trim().toLowerCase();
  const isUnpaidTerminal = ['cancelled', 'canceled', 'rejected', 'refunded', 'failed', 'expired'].includes(normalizedStatus)
    || ((normalizedStatus === 'completed' || normalizedStatus === 'paid' || isTerminal(order.status)) && normalizedPaymentStatus !== 'paid');
  if (isUnpaidTerminal) {
    return { success: false, statusCode: 409, error: `Cannot collect a ${normalizedStatus || order.status} order` };
  }
  const cod = order.payment_method !== undefined ? ['cod', 'cash'].includes(order.payment_method) : order.is_cod === 1;
  if (!cod) return { success: false, statusCode: 409, error: 'Not a COD order' };
  if (normalizedPaymentStatus === 'refunded' || !['unpaid', 'pending', 'cod_pending', 'paid'].includes(normalizedPaymentStatus)) {
    return { success: false, statusCode: 409, error: 'Payment requires reconciliation' };
  }
  const amount = Number(order.total ?? order.total_amount ?? 0);
  const paymentTenantClause = !hasOrderTenant
    ? ''
    : effectiveOrderTenant === 'default'
      ? " AND (tenant_id = ? OR TRIM(tenant_id) = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?)';
  const paymentLookupBinds = !hasOrderTenant ? [] : [effectiveOrderTenant, effectiveOrderTenant];
  let ledgerRows: Array<{ id: string; status: string; amount: number }> = [];
  let hasPaymentsTable = true;
  let hasPaymentsTenantColumn = true;
  try {
    const ledger = await db.prepare(`SELECT id, status, amount FROM payments WHERE order_id = ? AND method IN ('cod', 'cash')${paymentTenantClause} LIMIT 2`)
      .bind(id, ...paymentLookupBinds).all<{ id: string; status: string; amount: number }>();
    ledgerRows = ledger.results || [];
  } catch (error) {
    const errText = String(error);
    if (/no such table:.*payments/i.test(errText)) {
      hasPaymentsTable = false;
    } else if (/no such column:.*tenant_id/i.test(errText) && effectiveOrderTenant === 'default') {
      hasPaymentsTenantColumn = false;
      const ledger = await db.prepare("SELECT id, status, amount FROM payments WHERE order_id = ? AND method IN ('cod', 'cash') LIMIT 2")
        .bind(id).all<{ id: string; status: string; amount: number }>();
      ledgerRows = ledger.results || [];
    } else {
      throw error;
    }
  }
  if (ledgerRows.length > 1 || ledgerRows.some(row => !['pending', 'completed', 'paid'].includes(row.status)
    || Number(row.amount) !== amount)) {
    return { success: false, statusCode: 409, error: 'COD ledger requires reconciliation' };
  }
  if (normalizedPaymentStatus === 'paid' && (!hasPaymentsTable || (ledgerRows.length === 1 && ['completed', 'paid'].includes(ledgerRows[0]!.status)))) {
    return { success: true, status: order.status, idempotent: true };
  }
  const now = new Date().toISOString();
  if (!hasPaymentsTable) {
    const res = await db.prepare(
      `UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ? AND status = ? AND payment_status = ?${effectiveOrderClause}`
    ).bind(now, id, order.status, order.payment_status, ...effectiveOrderBinds).run();
    if (!(res.meta?.changes > 0)) {
      return { success: false, statusCode: 409, error: 'Order changed concurrently; refresh and retry' };
    }
    await attributeCashToOpenShift(db, staffId, effectiveOrderTenant, amount);
    return { success: true, status: order.status };
  }
  const effectivePaymentTenant = effectiveOrderTenant;
  const commit = (timestamp: boolean, withPaymentTenant: boolean, withAttribution: boolean) => {
    const payTenantClause = withPaymentTenant ? paymentTenantClause : '';
    const payTenantBinds = withPaymentTenant ? paymentLookupBinds : [];
    return db.batch([
      ...(withAttribution ? [db.prepare(`INSERT OR IGNORE INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at)
        SELECT COALESCE((SELECT id FROM payments WHERE order_id = ? AND method IN ('cod', 'cash') LIMIT 1), ?),
          ?, CAST(s.id AS TEXT), ?, ? FROM staff_shifts s
        WHERE s.staff_id = ? AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?
          AND s.clock_in IS NOT NULL AND s.clock_out IS NULL
          AND NOT EXISTS (SELECT 1 FROM shift_reconciliations r WHERE r.shift_id = CAST(s.id AS TEXT) AND r.tenant_id = ?)
          AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = ? AND payment_status = ?${effectiveOrderClause})
        ORDER BY s.clock_in DESC LIMIT 1`)
        .bind(id, `cod:${id}`, effectivePaymentTenant, staffId || '', now, staffId || '', effectivePaymentTenant,
          effectivePaymentTenant, id, order!.status, order!.payment_status, ...effectiveOrderBinds)] : []),
      db.prepare(`UPDATE orders SET payment_status = 'paid', ${timestamp ? 'cod_paid_at = COALESCE(cod_paid_at, ?), ' : ''}updated_at = ?
        WHERE id = ? AND status = ? AND payment_status = ?${effectiveOrderClause}`)
        .bind(...(timestamp ? [now] : []), now, id, order!.status, order!.payment_status, ...effectiveOrderBinds),
      db.prepare(`UPDATE payments SET status = 'completed', updated_at = ?
        WHERE order_id = ? AND method IN ('cod', 'cash') AND status = 'pending'${payTenantClause}
        AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = ? AND payment_status = 'paid'${effectiveOrderClause})`)
        .bind(now, id, ...payTenantBinds, id, order!.status, ...effectiveOrderBinds),
      withPaymentTenant
        ? db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
            SELECT ?, id, 'cod', ?, 'completed', ?, ?, ? FROM orders
            WHERE id = ? AND status = ? AND payment_status = 'paid'${effectiveOrderClause}
            AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method IN ('cod', 'cash')${payTenantClause})`)
            .bind(`cod:${id}`, amount, effectivePaymentTenant, now, now, id, order!.status, ...effectiveOrderBinds, id, ...payTenantBinds)
        : db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
            SELECT ?, id, 'cod', ?, 'completed', ?, ? FROM orders
            WHERE id = ? AND status = ? AND payment_status = 'paid'${effectiveOrderClause}
            AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method IN ('cod', 'cash'))`)
            .bind(`cod:${id}`, amount, now, now, id, order!.status, ...effectiveOrderBinds, id),
    ]);
  };
  let results;
  let timestamp = true, withAttribution = true;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { results = await commit(timestamp, hasPaymentsTenantColumn, withAttribution); break; }
    catch (error) {
      const message = String(error);
      if (withAttribution && /no such table:.*\b(cash_payment_attributions|staff_shifts|shift_reconciliations)\b/i.test(message)) withAttribution = false;
      else if (timestamp && /no such column:.*cod_paid_at/i.test(message)) timestamp = false;
      else if (hasPaymentsTenantColumn && effectiveOrderTenant === 'default' && /no such column:.*tenant_id/i.test(message)) hasPaymentsTenantColumn = false;
      else throw error;
    }
  }
  if (!results || results.length !== (withAttribution ? 4 : 3) || results.some(result => !result.success)) throw new Error('COD settlement transaction failed');
  if (!(results[withAttribution ? 1 : 0]!.meta?.changes > 0)) {
    return { success: false, statusCode: 409, error: 'Order changed concurrently; refresh and retry' };
  }
  await attributeCashToOpenShift(db, staffId, effectiveOrderTenant, amount);
  return { success: true, status: order.status };
}

export const collectCodOrderPayment = collectCodPayment;
