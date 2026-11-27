import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { restoreLoyaltyVoucherForOrder } from '../loyalty-voucher';
import { releaseTableIfNoActiveOrders } from './table-occupancy-release';

export interface CashRefundShiftAdjustmentParams {
  paymentId: string;
  orderId: string;
  tenant: string;
  amount: number;
  fullRefund: boolean;
  payoutKey: string;
  actorId?: string | null;
  reason?: string;
  now: string;
}

/**
 * Keeps shift cash expectations exact when a settled cash/COD payment is refunded
 * (either via authorized paid-order cancellation or via manual full/partial cash refund).
 *
 * - If the payment belongs to a STILL-OPEN, UNRECONCILED shift:
 *   - Decrements that shift's `cash_sales` / `total_sales` (and `order_count` on full refund).
 *   - On full refund (`payments.status = 'refunded'`), `getCashPaymentsForShift` already excludes
 *     the payment, so any prior partial-refund `cash_payouts` for that payment on the same shift
 *     are cancelled to avoid double subtraction.
 *   - On partial refund (`payments.status = 'completed'`), records a completed `cash_payouts`
 *     entry on that shift so `expected_cash = opening_float + cash_payments - cash_payouts` matches.
 * - If the collecting shift was ALREADY closed/reconciled (or unattributed), records a completed
 *   `cash_payouts` entry against the currently open unreconciled cash-drawer shift in the tenant.
 */
export async function adjustShiftCustodyForCashRefund(
  db: D1Database,
  params: CashRefundShiftAdjustmentParams,
): Promise<void> {
  const { paymentId, orderId, tenant, amount, fullRefund, payoutKey, actorId, reason, now } = params;
  if (!(amount > 0)) return;

  const cleanTenant = (tenant || '').trim() || 'default';
  let attributedShiftId: string | null = null;
  try {
    const attr = await db
      .prepare(
        "SELECT shift_id FROM cash_payment_attributions WHERE payment_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(paymentId, cleanTenant)
      .first<{ shift_id?: string | null }>();
    if (attr?.shift_id && String(attr.shift_id).trim()) {
      attributedShiftId = String(attr.shift_id).trim();
    }
  } catch {
    // cash_payment_attributions absent in minimal test schemas
  }

  let openAttributedShiftId: string | null = null;
  if (attributedShiftId) {
    try {
      const openShift = await db
        .prepare(
          `SELECT CAST(id AS TEXT) AS id FROM staff_shifts
           WHERE CAST(id AS TEXT) = ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND clock_in IS NOT NULL AND clock_out IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM shift_reconciliations r
               WHERE r.shift_id = CAST(staff_shifts.id AS TEXT)
                 AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
             )
           LIMIT 1`,
        )
        .bind(attributedShiftId, cleanTenant, cleanTenant)
        .first<{ id?: string }>();
      if (openShift?.id) {
        openAttributedShiftId = String(openShift.id);
      }
    } catch {
      // staff_shifts / shift_reconciliations absent in minimal test schemas
    }
  }

  if (openAttributedShiftId) {
    try {
      await db
        .prepare(
          `UPDATE staff_shifts
           SET cash_sales = MAX(0, COALESCE(cash_sales, 0) - ?),
               total_sales = MAX(0, COALESCE(total_sales, 0) - ?),
               order_count = CASE WHEN ? = 1 AND COALESCE(order_count, 0) > 0 THEN order_count - 1 ELSE order_count END
           WHERE CAST(id AS TEXT) = ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(amount, amount, fullRefund ? 1 : 0, openAttributedShiftId, cleanTenant)
        .run();
    } catch {
      // Optional sales columns in minimal test schemas
    }

    if (fullRefund) {
      try {
        await db
          .prepare(
            `UPDATE cash_payouts
             SET status = 'cancelled'
             WHERE shift_id = ?
               AND id LIKE ?
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(openAttributedShiftId, `cpo_pref_${paymentId}_%`, cleanTenant)
          .run();
      } catch {
        // Optional cash_payouts table
      }
    } else {
      const partialPayoutId = `cpo_pref_${paymentId}_${payoutKey}`.slice(0, 120);
      const payoutReason = reason || `Hoàn tiền mặt một phần đơn ${orderId}`;
      try {
        await db
          .prepare(
            `INSERT OR IGNORE INTO cash_payouts (id, tenant_id, shift_id, amount, reason, status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)`,
          )
          .bind(partialPayoutId, cleanTenant, openAttributedShiftId, amount, payoutReason, actorId || 'system', now)
          .run();
      } catch {
        try {
          await db
            .prepare(
              `INSERT OR IGNORE INTO cash_payouts (id, tenant_id, shift_id, amount, status)
               VALUES (?, ?, ?, ?, 'completed')`,
            )
            .bind(partialPayoutId, cleanTenant, openAttributedShiftId, amount)
            .run();
        } catch {
          // Optional cash_payouts table
        }
      }
    }
    return;
  }

  // Collecting shift was already closed/reconciled (or unattributed): record a payout against
  // the currently open unreconciled drawer shift in this tenant so drawer cash stays balanced.
  let activeDrawerShiftId: string | null = null;
  try {
    const cleanActor = (actorId || '').trim();
    if (cleanActor) {
      const actorShift = await db
        .prepare(
          `SELECT CAST(id AS TEXT) AS id FROM staff_shifts
           WHERE staff_id = ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND clock_in IS NOT NULL AND clock_out IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM shift_reconciliations r
               WHERE r.shift_id = CAST(staff_shifts.id AS TEXT)
                 AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
             )
           ORDER BY clock_in DESC, id DESC LIMIT 1`,
        )
        .bind(cleanActor, cleanTenant, cleanTenant)
        .first<{ id?: string }>();
      if (actorShift?.id) activeDrawerShiftId = String(actorShift.id);
    }
    if (!activeDrawerShiftId) {
      const fallbackShift = await db
        .prepare(
          `SELECT CAST(id AS TEXT) AS id FROM staff_shifts
           WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND clock_in IS NOT NULL AND clock_out IS NULL
             AND LOWER(COALESCE(role, '')) NOT IN ('barista', 'kitchen', 'chef', 'bep')
             AND NOT EXISTS (
               SELECT 1 FROM shift_reconciliations r
               WHERE r.shift_id = CAST(staff_shifts.id AS TEXT)
                 AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?
             )
           ORDER BY CASE WHEN LOWER(COALESCE(role, '')) IN ('cashier', 'owner', 'admin', 'manager', 'supervisor') THEN 0 ELSE 1 END, clock_in DESC
           LIMIT 1`,
        )
        .bind(cleanTenant, cleanTenant)
        .first<{ id?: string }>();
      if (fallbackShift?.id) activeDrawerShiftId = String(fallbackShift.id);
    }
  } catch {
    // staff_shifts absent in minimal test schemas
  }

  const closedShiftPayoutId = `cpo_ref_${paymentId}_${payoutKey}`.slice(0, 120);
  const payoutReason = reason || `Hoàn tiền mặt đơn ${orderId}`;
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO cash_payouts (id, tenant_id, shift_id, amount, reason, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)`,
      )
      .bind(closedShiftPayoutId, cleanTenant, activeDrawerShiftId, amount, payoutReason, actorId || 'system', now)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO cash_payouts (id, tenant_id, shift_id, amount, status)
           VALUES (?, ?, ?, ?, 'completed')`,
        )
        .bind(closedShiftPayoutId, cleanTenant, activeDrawerShiftId, amount)
        .run();
    } catch {
      // Optional cash_payouts table
    }
  }
}

