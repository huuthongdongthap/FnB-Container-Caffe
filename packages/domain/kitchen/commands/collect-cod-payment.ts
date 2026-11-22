import type { D1Database } from '@cloudflare/workers-types';
import { isTerminal } from '../../order/model/order-state-machine';
import { assertCashSettlementWrite, resolveCashCollectingShift } from '../../shift/commands/cash-settlement';

type CollectionResult = { success: true; status: string; idempotent?: boolean }
  | { success: false; statusCode: 404 | 409; error: string };
type Order = { total?: number; total_amount?: number; status: string; payment_status: string; payment_method?: string; is_cod?: number; tenant_id?: string | null };

/** Cash collection is one ledger transaction and never changes kitchen fulfillment. */
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
  const staff = (staffId || '').trim();
  let collecting;
  try { collecting = await resolveCashCollectingShift(db, staff, effectiveOrderTenant); }
  catch { return { success: false, statusCode: 409, error: 'Collecting shift schema requires reconciliation' }; }
  const { shift, hasShifts } = collecting;
  if (shift && (!hasPaymentsTable || !hasPaymentsTenantColumn)) {
    return { success: false, statusCode: 409, error: 'Shift cash settlement schema unavailable' };
  }
  // Pin the exact attendance row: a clock-out/new clock-in must not redirect responsibility.
  const shiftPredicate = shift
    ? ` AND EXISTS (SELECT 1 FROM staff_shifts s WHERE CAST(s.id AS TEXT) = ? AND s.staff_id = ?
        AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ? AND s.clock_in = ? AND s.clock_out IS NULL
        AND NOT EXISTS (SELECT 1 FROM shift_reconciliations r WHERE r.shift_id = CAST(s.id AS TEXT)
          AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?))`
    : hasShifts ? ` AND NOT EXISTS (SELECT 1 FROM staff_shifts s WHERE s.staff_id = ?
        AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ? AND s.clock_in IS NOT NULL AND s.clock_out IS NULL)` : '';
  const shiftBinds = shift ? [shift.id, staff, effectiveOrderTenant, shift.clock_in, effectiveOrderTenant]
    : hasShifts ? [staff, effectiveOrderTenant] : [];
  const payTenantClause = hasPaymentsTenantColumn ? paymentTenantClause : '';
  const payTenantBinds = hasPaymentsTenantColumn ? paymentLookupBinds : [];
  const ledger = ledgerRows[0];
  // Revalidate the ledger snapshot with the order CAS, before any dependent write.
  const ledgerPredicate = !hasPaymentsTable ? '' : ledger
    ? ` AND (SELECT COUNT(*) FROM payments WHERE order_id = ? AND method IN ('cod', 'cash')${payTenantClause}) = 1
        AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND order_id = ? AND method IN ('cod', 'cash')
          AND status = ? AND amount = ?${payTenantClause})`
    : ` AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method IN ('cod', 'cash')${payTenantClause})`;
  const ledgerBinds = !hasPaymentsTable ? [] : ledger
    ? [id, ...payTenantBinds, ledger.id, id, ledger.status, amount, ...payTenantBinds] : [id, ...payTenantBinds];
  const paymentId = ledger?.id || `cod:${id}`;
  const commit = (timestamp: boolean) => {
    const statements = [
      db.prepare(`UPDATE orders SET payment_status = 'paid', ${timestamp ? 'cod_paid_at = COALESCE(cod_paid_at, ?), ' : ''}updated_at = ?
        WHERE id = ? AND status = ? AND payment_status = ?${effectiveOrderClause}${shiftPredicate}${ledgerPredicate}`)
        .bind(...(timestamp ? [now] : []), now, id, order!.status, order!.payment_status, ...effectiveOrderBinds, ...shiftBinds, ...ledgerBinds),
      assertCashSettlementWrite(db),
    ];
    if (hasPaymentsTable) {
      statements.push(ledger
        ? db.prepare(`UPDATE payments SET status = 'completed', updated_at = ? WHERE id = ? AND status = ? AND amount = ?${payTenantClause}`)
          .bind(now, ledger.id, ledger.status, amount, ...payTenantBinds)
        : db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, ${hasPaymentsTenantColumn ? 'tenant_id, ' : ''}created_at, updated_at)
            VALUES (?, ?, 'cod', ?, 'completed', ${hasPaymentsTenantColumn ? '?, ' : ''}?, ?)`)
          .bind(paymentId, id, amount, ...(hasPaymentsTenantColumn ? [effectiveOrderTenant] : []), now, now),
      assertCashSettlementWrite(db));
    }
    if (shift) {
      statements.push(
        db.prepare(`INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(paymentId, effectiveOrderTenant, shift.id, staff, now),
        assertCashSettlementWrite(db),
        db.prepare(`UPDATE staff_shifts SET cash_sales = COALESCE(cash_sales, 0) + ?,
            total_sales = COALESCE(total_sales, 0) + ?, order_count = COALESCE(order_count, 0) + 1
          WHERE CAST(id AS TEXT) = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL
            AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
            AND NOT EXISTS (SELECT 1 FROM shift_reconciliations r WHERE r.shift_id = ?
              AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?)`)
          .bind(amount, amount, shift.id, staff, shift.clock_in, effectiveOrderTenant, shift.id, effectiveOrderTenant),
        assertCashSettlementWrite(db));
    }
    return db.batch(statements);
  };
  let results;
  let timestamp = hasPaymentsTable;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { results = await commit(timestamp); break; }
    catch (error) {
      const message = String(error);
      if (timestamp && /no such column:.*cod_paid_at/i.test(message)) timestamp = false;
      else if (/integer overflow/i.test(message)) return { success: false, statusCode: 409, error: 'Order, ledger or collecting shift changed; refresh and retry' };
      else if (shift && /no such table|no such column|has no column named/i.test(message)) {
        return { success: false, statusCode: 409, error: 'Shift cash settlement schema unavailable' };
      } else throw error;
    }
  }
  if (!results || results.some(result => !result.success)) throw new Error('COD settlement transaction failed');
  return { success: true, status: order.status };
}

export const collectCodOrderPayment = collectCodPayment;
