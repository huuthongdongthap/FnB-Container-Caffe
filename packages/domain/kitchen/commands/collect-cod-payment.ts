import type { D1Database } from '@cloudflare/workers-types';
import { isTerminal } from '../../order/model/order-state-machine';

type CollectionResult = { success: true; status: string; idempotent?: boolean }
  | { success: false; statusCode: 404 | 409; error: string };
type Order = { total?: number; total_amount?: number; status: string; payment_status: string; payment_method?: string; is_cod?: number };

/** Cash collection is one ledger transaction and never changes kitchen fulfillment. */
export async function collectCodPayment(db: D1Database, id: string, tenantId: string): Promise<CollectionResult> {
  const normTenant = (tenantId || '').trim() || 'default';
  const tenantClause = normTenant === '*'
    ? ''
    : normTenant === 'default'
      ? " AND (tenant_id = ? OR TRIM(tenant_id) = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?)';
  const tenantBinds = normTenant === '*' ? [] : [normTenant, normTenant];
  let order: Order | null;
  try {
    order = await db.prepare(`SELECT total, status, payment_status, payment_method FROM orders WHERE id = ?${tenantClause}`)
      .bind(id, ...tenantBinds).first<Order>();
  } catch {
    // Legacy money column compatibility retains the same signed tenant predicate.
    order = await db.prepare(`SELECT total_amount AS total, status, payment_status, is_cod FROM orders WHERE id = ?${tenantClause}`)
      .bind(id, ...tenantBinds).first<Order>();
  }
  if (!order) return { success: false, statusCode: 404, error: 'Order not found' };
  const normalizedStatus = String(order.status || '').trim().toLowerCase();
  const normalizedPaymentStatus = String(order.payment_status || '').trim().toLowerCase();
  const isUnpaidTerminal = ['cancelled', 'rejected', 'failed', 'expired'].includes(normalizedStatus)
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
  let ledgerRows: Array<{ id: string; status: string; amount: number }> = [];
  let hasPaymentsTable = true;
  try {
    const ledger = await db.prepare("SELECT id, status, amount FROM payments WHERE order_id = ? AND method IN ('cod', 'cash') LIMIT 2")
      .bind(id).all<{ id: string; status: string; amount: number }>();
    ledgerRows = ledger.results || [];
  } catch (error) {
    if (!/no such table:.*payments/i.test(String(error))) throw error;
    hasPaymentsTable = false;
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
      `UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ? AND status = ? AND payment_status = ?${tenantClause}`
    ).bind(now, id, order.status, order.payment_status, ...tenantBinds).run();
    if (!(res.meta?.changes > 0)) {
      return { success: false, statusCode: 409, error: 'Order changed concurrently; refresh and retry' };
    }
    return { success: true, status: order.status };
  }
  const commit = (timestamp: boolean) => db.batch([
    db.prepare(`UPDATE orders SET payment_status = 'paid', ${timestamp ? 'cod_paid_at = COALESCE(cod_paid_at, ?), ' : ''}updated_at = ?
      WHERE id = ? AND status = ? AND payment_status = ?${tenantClause}`)
      .bind(...(timestamp ? [now] : []), now, id, order!.status, order!.payment_status, ...tenantBinds),
    db.prepare(`UPDATE payments SET status = 'completed', updated_at = ?
      WHERE order_id = ? AND method IN ('cod', 'cash') AND status = 'pending'
      AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = ? AND payment_status = 'paid'${tenantClause})`)
      .bind(now, id, id, order!.status, ...tenantBinds),
    db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
      SELECT ?, id, 'cod', ?, 'completed', ?, ? FROM orders
      WHERE id = ? AND status = ? AND payment_status = 'paid'${tenantClause}
      AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method IN ('cod', 'cash'))`)
      .bind(`cod:${id}`, amount, now, now, id, order!.status, ...tenantBinds, id),
  ]);
  let results;
  try { results = await commit(true); }
  catch (error) {
    // Only this optional timestamp may use the legacy transaction; never swallow ledger failure.
    if (!/no such column:.*cod_paid_at/i.test(String(error))) throw error;
    results = await commit(false);
  }
  if (results.length !== 3 || results.some(result => !result.success)) throw new Error('COD settlement transaction failed');
  if (!(results[0]!.meta?.changes > 0)) {
    return { success: false, statusCode: 409, error: 'Order changed concurrently; refresh and retry' };
  }
  return { success: true, status: order.status };
}

export const collectCodOrderPayment = collectCodPayment;