export interface CompensateVoidedOrderParams {
  db: D1Database;
  env?: Record<string, unknown>;
  kv?: KVNamespace | null;
  orderId: string;
  tenantId: string;
  now?: string;
  reason?: string;
  preCancelStatus?: string;
  actorId?: string | null;
  /** Skip inventory restoration if caller already ran it explicitly. */
  skipInventoryRestore?: boolean;
  /** Skip table/session release if caller handles table state separately (e.g. split parent). */
  skipTableRelease?: boolean;
  /** Skip earned accrual reversal when caller delegates accrual reversal to refund_loyalty_work. */
  skipAccrualReversal?: boolean;
}

/**
 * Shared idempotent rollback coordinator for voided orders (`cancelled`, `failed`, `expired`)
 * and full refunds. Safely restores:
 * - BOM & SKU inventory (`release` pre-prep, `waste` post-prep)
 * - Paid Cash/COD payments -> `'refunded'` + shift `cash_sales` / `cash_payouts` compensation
 * - Paid PayOS/online orders -> preserves `payment_status = 'paid'` + review marker for manual refund
 * - `cashback_used` wallet balance
 * - `loyalty_points_redeemed` customer points
 * - `loyalty_vouchers` (`'active'`)
 * - `promotions` / `promotion_redemptions` / `promotion_usages` counters
 * - Accrued loyalty / referral reversals (if already earned)
 * - `table_sessions` & `cafe_tables` occupancy
 */
