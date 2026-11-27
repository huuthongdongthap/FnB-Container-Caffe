import type { D1Database } from '@cloudflare/workers-types';
import { isTerminal } from '../../order/model/order-state-machine';
import {
  assertCashSettlementWrite,
  isCashReconciliationActiveForTenant,
  resolveCashCollectingShift,
} from '../../shift/commands/cash-settlement';

export interface CollectCodOptions {
  env?: Record<string, unknown>;
  actorRole?: string;
  explicitShiftId?: string;
}

export type CollectionResult =
  | { success: true; status: string; idempotent?: boolean }
  | { success: false; statusCode: 403 | 404 | 409; error: string; code?: string };

type Order = {
  total?: number;
  total_amount?: number;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  is_cod?: number | null;
  order_type?: string | null;
  assigned_shipper_id?: string | null;
  tenant_id?: string | null;
};

/** Cash collection is one ledger transaction and never changes kitchen fulfillment. */
export async function collectCodPayment(
  db: D1Database,
  id: string,
  tenantId: string,
  staffId?: string,
  options?: CollectCodOptions,
): Promise<CollectionResult> {
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
  if ((order.payment_method === null || order.payment_method === '') && order.is_cod === undefined) {
    try {
      const codFlagRow = await db
        .prepare(`SELECT is_cod FROM orders WHERE id = ?${normTenant === '*' ? '' : tenantClause}`)
        .bind(id, ...(normTenant === '*' ? [] : tenantBinds))
        .first<{ is_cod?: number | null }>();
      if (codFlagRow && codFlagRow.is_cod !== undefined) {
        order = { ...order, is_cod: codFlagRow.is_cod };
      }
    } catch {
      // is_cod column absent in minimal test schema
    }
  }
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
  const normalizedMethod = typeof order.payment_method === 'string' ? order.payment_method.trim().toLowerCase() : '';
  const cod = normalizedMethod ? ['cod', 'cash'].includes(normalizedMethod) : Number(order.is_cod ?? 0) === 1;
  if (!cod) return { success: false, statusCode: 409, error: 'Not a COD order' };
  if (normalizedPaymentStatus === 'refunded' || !['unpaid', 'pending', 'cod_pending', 'paid'].includes(normalizedPaymentStatus)) {
    return { success: false, statusCode: 409, error: 'Payment requires reconciliation' };
  }

  const staff = (staffId || '').trim();
  const normalizedActorRole = String(options?.actorRole || '').trim().toLowerCase();
  const isShipperCaller =
    normalizedActorRole === 'shipper' ||
    normalizedActorRole === 'rider' ||
    normalizedActorRole === 'driver' ||
    normalizedActorRole === 'delivery';
  if (isShipperCaller) {
    if (order.order_type === undefined && order.assigned_shipper_id === undefined) {
      try {
        const shipRow = await db
          .prepare(`SELECT order_type, assigned_shipper_id FROM orders WHERE id = ?${effectiveOrderClause}`)
          .bind(id, ...effectiveOrderBinds)
          .first<{ order_type?: string | null; assigned_shipper_id?: string | null }>();
        if (shipRow) {
          order = { ...order, order_type: shipRow.order_type, assigned_shipper_id: shipRow.assigned_shipper_id };
        }
      } catch {
        // Delivery metadata columns absent in minimal test schema
      }
    }
    const ordTypeLower = typeof order.order_type === 'string' ? order.order_type.trim().toLowerCase() : '';
    if (ordTypeLower && ordTypeLower !== 'delivery') {
      return { success: false, statusCode: 403, error: 'Shippers may only collect COD for delivery orders' };
    }
    if (
      normalizedStatus !== 'delivering' &&
      normalizedStatus !== 'delivered' &&
      !(normalizedStatus === 'completed' && normalizedPaymentStatus === 'paid')
    ) {
      return {
        success: false,
        statusCode: 409,
        error: 'Order must be in delivering or delivered status before shipper COD collection',
      };
    }
    const assignedShipper = String(
      (order as Record<string, unknown>).assigned_shipper_id ?? (order as Record<string, unknown>).shipper_id ?? ''
    ).trim();
    if (!assignedShipper || !staff || assignedShipper !== staff) {
      return { success: false, statusCode: 403, error: 'Forbidden: order is not assigned to this shipper' };
    }
  }

  const amount = Number(order.total ?? order.total_amount ?? 0);
  const paymentTenantClause = !hasOrderTenant
    ? ''
    : effectiveOrderTenant === 'default'
      ? " AND (tenant_id = ? OR TRIM(tenant_id) = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?)';
  const paymentLookupBinds = !hasOrderTenant ? [] : [effectiveOrderTenant, effectiveOrderTenant];
  type RawPaymentLedgerRow = { id: string; method?: string | null; status: string; amount: number };
  let allOrderPayments: RawPaymentLedgerRow[] = [];
  let hasPaymentsTable = true;
  let hasPaymentsTenantColumn = true;
  try {
    const ledger = await db.prepare(`SELECT id, method, status, amount FROM payments WHERE order_id = ?${paymentTenantClause} LIMIT 6`)
      .bind(id, ...paymentLookupBinds).all<RawPaymentLedgerRow>();
    allOrderPayments = ledger.results || [];
  } catch (error) {
    const errText = String(error);
    if (/no such table:.*payments/i.test(errText)) {
      hasPaymentsTable = false;
    } else if (/no such column:.*tenant_id/i.test(errText) && effectiveOrderTenant === 'default') {
      hasPaymentsTenantColumn = false;
      const ledger = await db.prepare('SELECT id, method, status, amount FROM payments WHERE order_id = ? LIMIT 6')
        .bind(id).all<RawPaymentLedgerRow>();
      allOrderPayments = ledger.results || [];
    } else if (/no such column:.*method/i.test(errText)) {
      const ledger = await db.prepare(`SELECT id, status, amount FROM payments WHERE order_id = ?${paymentTenantClause} LIMIT 2`)
        .bind(id, ...paymentLookupBinds).all<RawPaymentLedgerRow>();
      allOrderPayments = ledger.results || [];
    } else {
      throw error;
    }
  }

  const payosRows = allOrderPayments.filter((row) => String(row.method ?? '').trim().toLowerCase() === 'payos');
  if (
    payosRows.some((row) =>
      ['completed', 'paid', 'refunded', 'partially_refunded'].includes(String(row.status || '').trim().toLowerCase()),
    )
  ) {
    return {
      success: false,
      statusCode: 409,
      code: 'ORDER_ALREADY_PAID_ONLINE',
      error: 'Order already has a settled PayOS payment',
    };
  }
  const hasPendingPayosRow = payosRows.some((row) => String(row.status || '').trim().toLowerCase() === 'pending');

  const ledgerRows = allOrderPayments.filter((row) => {
    const m = row.method !== undefined && row.method !== null ? String(row.method).trim().toLowerCase() : '';
    return m === '' || m === 'cod' || m === 'cash';
  });

  if (ledgerRows.length > 1 || ledgerRows.some(row => !['pending', 'completed', 'paid'].includes(String(row.status || '').trim().toLowerCase())
    || Number(row.amount) !== amount)) {
    return { success: false, statusCode: 409, error: 'COD ledger requires reconciliation' };
  }
  if (normalizedPaymentStatus === 'paid' && (!hasPaymentsTable || (ledgerRows.length === 1 && ['completed', 'paid'].includes(String(ledgerRows[0]!.status || '').trim().toLowerCase())))) {
    return { success: true, status: order.status, idempotent: true };
  }
  if (hasPendingPayosRow && options?.env) {
    try {
      const { cancelOpenPayOSAttemptForOrder } = await import('@aura/domain-payment');
      await cancelOpenPayOSAttemptForOrder(db, options.env, id, effectiveOrderTenant).catch(() => {});
    } catch {
      // Non-blocking upstream link cancellation; DB pending row is cancelled atomically below
    }
  }

  const now = new Date().toISOString();
  const isManagerCaller = ['owner', 'admin', 'manager', 'supervisor'].includes(normalizedActorRole);
  const explicitShiftId = typeof options?.explicitShiftId === 'string' ? options.explicitShiftId.trim() : '';

  let shift: { id: string; clock_in: string; staff_id: string } | null = null;
  let hasShifts = false;

  if (explicitShiftId && isManagerCaller) {
    try {
      const targetShift = await db
        .prepare(
          `SELECT CAST(id AS TEXT) AS id, clock_in, staff_id FROM staff_shifts
           WHERE CAST(id AS TEXT) = ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND clock_in IS NOT NULL AND clock_out IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM shift_reconciliations sr
               WHERE sr.shift_id = CAST(staff_shifts.id AS TEXT)
                 AND COALESCE(NULLIF(TRIM(sr.tenant_id), ''), 'default') = ?
             )
           LIMIT 1`,
        )
        .bind(explicitShiftId, effectiveOrderTenant, effectiveOrderTenant)
        .first<{ id: string; clock_in: string; staff_id: string }>();
      hasShifts = true;
      if (!targetShift) {
        return {
          success: false,
          statusCode: 409,
          code: 'SHIFT_REQUIRED_FOR_CASH',
          error: 'Ca làm việc chỉ định không tồn tại, đã đóng hoặc đã đối soát (SHIFT_REQUIRED_FOR_CASH)',
        };
      }
      shift = targetShift;
    } catch (err) {
      if (!/no such table:.*\bstaff_shifts\b/i.test(String(err))) {
        return { success: false, statusCode: 409, error: 'Collecting shift schema requires reconciliation' };
      }
    }
  } else {
    let collecting;
    try { collecting = await resolveCashCollectingShift(db, staff, effectiveOrderTenant); }
    catch { return { success: false, statusCode: 409, error: 'Collecting shift schema requires reconciliation' }; }
    hasShifts = collecting.hasShifts;
    if (collecting.shift) {
      shift = { ...collecting.shift, staff_id: staff };
    } else if (!staff) {
      // Probe whether staff_shifts table exists when staffId was omitted
      try {
        await db.prepare('SELECT 1 FROM staff_shifts LIMIT 1').first();
        hasShifts = true;
      } catch (probeErr) {
        if (!/no such table:.*\bstaff_shifts\b/i.test(String(probeErr))) {
          hasShifts = true;
        }
      }
    }
  }

  if (!shift && hasShifts && options?.env) {
    const reconActive = await isCashReconciliationActiveForTenant(options.env, db, effectiveOrderTenant);
    if (reconActive) {
      return {
        success: false,
        statusCode: 409,
        code: 'SHIFT_REQUIRED_FOR_CASH',
        error: 'Cần mở ca làm việc trước khi thu tiền mặt/COD (SHIFT_REQUIRED_FOR_CASH)',
      };
    }
  }

  if (shift && (!hasPaymentsTable || !hasPaymentsTenantColumn)) {
    return { success: false, statusCode: 409, error: 'Shift cash settlement schema unavailable' };
  }
  const shiftStaffId = shift ? shift.staff_id : staff;
  // Pin the exact attendance row: a clock-out/new clock-in must not redirect responsibility.
  const shiftPredicate = shift
    ? ` AND EXISTS (SELECT 1 FROM staff_shifts s WHERE CAST(s.id AS TEXT) = ? AND s.staff_id = ?
        AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ? AND s.clock_in = ? AND s.clock_out IS NULL
        AND NOT EXISTS (SELECT 1 FROM shift_reconciliations r WHERE r.shift_id = CAST(s.id AS TEXT)
          AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?))`
    : hasShifts && staff ? ` AND NOT EXISTS (SELECT 1 FROM staff_shifts s WHERE s.staff_id = ?
        AND COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ? AND s.clock_in IS NOT NULL AND s.clock_out IS NULL)` : '';
  const shiftBinds = shift ? [shift.id, shiftStaffId, effectiveOrderTenant, shift.clock_in, effectiveOrderTenant]
    : hasShifts && staff ? [staff, effectiveOrderTenant] : [];
  const payTenantClause = hasPaymentsTenantColumn ? paymentTenantClause : '';
  const payTenantBinds = hasPaymentsTenantColumn ? paymentLookupBinds : [];
  const ledger = ledgerRows[0];
  const noSettledPayosPredicate = !hasPaymentsTable
    ? ''
    : ` AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND LOWER(COALESCE(method, '')) = 'payos' AND LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'refunded', 'partially_refunded')${payTenantClause})`;
  const noSettledPayosBinds = !hasPaymentsTable ? [] : [id, ...payTenantBinds];
  // Revalidate the ledger snapshot with the order CAS, before any dependent write.
  const ledgerPredicate = !hasPaymentsTable ? '' : ledger
    ? ` AND (SELECT COUNT(*) FROM payments WHERE order_id = ? AND LOWER(COALESCE(method, 'cod')) IN ('cod', 'cash', '')${payTenantClause}) = 1
        AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND order_id = ? AND LOWER(COALESCE(method, 'cod')) IN ('cod', 'cash', '')
          AND status = ? AND amount = ?${payTenantClause})`
    : ` AND NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND LOWER(COALESCE(method, 'cod')) IN ('cod', 'cash', '')${payTenantClause})`;
  const ledgerBinds = !hasPaymentsTable ? [] : ledger
    ? [id, ...payTenantBinds, ledger.id, id, ledger.status, amount, ...payTenantBinds] : [id, ...payTenantBinds];
  const paymentId = ledger?.id || `cod:${id}`;
  const commit = (timestamp: boolean) => {
    const statements = [
      db.prepare(`UPDATE orders SET payment_status = 'paid', ${timestamp ? 'cod_paid_at = COALESCE(cod_paid_at, ?), ' : ''}updated_at = ?
        WHERE id = ? AND status = ? AND payment_status = ?${effectiveOrderClause}${shiftPredicate}${noSettledPayosPredicate}${ledgerPredicate}`)
        .bind(...(timestamp ? [now] : []), now, id, order!.status, order!.payment_status, ...effectiveOrderBinds, ...shiftBinds, ...noSettledPayosBinds, ...ledgerBinds),
      assertCashSettlementWrite(db),
    ];
    if (hasPaymentsTable) {
      if (hasPendingPayosRow) {
        statements.push(
          db.prepare(`UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND LOWER(COALESCE(method, '')) = 'payos' AND status = 'pending'${payTenantClause}`)
            .bind(now, id, ...payTenantBinds),
        );
      }
      statements.push(ledger
        ? db.prepare(`UPDATE payments SET method = COALESCE(NULLIF(TRIM(method), ''), 'cod'), status = 'completed', updated_at = ? WHERE id = ? AND status = ? AND amount = ?${payTenantClause}`)
          .bind(now, ledger.id, ledger.status, amount, ...payTenantBinds)
        : db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, ${hasPaymentsTenantColumn ? 'tenant_id, ' : ''}created_at, updated_at)
            VALUES (?, ?, 'cod', ?, 'completed', ${hasPaymentsTenantColumn ? '?, ' : ''}?, ?)`)
          .bind(paymentId, id, amount, ...(hasPaymentsTenantColumn ? [effectiveOrderTenant] : []), now, now),
      assertCashSettlementWrite(db));
    }
    if (shift) {
      statements.push(
        db.prepare(`INSERT INTO cash_payment_attributions (payment_id, tenant_id, shift_id, collected_by, settled_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(paymentId, effectiveOrderTenant, shift.id, staff || shiftStaffId, now),
        assertCashSettlementWrite(db),
        db.prepare(`UPDATE staff_shifts SET cash_sales = COALESCE(cash_sales, 0) + ?,
            total_sales = COALESCE(total_sales, 0) + ?, order_count = COALESCE(order_count, 0) + 1
          WHERE CAST(id AS TEXT) = ? AND staff_id = ? AND clock_in = ? AND clock_out IS NULL
            AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
            AND NOT EXISTS (SELECT 1 FROM shift_reconciliations r WHERE r.shift_id = ?
              AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?)`)
          .bind(amount, amount, shift.id, shiftStaffId, shift.clock_in, effectiveOrderTenant, shift.id, effectiveOrderTenant),
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