export async function compensateVoidedOrder(params: CompensateVoidedOrderParams): Promise<{
  cashRefunded: boolean;
  onlineRefundRequired: boolean;
}> {
  const {
    db,
    env,
    kv,
    orderId,
    now = new Date().toISOString(),
    reason = 'order_cancelled',
    preCancelStatus,
    actorId,
    skipInventoryRestore = false,
    skipTableRelease = false,
    skipAccrualReversal = false,
  } = params;
  const rawTenant = (params.tenantId || '').trim() || 'default';
  const tenant = rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? 'default' : rawTenant;

  type VoidOrdSnapshot = {
    id?: string;
    total?: number | null;
    total_amount?: number | null;
    status?: string | null;
    payment_status?: string | null;
    payment_method?: string | null;
    is_cod?: number | null;
    table_id?: string | null;
    session_id?: string | null;
    customer_id?: string | null;
    cashback_used?: number | null;
    loyalty_points_redeemed?: number | null;
    tenant_id?: string | null;
  };

  let ordRow: VoidOrdSnapshot | null = null;
  try {
    ordRow = await db
      .prepare(
        "SELECT id, total, total_amount, status, payment_status, payment_method, is_cod, table_id, session_id, customer_id, cashback_used, loyalty_points_redeemed, tenant_id FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(orderId, tenant)
      .first<VoidOrdSnapshot>();
  } catch {
    try {
      ordRow = await db
        .prepare(
          "SELECT id, total, status, payment_status, payment_method, table_id, customer_id, cashback_used, loyalty_points_redeemed, tenant_id FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(orderId, tenant)
        .first<VoidOrdSnapshot>();
    } catch {
      try {
        ordRow = await db
          .prepare('SELECT * FROM orders WHERE id = ? LIMIT 1')
          .bind(orderId)
          .first<VoidOrdSnapshot>();
      } catch {
        ordRow = null;
      }
    }
  }

  const effectiveTenant =
    ordRow?.tenant_id &&
    String(ordRow.tenant_id).trim() &&
    String(ordRow.tenant_id).trim() !== '*' &&
    String(ordRow.tenant_id).trim().toLowerCase() !== 'hq'
      ? String(ordRow.tenant_id).trim()
      : tenant;

  // 1. Inventory restoration / post-prep waste spoilage
  if (!skipInventoryRestore) {
    try {
      const { restoreInventoryForOrder } = await import('@aura/domain-inventory');
      await restoreInventoryForOrder(
        { AURA_DB: db as never, ...(env || {}) },
        orderId,
        effectiveTenant,
        preCancelStatus,
      );
    } catch {
      // Optional inventory tables in partial schemas
    }
  }

  // 2. Cancel open PayOS provider link & pending payment rows
  try {
    const { cancelOpenPayOSAttemptForOrder } = await import('@aura/domain-payment');
    await cancelOpenPayOSAttemptForOrder(db, (env || {}) as Record<string, unknown>, orderId, effectiveTenant).catch(() => {});
  } catch {
    // Optional payment module
  }

  try {
    await db
      .prepare(
        "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
      )
      .bind(now, orderId, effectiveTenant)
      .run()
      .catch(async () => {
        try {
          await db
            .prepare(
              "UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(orderId, effectiveTenant)
            .run();
        } catch {
          if (effectiveTenant === 'default') {
            await db
              .prepare("UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND status = 'pending'")
              .bind(now, orderId)
              .run()
              .catch(() =>
                db.prepare("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'").bind(orderId).run().catch(() => {}),
              );
          }
        }
      });
  } catch {
    // Optional payments table
  }

  // 3. Paid Cash/COD compensation OR Paid Online refund-tracking marker
  let cashRefunded = false;
  let onlineRefundRequired = false;
  const ordPayStatus = String(ordRow?.payment_status ?? '').trim().toLowerCase();
  const ordPayMethod = String(ordRow?.payment_method ?? '').trim().toLowerCase();
  const isCodOrder = ordPayMethod ? ['cod', 'cash'].includes(ordPayMethod) : Number(ordRow?.is_cod ?? 0) === 1;

  try {
    type SettledPayRow = { id: string; method?: string | null; amount?: number | null; refund_amount?: number | null; status?: string | null };
    let settledRows: SettledPayRow[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT id, method, amount, refund_amount, status FROM payments
           WHERE order_id = ?
             AND LOWER(COALESCE(status, '')) IN ('completed', 'paid')
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(orderId, effectiveTenant)
        .all<SettledPayRow>();
      settledRows = res.results ?? [];
    } catch {
      try {
        const res = await db
          .prepare(
            `SELECT id, method, amount, status FROM payments
             WHERE order_id = ?
               AND LOWER(COALESCE(status, '')) IN ('completed', 'paid')
               AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(orderId, effectiveTenant)
          .all<SettledPayRow>();
        settledRows = res.results ?? [];
      } catch {
        if (effectiveTenant === 'default') {
          const res = await db
            .prepare(
              `SELECT id, method, amount, status FROM payments
               WHERE order_id = ? AND LOWER(COALESCE(status, '')) IN ('completed', 'paid')`,
            )
            .bind(orderId)
            .all<SettledPayRow>()
            .catch(() => ({ results: [] }));
          settledRows = res.results ?? [];
        }
      }
    }

    for (const pay of settledRows) {
      const m = String(pay.method ?? '').trim().toLowerCase();
      if (m === 'cod' || m === 'cash' || (!m && isCodOrder)) {
        const unrefunded = Math.max(0, Number(pay.amount ?? 0) - Math.max(0, Number(pay.refund_amount ?? 0)));
        let updatedChanges = 0;
        try {
          const upd = await db
            .prepare(
              `UPDATE payments
               SET status = 'refunded',
                   refund_status = 'completed',
                   refund_amount = amount,
                   refund_reason = COALESCE(refund_reason, ?),
                   refunded_at = COALESCE(refunded_at, ?),
                   updated_at = ?
               WHERE id = ? AND LOWER(COALESCE(status, '')) IN ('completed', 'paid')`,
            )
            .bind(reason, now, now, pay.id)
            .run();
          updatedChanges = Number(upd?.meta?.changes ?? (upd as unknown as { changes?: number })?.changes ?? 1);
        } catch {
          const upd = await db
            .prepare(
              `UPDATE payments
               SET status = 'refunded', updated_at = ?
               WHERE id = ? AND LOWER(COALESCE(status, '')) IN ('completed', 'paid')`,
            )
            .bind(now, pay.id)
            .run()
            .catch(() => null);
          updatedChanges = upd ? Number(upd?.meta?.changes ?? (upd as unknown as { changes?: number })?.changes ?? 1) : 0;
        }
        if (updatedChanges > 0 && unrefunded > 0) {
          await db
            .prepare(
              `INSERT OR IGNORE INTO payment_refund_transfers
               (tenant_id, manual_transfer_ref, payment_id, amount, reason, actor_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(tenant, `void_cash:${pay.id}`, pay.id, unrefunded, reason, actorId || 'system', now)
            .run()
            .catch(() => {});
        }
        if (updatedChanges > 0) {
          cashRefunded = true;
          await adjustShiftCustodyForCashRefund(db, {
            paymentId: pay.id,
            orderId,
            tenant: effectiveTenant,
            amount: unrefunded,
            fullRefund: true,
            payoutKey: 'void',
            actorId,
            reason: `Hoàn tiền mặt huỷ đơn ${orderId}: ${reason}`,
            now,
          });
        }
      } else if (m === 'payos' || m === 'bank_transfer' || m === 'qr' || m === 'vietqr') {
        onlineRefundRequired = true;
      }
    }

    if (!cashRefunded && isCodOrder && (ordPayStatus === 'paid' || ordPayStatus === 'completed')) {
      // Schema or legacy order marked paid on COD without a completed payments row
      cashRefunded = true;
    }
    if (!cashRefunded && !isCodOrder && (ordPayStatus === 'paid' || ordPayStatus === 'completed' || ordPayStatus === 'partially_refunded')) {
      onlineRefundRequired = true;
    }

    if (cashRefunded) {
      await db
        .prepare(
          "UPDATE orders SET payment_status = 'refunded', updated_at = ? WHERE id = ? AND LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed', 'partially_refunded') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
        )
        .bind(now, orderId, effectiveTenant)
        .run()
        .catch(() => {
          if (effectiveTenant === 'default') {
            return db
              .prepare(
                "UPDATE orders SET payment_status = 'refunded', updated_at = ? WHERE id = ? AND LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed', 'partially_refunded')",
              )
              .bind(now, orderId)
              .run()
              .catch(() => {});
          }
        });
    } else if (onlineRefundRequired) {
      const reviewTag = '[PAID_ORDER_VOIDED_REFUND_REQUIRED]';
      await db
        .prepare(
          `UPDATE orders
           SET notes = CASE
             WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
             WHEN INSTR(notes, ?) > 0 THEN notes
             ELSE notes || ' ' || ?
           END,
           updated_at = ?
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(reviewTag, reviewTag, reviewTag, now, orderId, effectiveTenant)
        .run()
        .catch(() => {
          if (effectiveTenant === 'default') {
            return db
              .prepare(
                `UPDATE orders
                 SET notes = CASE
                   WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
                   WHEN INSTR(notes, ?) > 0 THEN notes
                   ELSE notes || ' ' || ?
                 END,
                 updated_at = ?
                 WHERE id = ?`,
              )
              .bind(reviewTag, reviewTag, reviewTag, now, orderId)
              .run()
              .catch(() => {});
          }
        });
      const effectiveKv = kv ?? ((env?.AUTH_KV as KVNamespace | undefined) ?? null);
      if (effectiveKv) {
        const markerKey =
          effectiveTenant === 'default'
            ? `payment:refund_required:${orderId}`
            : `payment:refund_required:${effectiveTenant}:${orderId}`;
        await effectiveKv
          .put(
            markerKey,
            JSON.stringify({
              orderId,
              tenantId: effectiveTenant,
              reason,
              stage: 'paid_order_voided',
              errorCode: 'PAID_ORDER_REFUND_REQUIRED',
              detectedAt: now,
            }),
            { expirationTtl: 86400 * 30 },
          )
          .catch(() => {});
      }
    }
  } catch {
    // Non-blocking payment compensation on partial test schemas
  }

  // 4. Reverse earned loyalty / cashback accrual & customer total_spent if already credited
  let accruedCustomerDecremented = false;
  if (!skipAccrualReversal) {
  try {
    let earnRow = await db
      .prepare(
        "SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(orderId, effectiveTenant)
      .first<{ customer_id?: string }>()
      .catch(() => null);
    if (!earnRow && effectiveTenant === 'default') {
      const fb = await db
        .prepare("SELECT customer_id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1")
        .bind(orderId)
        .first<{ customer_id?: string; tenant_id?: string | null }>()
        .catch(() => null);
      if (fb && (!('tenant_id' in fb) || fb.tenant_id === undefined || (String(fb.tenant_id ?? '').trim() || 'default') === effectiveTenant)) {
        earnRow = fb;
      }
    }
    if (!earnRow) {
      let ptRow = await db
        .prepare(
          "SELECT customer_id FROM loyalty_point_logs WHERE order_id = ? AND points_change > 0 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(orderId, effectiveTenant)
        .first<{ customer_id?: string }>()
        .catch(() => null);
      if (!ptRow && effectiveTenant === 'default') {
        const fbPt = await db
          .prepare('SELECT customer_id FROM loyalty_point_logs WHERE order_id = ? AND points_change > 0 LIMIT 1')
          .bind(orderId)
          .first<{ customer_id?: string; tenant_id?: string | null }>()
          .catch(() => null);
        if (fbPt && (!('tenant_id' in fbPt) || fbPt.tenant_id === undefined || (String(fbPt.tenant_id ?? '').trim() || 'default') === effectiveTenant)) {
          ptRow = fbPt;
        }
      }
      if (ptRow?.customer_id) earnRow = ptRow;
    }
    if (earnRow?.customer_id) {
      const totalVnd = Number(ordRow?.total ?? ordRow?.total_amount ?? 0);
      const { loadPolicy, reverseAccrual } = await import('@aura/domain-crm');
      const effectiveKv = kv ?? ((env?.AUTH_KV as KVNamespace | undefined) ?? undefined);
      const policy = await loadPolicy(db, effectiveKv as never, new Date(), effectiveTenant).catch(() => null);
      if (policy) {
        await reverseAccrual(db, policy, {
          orderId,
          customerId: earnRow.customer_id,
          refundAmountVnd: totalVnd,
          tenantId: effectiveTenant,
          reason,
        }).catch(() => {});
      }
      if (totalVnd > 0) {
        accruedCustomerDecremented = true;
        await db
          .prepare(
            "UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          )
          .bind(totalVnd, earnRow.customer_id, effectiveTenant)
          .run()
          .catch(() => {
            if (effectiveTenant === 'default') {
              return db
                .prepare('UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ?')
                .bind(totalVnd, earnRow!.customer_id)
                .run()
                .catch(() => {});
            }
          });
      }
    }
  } catch {
    // Optional CRM tables
  }
  }

  // 5. Restore spent cashback_used wallet funds idempotently
  try {
    const existingRefund = await db
      .prepare(
        "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(orderId, effectiveTenant)
      .first<{ id?: string }>()
      .catch(() =>
        effectiveTenant === 'default'
          ? db
              .prepare("SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'refund' LIMIT 1")
              .bind(orderId)
              .first<{ id?: string }>()
              .catch(() => null)
          : null,
      );
    if (!existingRefund?.id) {
      const spendRow = await db
        .prepare(
          "SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type IN ('spend', 'redeem') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(orderId, effectiveTenant)
        .first<{ id?: string; customer_id?: string; amount?: number }>()
        .catch(() =>
          effectiveTenant === 'default'
            ? db
                .prepare("SELECT id, customer_id, amount FROM cashback_transactions WHERE order_id = ? AND type = 'spend' LIMIT 1")
                .bind(orderId)
                .first<{ id?: string; customer_id?: string; amount?: number }>()
                .catch(() => null)
            : null,
        );
      let refundCustomerId = spendRow?.customer_id ? String(spendRow.customer_id).trim() : '';
      let refundAmount = Math.abs(Number(spendRow?.amount ?? 0));
      if (!refundCustomerId && ordRow?.customer_id) {
        refundCustomerId = String(ordRow.customer_id).trim();
      }
      if (!(refundAmount > 0) && Number(ordRow?.cashback_used ?? 0) > 0) {
        refundAmount = Number(ordRow?.cashback_used ?? 0);
      }
      if (refundCustomerId && refundAmount > 0) {
        const wRow = await db
          .prepare(
            "SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
          )
          .bind(refundCustomerId, effectiveTenant)
          .first<{ id?: string; balance?: number }>()
          .catch(() =>
            effectiveTenant === 'default'
              ? db
                  .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ? LIMIT 1')
                  .bind(refundCustomerId)
                  .first<{ id?: string; balance?: number }>()
                  .catch(() => null)
              : null,
          );
        const walletId = wRow?.id || `wal_${refundCustomerId}`;
        const balanceAfter = Number(wRow?.balance ?? 0) + refundAmount;
        const refundTxId = `cb_ref_${orderId}`;
        let insertedRefund = true;
        try {
          const insRes = await db
            .prepare(
              `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, tenant_id, created_at)
               SELECT ?, ?, ?, ?, 'refund', ?, ?, ?, datetime('now')
               WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
            )
            .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, balanceAfter, effectiveTenant, orderId, effectiveTenant)
            .run()
            .catch(() =>
              db
                .prepare(
                  `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, tenant_id, created_at)
                   SELECT ?, ?, ?, ?, 'refund', ?, ?, datetime('now')
                   WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
                )
                .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, effectiveTenant, orderId, effectiveTenant)
                .run()
                .catch(() =>
                  db
                    .prepare(
                      `INSERT INTO cashback_transactions (id, customer_id, order_id, type, amount, balance_after, tenant_id)
                       SELECT ?, ?, ?, 'refund', ?, ?, ?
                       WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`,
                    )
                    .bind(refundTxId, refundCustomerId, orderId, refundAmount, balanceAfter, effectiveTenant, orderId, effectiveTenant)
                    .run(),
                ),
            );
          const changes =
            (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes ??
            (insRes as unknown as { changes?: number })?.changes;
          if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
        } catch {
          if (effectiveTenant === 'default') {
            try {
              const insRes = await db
                .prepare(
                  `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, created_at)
                   SELECT ?, ?, ?, ?, 'refund', ?, ?, datetime('now')
                   WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund')`,
                )
                .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, balanceAfter, orderId)
                .run()
                .catch(() =>
                  db
                    .prepare(
                      `INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, created_at)
                       SELECT ?, ?, ?, ?, 'refund', ?, datetime('now')
                       WHERE NOT EXISTS (SELECT 1 FROM cashback_transactions WHERE order_id = ? AND type = 'refund')`,
                    )
                    .bind(refundTxId, walletId, refundCustomerId, orderId, refundAmount, orderId)
                    .run(),
                );
              const changes =
                (insRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes ??
                (insRes as unknown as { changes?: number })?.changes;
              if (changes !== undefined && Number(changes) === 0) insertedRefund = false;
            } catch {
              try {
                await db
                  .prepare(
                    "INSERT INTO cashback_transactions (id, customer_id, order_id, type, amount, created_at) VALUES (?, ?, ?, 'refund', ?, datetime('now'))",
                  )
                  .bind(refundTxId, refundCustomerId, orderId, refundAmount)
                  .run();
              } catch {
                // Optional cashback_transactions schema differences
              }
            }
          } else {
            insertedRefund = false;
          }
        }
        if (insertedRefund) {
          await db
            .prepare(
              "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(refundAmount, refundAmount, refundCustomerId, effectiveTenant)
            .run()
            .catch(async () => {
              try {
                await db
                  .prepare(
                    "UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                  )
                  .bind(refundAmount, refundCustomerId, effectiveTenant)
                  .run();
              } catch {
                if (effectiveTenant === 'default') {
                  await db
                    .prepare(
                      "UPDATE cashback_wallets SET balance = balance + ?, total_spent = MAX(0, COALESCE(total_spent, 0) - ?), updated_at = datetime('now') WHERE customer_id = ?",
                    )
                    .bind(refundAmount, refundAmount, refundCustomerId)
                    .run()
                    .catch(() =>
                      db
                        .prepare("UPDATE cashback_wallets SET balance = balance + ?, updated_at = datetime('now') WHERE customer_id = ?")
                        .bind(refundAmount, refundCustomerId)
                        .run()
                        .catch(() => {}),
                    );
                }
                // Fallback for schemas storing cashback directly on customers.cashback_balance
                await db
                  .prepare(
                    "UPDATE customers SET cashback_balance = COALESCE(cashback_balance, 0) + ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                  )
                  .bind(refundAmount, refundCustomerId, effectiveTenant)
                  .run()
                  .catch(() => {});
              }
            });
          if (!accruedCustomerDecremented && !skipAccrualReversal) {
            await db
              .prepare(
                "UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
              )
              .bind(refundAmount, refundCustomerId, effectiveTenant)
              .run()
              .catch(() => {
                if (effectiveTenant === 'default') {
                  return db
                    .prepare('UPDATE customers SET total_spent = MAX(0, COALESCE(total_spent, 0) - ?) WHERE id = ?')
                    .bind(refundAmount, refundCustomerId)
                    .run()
                    .catch(() => {});
                }
              });
          }
          await db
            .prepare("UPDATE orders SET cashback_used = 0 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(orderId, effectiveTenant)
            .run()
            .catch(() => {
              if (effectiveTenant === 'default') {
                return db.prepare('UPDATE orders SET cashback_used = 0 WHERE id = ?').bind(orderId).run().catch(() => {});
              }
            });
        }
      }
    }
  } catch {
    // Optional cashback tables
  }

  // 6. Restore loyalty_points_redeemed idempotently
  try {
    let redeemedPts = Math.max(0, Math.floor(Number(ordRow?.loyalty_points_redeemed ?? 0)));
    let redeemCustId = ordRow?.customer_id ? String(ordRow.customer_id).trim() : '';
    if (!redeemedPts || !redeemCustId) {
      const redeemTx = await db
        .prepare(
          "SELECT customer_id, ABS(points) AS pts FROM loyalty_transactions WHERE order_id = ? AND type = 'redeem' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        )
        .bind(orderId, effectiveTenant)
        .first<{ customer_id?: string; pts?: number }>()
        .catch(() =>
          effectiveTenant === 'default'
            ? db
                .prepare("SELECT customer_id, ABS(points) AS pts FROM loyalty_transactions WHERE order_id = ? AND type = 'redeem' LIMIT 1")
                .bind(orderId)
                .first<{ customer_id?: string; pts?: number }>()
                .catch(() => null)
            : null,
        );
      if (redeemTx?.pts && !redeemedPts) redeemedPts = Number(redeemTx.pts);
      if (redeemTx?.customer_id && !redeemCustId) redeemCustId = String(redeemTx.customer_id);
    }
    if (redeemedPts > 0 && redeemCustId) {
      const alreadyRefunded = await db
        .prepare("SELECT id FROM loyalty_transactions WHERE order_id = ? AND type = 'refund_redeem' LIMIT 1")
        .bind(orderId)
        .first<{ id: string }>()
        .catch(() => null);
      if (!alreadyRefunded) {
        const refundDesc = `Hoàn trả ${redeemedPts} điểm do hủy đơn ${orderId}`;
        let txClaimed = false;
        try {
          const txRes = await db
            .prepare(
              `INSERT INTO loyalty_transactions (id, customer_id, order_id, points, type, description, idempotency_key, tenant_id, created_at)
               SELECT ?, ?, ?, ?, 'refund_redeem', ?, ?, ?, ?
               WHERE NOT EXISTS (SELECT 1 FROM loyalty_transactions WHERE order_id = ? AND type = 'refund_redeem')`,
            )
            .bind(`LTX_REF_${orderId}`, redeemCustId, orderId, redeemedPts, refundDesc, `refund_redeem:${orderId}`, effectiveTenant, now, orderId)
            .run();
          txClaimed = (txRes?.meta?.changes ?? (txRes as unknown as { changes?: number })?.changes ?? 1) > 0;
        } catch {
          const txRes2 = await db
            .prepare(
              `INSERT INTO loyalty_transactions (id, customer_id, order_id, points, type, description, tenant_id, created_at)
               SELECT ?, ?, ?, ?, 'refund_redeem', ?, ?, ?
               WHERE NOT EXISTS (SELECT 1 FROM loyalty_transactions WHERE order_id = ? AND type = 'refund_redeem')`,
            )
            .bind(`LTX_REF_${orderId}`, redeemCustId, orderId, redeemedPts, refundDesc, effectiveTenant, now, orderId)
            .run()
            .catch(() =>
              effectiveTenant === 'default'
                ? db
                    .prepare(
                      `INSERT INTO loyalty_transactions (id, customer_id, order_id, points, type, description, created_at)
                       SELECT ?, ?, ?, ?, 'refund_redeem', ?, ?
                       WHERE NOT EXISTS (SELECT 1 FROM loyalty_transactions WHERE order_id = ? AND type = 'refund_redeem')`,
                    )
                    .bind(`LTX_REF_${orderId}`, redeemCustId, orderId, redeemedPts, refundDesc, now, orderId)
                    .run()
                    .catch(() => null)
                : Promise.resolve(null),
            );
          txClaimed = Boolean(txRes2 && (txRes2.meta?.changes ?? (txRes2 as unknown as { changes?: number })?.changes ?? 1) > 0);
        }
        if (txClaimed) {
          await db
            .prepare(
              "UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
            )
            .bind(redeemedPts, redeemCustId, effectiveTenant)
            .run()
            .catch(async () => {
              if (effectiveTenant === 'default') {
                await db
                  .prepare('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?')
                  .bind(redeemedPts, redeemCustId)
                  .run()
                  .catch(() => {});
              }
            });
          await db
            .prepare("UPDATE orders SET loyalty_points_redeemed = 0 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(orderId, effectiveTenant)
            .run()
            .catch(() => {
              if (effectiveTenant === 'default') {
                return db.prepare('UPDATE orders SET loyalty_points_redeemed = 0 WHERE id = ?').bind(orderId).run().catch(() => {});
              }
            });
        }
      }
    }
  } catch {
    // Optional loyalty_transactions table
  }

  // 7. Restore loyalty voucher idempotently
  try {
    await restoreLoyaltyVoucherForOrder(db, orderId, effectiveTenant);
  } catch {
    // Optional loyalty_vouchers table
  }

  // 8. Reverse first-order referral cashback if completed on this order
  try {
    const refRow = await db
      .prepare(
        "SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(orderId, effectiveTenant)
      .first<{ id?: string }>()
      .catch(() =>
        effectiveTenant === 'default'
          ? db
              .prepare("SELECT id FROM referrals WHERE first_order_id = ? AND status = 'completed' LIMIT 1")
              .bind(orderId)
              .first<{ id?: string }>()
              .catch(() => null)
          : null,
      );
    if (refRow?.id) {
      const { reverseReferralCashback } = await import('@aura/domain-crm');
      await reverseReferralCashback(db, refRow.id, effectiveTenant).catch(() => {});
    }
  } catch {
    // Optional referrals table
  }

  // 9. Restore promotions & promotion_redemptions / promotion_usages idempotently
  const decrementedPromoIds = new Set<string>();
  try {
    const redRow = await db
      .prepare(
        "SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(orderId, effectiveTenant)
      .first<{ promotion_id?: string; code?: string }>()
      .catch(() =>
        effectiveTenant === 'default'
          ? db
              .prepare('SELECT promotion_id, code FROM promotion_redemptions WHERE order_id = ? LIMIT 1')
              .bind(orderId)
              .first<{ promotion_id?: string; code?: string }>()
              .catch(() => null)
          : null,
      );
    if (redRow && (redRow.promotion_id || redRow.code)) {
      const delRes = await db
        .prepare("DELETE FROM promotion_redemptions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(orderId, effectiveTenant)
        .run()
        .catch(() =>
          effectiveTenant === 'default'
            ? db.prepare('DELETE FROM promotion_redemptions WHERE order_id = ?').bind(orderId).run().catch(() => null)
            : Promise.resolve(null),
        );
      const delChanges =
        (delRes as unknown as { meta?: { changes?: number }; changes?: number } | null)?.meta?.changes ??
        (delRes as unknown as { changes?: number } | null)?.changes;
      if (delRes && (delChanges === undefined || Number(delChanges) > 0)) {
        if (redRow.promotion_id) {
          decrementedPromoIds.add(String(redRow.promotion_id).trim());
          await db
            .prepare(
              `UPDATE promotions
               SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
                   used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
                   usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
            )
            .bind(redRow.promotion_id, effectiveTenant)
            .run()
            .catch(async () => {
              try {
                await db
                  .prepare(
                    "UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                  )
                  .bind(redRow.promotion_id, effectiveTenant)
                  .run();
              } catch {
                if (effectiveTenant === 'default') {
                  await db
                    .prepare('UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE id = ?')
                    .bind(redRow.promotion_id)
                    .run()
                    .catch(() => {});
                }
              }
            });
        } else if (redRow.code) {
          await db
            .prepare(
              `UPDATE promotions
               SET current_uses = CASE WHEN COALESCE(current_uses, 0) > 0 THEN current_uses - 1 ELSE 0 END,
                   used_count = CASE WHEN COALESCE(used_count, 0) > 0 THEN used_count - 1 ELSE 0 END,
                   usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END
               WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
            )
            .bind(redRow.code, effectiveTenant)
            .run()
            .catch(async () => {
              try {
                await db
                  .prepare(
                    "UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
                  )
                  .bind(redRow.code, effectiveTenant)
                  .run();
              } catch {
                if (effectiveTenant === 'default') {
                  await db
                    .prepare('UPDATE promotions SET usage_count = CASE WHEN COALESCE(usage_count, 0) > 0 THEN usage_count - 1 ELSE 0 END WHERE UPPER(code) = UPPER(?)')
                    .bind(redRow.code)
                    .run()
                    .catch(() => {});
                }
              }
            });
        }
      }
    }
  } catch {
    // Optional promotion_redemptions table
  }

  try {
    const usageRes = await db
      .prepare("SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(orderId, effectiveTenant)
      .all<{ id?: string; promotion_id?: string }>()
      .catch(async () => {
        if (effectiveTenant !== 'default') {
          const singleTenant = await db
            .prepare("SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1")
            .bind(orderId, effectiveTenant)
            .first<{ id?: string; promotion_id?: string }>()
            .catch(() => null);
          return { results: singleTenant ? [singleTenant] : [] };
        }
        const fbAll = await db
          .prepare('SELECT id, promotion_id FROM promotion_usages WHERE order_id = ?')
          .bind(orderId)
          .all<{ id?: string; promotion_id?: string }>()
          .catch(() => null);
        if (fbAll?.results) return fbAll;
        const single = await db
          .prepare('SELECT id, promotion_id FROM promotion_usages WHERE order_id = ? LIMIT 1')
          .bind(orderId)
          .first<{ id?: string; promotion_id?: string }>()
          .catch(() => null);
        return { results: single ? [single] : [] };
      });
    const usageRows = usageRes?.results ?? [];
    if (usageRows.length > 0) {
      const delUsageRes = await db
        .prepare("DELETE FROM promotion_usages WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(orderId, effectiveTenant)
        .run()
        .catch(() =>
          effectiveTenant === 'default'
            ? db.prepare('DELETE FROM promotion_usages WHERE order_id = ?').bind(orderId).run().catch(() => null)
            : Promise.resolve(null),
        );
      const delUsageChanges =
        (delUsageRes as unknown as { meta?: { changes?: number }; changes?: number } | null)?.meta?.changes ??
        (delUsageRes as unknown as { changes?: number } | null)?.changes;
      if (delUsageRes && (delUsageChanges === undefined || Number(delUsageChanges) > 0)) {
        for (const usageRow of usageRows) {
          const promoId = usageRow.promotion_id ? String(usageRow.promotion_id).trim() : '';
          if (promoId && !decrementedPromoIds.has(promoId)) {
            decrementedPromoIds.add(promoId);
            await db
              .prepare(
                `UPDATE promotions
                 SET current_uses = MAX(0, COALESCE(current_uses, 0) - 1),
                     used_count = MAX(0, COALESCE(used_count, 0) - 1),
                     usage_count = MAX(0, COALESCE(usage_count, 0) - 1)
                 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
              )
              .bind(promoId, effectiveTenant)
              .run()
              .catch(async () => {
                try {
                  await db
                    .prepare("UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                    .bind(promoId, effectiveTenant)
                    .run();
                } catch {
                  if (effectiveTenant === 'default') {
                    await db
                      .prepare('UPDATE promotions SET usage_count = MAX(0, COALESCE(usage_count, 0) - 1) WHERE id = ?')
                      .bind(promoId)
                      .run()
                      .catch(() => {});
                  }
                }
              });
          }
        }
      }
    }
  } catch {
    // Optional promotion_usages table
  }

  // 10. Release table_sessions & cafe_tables
  if (!skipTableRelease) {
    try {
      const cancelSessionId = ordRow?.session_id ? String(ordRow.session_id).trim() : '';
      if (cancelSessionId) {
        const cancelTotalAmount = Number(ordRow?.total ?? ordRow?.total_amount ?? 0);
        await db
          .prepare(
            `UPDATE table_sessions
             SET order_count = CASE WHEN COALESCE(order_count, 0) > 0 THEN order_count - 1 ELSE 0 END,
                 total_amount = MAX(0, COALESCE(total_amount, 0) - ?),
                 current_order_id = CASE WHEN current_order_id = ? THEN NULL ELSE current_order_id END,
                 updated_at = ?
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(cancelTotalAmount, orderId, now, cancelSessionId, effectiveTenant)
          .run()
          .catch(() =>
            db
              .prepare(
                `UPDATE table_sessions
                 SET order_count = CASE WHEN COALESCE(order_count, 0) > 0 THEN order_count - 1 ELSE 0 END,
                     total_amount = MAX(0, COALESCE(total_amount, 0) - ?)
                 WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
              )
              .bind(cancelTotalAmount, cancelSessionId, effectiveTenant)
              .run()
              .catch(() => {}),
          );
      }
    } catch {
      // Optional table_sessions table
    }
    if (ordRow?.table_id) {
      await releaseTableIfNoActiveOrders(db, String(ordRow.table_id), effectiveTenant).catch(() => false);
    }
  }

  return { cashRefunded, onlineRefundRequired };
}
