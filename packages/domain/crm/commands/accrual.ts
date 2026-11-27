/**
 * CRM — Loyalty accrual.
 * applyAccrual: credits points + cashback wallet for a paid order,
 * recalculates tier, and writes audit logs. Idempotent — skips if an
 * earn transaction already exists for this order.
 *
 * Hono-free, D1-only. Designed to be called after order INSERT.
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import type { LoyaltyPolicy } from './loyalty-policy';
import { tierByName } from './loyalty-policy';
import { computeTier } from './compute-tier';

export const MIN_ORDER_TO_EARN = 20_000;

export interface AccrualInput {
  orderId: string;
  customerId: string;
  /** Total order amount in VND (matches orders.total). */
  orderTotalVnd: number;
  /** Cashback already used on this order (cashback_used column). */
  cashbackUsedVnd?: number;
  tenantId?: string;
  actorId?: string;
  actorRole?: string;
}

export interface AccrualSuccess {
  ok: true;
  cashback: number;
  points: number;
  walletBalance: number;
  totalPoints: number;
  lifetimePoints: number;
  tier: string;
  tierUpgraded: boolean;
  multiplierApplied: number;
  campaignCode: string | null;
  expiresAt: string | null;
}

export interface AccrualError {
  ok: false;
  reason:
    | 'order_not_found'
    | 'order_not_eligible'
    | 'below_min_order'
    | 'already_processed'
    | 'customer_not_found'
    | 'd1_error';
  error?: string;
}

const INELIGIBLE_ORDER_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'failed',
  'expired',
  'refunded',
]);

const ELIGIBLE_ORDER_PAYMENT_STATUSES = new Set([
  'paid',
  'completed',
  'partially_refunded',
]);

function isMissingColumnError(err: unknown): boolean {
  return /no such column/i.test(String((err as Error)?.message ?? err));
}

function isMissingTableError(err: unknown): boolean {
  return /no such table/i.test(String((err as Error)?.message ?? err));
}

export type AccrualResult = AccrualSuccess | AccrualError;

/**
 * Apply loyalty accrual for one order. Safe to call multiple times —
 * the idempotency guard ensures exactly one earn transaction per order.
 */
export async function applyAccrual(
  db: D1Database,
  policy: LoyaltyPolicy,
  input: AccrualInput,
): Promise<AccrualResult> {
  let last: AccrualResult = { ok: false, reason: 'd1_error', error: 'accrual snapshot changed' };
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await applyAccrualAttempt(db, policy, input);
    if (last.ok || last.reason !== 'd1_error' || !last.error?.includes('accrual snapshot changed')) {
      return last;
    }
  }
  return last;
}

async function applyAccrualAttempt(db: D1Database, policy: LoyaltyPolicy, input: AccrualInput): Promise<AccrualResult> {
  const { orderId, customerId, orderTotalVnd } = input;

  let order: {
    total?: number;
    total_amount?: number;
    cashback_used?: number;
    customer_id?: string | null;
    tenant_id?: string | null;
    status?: string | null;
    payment_status?: string | null;
  } | null = null;
  try {
    order = await db
      .prepare('SELECT total, cashback_used, customer_id, tenant_id, status, payment_status FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{
        total?: number;
        total_amount?: number;
        cashback_used?: number;
        customer_id?: string | null;
        tenant_id?: string | null;
        status?: string | null;
        payment_status?: string | null;
      }>();
  } catch {
    try {
      order = await db
        .prepare('SELECT total, cashback_used, customer_id, tenant_id FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ total?: number; total_amount?: number; cashback_used?: number; customer_id?: string | null; tenant_id?: string | null }>();
    } catch {
      try {
        order = await db
          .prepare('SELECT total, cashback_used FROM orders WHERE id = ?')
          .bind(orderId)
          .first<{ total?: number; total_amount?: number; cashback_used?: number }>();
      } catch {
        try {
          order = await db
            .prepare('SELECT * FROM orders WHERE id = ?')
            .bind(orderId)
            .first<{
              total?: number;
              total_amount?: number;
              cashback_used?: number;
              customer_id?: string | null;
              tenant_id?: string | null;
              status?: string | null;
              payment_status?: string | null;
            }>();
        } catch (e) {
          return { ok: false, reason: 'd1_error', error: `failed to read order: ${(e as Error).message}` };
        }
      }
    }
  }
  if (!order) {
    return { ok: false, reason: 'order_not_found' };
  }

  // Legacy reads may omit status columns because another optional column was absent.
  // Inspect the actual row before choosing the commit-time eligibility predicates.
  if (order.status === undefined || order.payment_status === undefined) {
    try {
      const complete = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<typeof order>();
      if (complete) Object.assign(order, complete);
    } catch (error) {
      return { ok: false, reason: 'd1_error', error: `failed to verify order: ${(error as Error).message}` };
    }
  }
  const normalizedOrderStatus = typeof order.status === 'string' ? order.status.trim().toLowerCase() : '';
  const hasPaymentStatusColumn = 'payment_status' in order && order.payment_status !== undefined;
  const normalizedPaymentStatus = typeof order.payment_status === 'string' ? order.payment_status.trim().toLowerCase() : '';
  if (
    (normalizedOrderStatus && INELIGIBLE_ORDER_STATUSES.has(normalizedOrderStatus)) ||
    (hasPaymentStatusColumn && !ELIGIBLE_ORDER_PAYMENT_STATUSES.has(normalizedPaymentStatus))
  ) {
    return { ok: false, reason: 'order_not_eligible' };
  }

  const total = Number(order.total ?? (order as { total_amount?: number }).total_amount ?? orderTotalVnd);
  const rawCashbackUsed = Number(input.cashbackUsedVnd ?? order?.cashback_used ?? 0);
  const cashbackUsed = Number.isFinite(rawCashbackUsed) && rawCashbackUsed > 0 ? rawCashbackUsed : 0;
  if (!Number.isFinite(total) || total < MIN_ORDER_TO_EARN) {
    return { ok: false, reason: 'below_min_order' };
  }

  const rawRequestedTenant = input.tenantId ? input.tenantId.trim() : '';
  const requestedTenant =
    rawRequestedTenant && rawRequestedTenant !== '*' && rawRequestedTenant.toLowerCase() !== 'hq'
      ? rawRequestedTenant
      : null;
  const orderRowTenant =
    'tenant_id' in order && order.tenant_id !== undefined
      ? (typeof order.tenant_id === 'string' && order.tenant_id.trim() && order.tenant_id.trim() !== '*' && order.tenant_id.trim().toLowerCase() !== 'hq'
          ? order.tenant_id.trim()
          : 'default')
      : null;
  if (requestedTenant && orderRowTenant && orderRowTenant !== requestedTenant) {
    return { ok: false, reason: 'order_not_found' };
  }
  const effectiveTenant = requestedTenant ?? orderRowTenant;
  const writeTenant = effectiveTenant || 'default';

  // ── Idempotency: skip if earn transaction already exists ──
  try {
    const existing = effectiveTenant
      ? await db
          .prepare(
            "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
          )
          .bind(orderId, effectiveTenant)
          .first<{ id: string }>()
          .catch((err) => {
            if (effectiveTenant === 'default' && isMissingColumnError(err)) {
              return db
                .prepare("SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1")
                .bind(orderId)
                .first<{ id: string }>();
            }
            throw err;
          })
      : await db
          .prepare(`SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1`)
          .bind(orderId)
          .first<{ id: string }>();
    if (existing) {
      return { ok: false, reason: 'already_processed' };
    }
    const existingLog = effectiveTenant
      ? await db
          .prepare(
            "SELECT id FROM loyalty_point_logs WHERE order_id = ? AND reason = 'purchase' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
          )
          .bind(orderId, effectiveTenant)
          .first<{ id: string }>()
          .catch((err) => {
            if (isMissingTableError(err)) return null;
            if (effectiveTenant === 'default' && isMissingColumnError(err)) {
              return db
                .prepare("SELECT id FROM loyalty_point_logs WHERE order_id = ? AND reason = 'purchase' LIMIT 1")
                .bind(orderId)
                .first<{ id: string }>();
            }
            throw err;
          })
      : await db
          .prepare(`SELECT id FROM loyalty_point_logs WHERE order_id = ? AND reason = 'purchase' LIMIT 1`)
          .bind(orderId)
          .first<{ id: string }>()
          .catch((err) => {
            if (isMissingTableError(err)) return null;
            throw err;
          });
    if (existingLog) {
      return { ok: false, reason: 'already_processed' };
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `idempotency check failed: ${(e as Error).message}` };
  }

  interface CustomerRow {
    id: string;
    loyalty_points: number;
    lifetime_points: number;
    loyalty_tier: string | null;
    tenant_id?: string | null;
  }

  let customer: CustomerRow | null = null;
  try {
    if (effectiveTenant) {
      try {
        customer = await db
          .prepare(
            `SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id
             FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
          )
          .bind(customerId, effectiveTenant)
          .first<CustomerRow>();
      } catch (err) {
        if (effectiveTenant === 'default' && isMissingColumnError(err)) {
          customer = await db
            .prepare(
              `SELECT id, loyalty_points, lifetime_points, loyalty_tier
               FROM customers WHERE id = ?`,
            )
            .bind(customerId)
            .first<CustomerRow>();
        } else {
          throw err;
        }
      }
    } else {
      customer = await db
        .prepare(
          `SELECT id, loyalty_points, lifetime_points, loyalty_tier
           FROM customers WHERE id = ?`,
        )
        .bind(customerId)
        .first<CustomerRow>();
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read customer: ${(e as Error).message}` };
  }
  if (!customer) {
    return { ok: false, reason: 'customer_not_found' };
  }
  if (effectiveTenant && 'tenant_id' in customer && customer.tenant_id !== undefined) {
    const custTenant = String(customer.tenant_id ?? '').trim() || 'default';
    if (custTenant !== effectiveTenant) {
      return { ok: false, reason: 'customer_not_found' };
    }
  }
  if (
    typeof order.customer_id === 'string' &&
    order.customer_id.trim() !== '' &&
    order.customer_id !== 'guest' &&
    order.customer_id !== customer.id
  ) {
    return { ok: false, reason: 'order_not_found' };
  }
  if (effectiveTenant && 'tenant_id' in order && order.tenant_id !== undefined) {
    const ordTenant = String(order.tenant_id ?? '').trim() || 'default';
    if (ordTenant !== effectiveTenant) {
      return { ok: false, reason: 'order_not_found' };
    }
  }

  // Legacy tables may genuinely lack tenant_id; defaults in current schemas must
  // never decide accounting ownership, even temporarily before a later patch.
  const accountingTenantColumns = new Set<string>();
  let hasAccountMirror = false;
  let hasTextAuditId = false;
  let hasCustomerTotalSpent = false;
  let hasCustomerTotalOrders = false;
  let hasCustomerTierCol = false;
  try {
    for (const table of ['cashback_transactions', 'loyalty_point_logs', 'loyalty_audit_log', 'loyalty_accounts', 'customers']) {
      const schema = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string; type: string }>();
      if (!schema.success || !Array.isArray(schema.results)) throw new Error(`unreadable ${table} schema`);
      const hasTenantColumn = schema.results.some(column => column.name === 'tenant_id');
      if (hasTenantColumn) accountingTenantColumns.add(table);
      if (table === 'loyalty_accounts') hasAccountMirror = schema.results.length > 0;
      if (table === 'loyalty_audit_log') {
        hasTextAuditId = schema.results.some(column => column.name === 'id' && /^TEXT$/i.test(column.type));
      }
      if (table === 'customers') {
        hasCustomerTotalSpent = schema.results.some(column => column.name === 'total_spent');
        hasCustomerTotalOrders = schema.results.some(column => column.name === 'total_orders');
        hasCustomerTierCol = schema.results.some(column => column.name === 'tier');
      }
      if (table !== 'customers' && writeTenant !== 'default' && schema.results.length > 0 && !hasTenantColumn) {
        throw new Error(`tenant scope unavailable for ${table}`);
      }
    }
  } catch (error) {
    return { ok: false, reason: 'd1_error', error: `failed to verify accounting schema: ${(error as Error).message}` };
  }
  const accountingInsert = (table: string, columns: string, values: string, args: unknown[]) => {
    const tenantColumn = accountingTenantColumns.has(table);
    return db.prepare(`INSERT INTO ${table} (${columns}${tenantColumn ? ', tenant_id' : ''})
      VALUES (${values}${tenantColumn ? ', ?' : ''})`).bind(...args, ...(tenantColumn ? [writeTenant] : []));
  };

  const tier = tierByName(policy, customer.loyalty_tier);
  const multiplier = policy.campaignMultiplier;
  const maxCap = policy.maxCapPerTx;

  const baseRate = tier.cashbackRate;
  const netEligibleTotal = Math.max(0, total - cashbackUsed);
  const rawCashback = Math.max(0, Math.round(netEligibleTotal * baseRate * multiplier));
  const grossCashback = Math.min(rawCashback, maxCap);

  const grossPoints = Math.floor((total / 10_000) * (tier.pointMultiplier || 1));

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const completedAtIso = new Date().toISOString();
  const expiresAt = policy.expiresAt;

  // Coordinate late accrual atomically with prior partial refund work so a paid
  // order receives exact net remaining benefits with no spendable overcredit
  // window, while full refunds still mint zero benefits.
  type RefundWorkRow = {
    reversal_key: string;
    amount: number;
    status: string;
    points_reversed: number | null;
    cashback_reversed: number | null;
  };
  type TrancheAttribution = {
    reversalKey: string;
    amount: number;
    status: string;
    pointsReversed: number;
    cashbackReversed: number;
  };
  let hasRefundWorkTable = false;
  let priorRefundRows: RefundWorkRow[] = [];
  let priorRefundAmount = 0;
  let reversedPoints = 0;
  let reversedCashback = 0;
  const trancheAttributions: TrancheAttribution[] = [];
  try {
    const refundWorkTable = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'refund_loyalty_work'")
      .first<{ name: string }>();
    hasRefundWorkTable = Boolean(refundWorkTable);
    if (hasRefundWorkTable) {
      const workRes = await db
        .prepare(
          `SELECT reversal_key, amount, status, points_reversed, cashback_reversed
           FROM refund_loyalty_work
           WHERE tenant_id = ? AND order_id = ?
           ORDER BY datetime(COALESCE(completed_at, created_at)) ASC,
                    RTRIM(REPLACE(COALESCE(completed_at, created_at), 'T', ' '), 'Z') ASC,
                    reversal_key ASC`,
        )
        .bind(writeTenant, orderId)
        .all<RefundWorkRow>();
      if (!workRes.success || !Array.isArray(workRes.results)) {
        throw new Error('unreadable refund_loyalty_work');
      }
      priorRefundRows = workRes.results;
    }
  } catch (error) {
    return { ok: false, reason: 'd1_error', error: `failed to verify refund fence: ${(error as Error).message}` };
  }

  for (const row of priorRefundRows) {
    const existingPts = Number(row.points_reversed ?? 0);
    const existingCb = Number(row.cashback_reversed ?? 0);
    if (existingPts !== 0 || existingCb !== 0) {
      return { ok: false, reason: 'order_not_eligible' };
    }
    const trancheAmount = Math.max(0, Number(row.amount ?? 0));
    priorRefundAmount += trancheAmount;
    const cumulativeRatio = total > 0 ? Math.min(1, priorRefundAmount / total) : 1;
    const targetPoints = Math.round(grossPoints * cumulativeRatio);
    const targetCashback = Math.round(grossCashback * cumulativeRatio);
    const tranchePoints = Math.max(0, Math.min(grossPoints - reversedPoints, targetPoints - reversedPoints));
    const trancheCashback = Math.max(0, Math.min(grossCashback - reversedCashback, targetCashback - reversedCashback));
    reversedPoints += tranchePoints;
    reversedCashback += trancheCashback;
    trancheAttributions.push({
      reversalKey: row.reversal_key,
      amount: trancheAmount,
      status: row.status,
      pointsReversed: tranchePoints,
      cashbackReversed: trancheCashback,
    });
  }
  if (hasRefundWorkTable && priorRefundAmount >= total) {
    return { ok: false, reason: 'order_not_eligible' };
  }
  const points = Math.max(0, grossPoints - reversedPoints);
  const cashback = Math.max(0, grossCashback - reversedCashback);

  // ── Ensure wallet exists ──
  let wallet: { id: string; balance: number } | null = null;
  let walletHasTenant = false;
  try {
    if (effectiveTenant) {
      try {
        wallet = await db
          .prepare("SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(customer.id, effectiveTenant)
          .first<{ id: string; balance: number }>();
        walletHasTenant = true;
      } catch (err) {
        if (effectiveTenant === 'default' && isMissingColumnError(err)) {
          wallet = await db
            .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
            .bind(customer.id)
            .first<{ id: string; balance: number }>();
          walletHasTenant = false;
        } else {
          throw err;
        }
      }
    } else {
      wallet = await db
        .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
        .bind(customer.id)
        .first<{ id: string; balance: number }>();
    }
  } catch (e) {
    return { ok: false, reason: 'd1_error', error: `failed to read wallet: ${(e as Error).message}` };
  }

  let walletId: string;
  let newBalance: number;
  if (!wallet) {
    walletId = genId('wal_');
    newBalance = cashback;
    try {
      if (effectiveTenant && walletHasTenant) {
        try {
          await db
            .prepare(
              `INSERT INTO cashback_wallets
               (id, customer_id, balance, total_earned, total_spent, created_at, updated_at, tenant_id)
               VALUES (?, ?, 0, 0, 0, ?, ?, ?)`,
            )
            .bind(walletId, customer.id, now, now, effectiveTenant)
            .run();
        } catch (innerErr) {
          if (effectiveTenant === 'default' && isMissingColumnError(innerErr)) {
            walletHasTenant = false;
            await db
              .prepare(
                `INSERT INTO cashback_wallets
                 (id, customer_id, balance, total_earned, total_spent, created_at, updated_at)
                 VALUES (?, ?, 0, 0, 0, ?, ?)`,
              )
              .bind(walletId, customer.id, now, now)
              .run();
          } else {
            throw innerErr;
          }
        }
      } else {
        await db
          .prepare(
            `INSERT INTO cashback_wallets
             (id, customer_id, balance, total_earned, total_spent, created_at, updated_at)
             VALUES (?, ?, 0, 0, 0, ?, ?)`,
          )
          .bind(walletId, customer.id, now, now)
          .run();
      }
    } catch (e) {
      return { ok: false, reason: 'd1_error', error: `failed to create wallet: ${(e as Error).message}` };
    }
  } else {
    walletId = wallet.id;
    newBalance = (wallet.balance ?? 0) + cashback;
  }

  const newPoints = (customer.loyalty_points ?? 0) + points;
  const newLifetimePoints = (customer.lifetime_points ?? 0) + points;
  const computed = computeTier(newLifetimePoints, customer.loyalty_tier, policy);
  const tierUpgraded = computed.changed && computed.tierName !== customer.loyalty_tier;
  const finalTier = tierUpgraded ? computed.tierName : (customer.loyalty_tier ?? tier.tierName);
  const customerTenant = customer.tenant_id !== undefined;
  const customerScope = customerTenant ? " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?" : '';
  const customerArgs = [customer.id, ...(customerTenant ? [writeTenant] : [])];
  const requireWrite = () => db.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('{}', 'accrual required write missing') END AS accrual_write");
  // Distinguish a retryable snapshot change from a failed required ledger write.
  const requireSnapshotWrite = () => db.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('{}', 'accrual snapshot changed') END AS accrual_snapshot");
  // Deterministic ledger IDs keyed by orderId prevent concurrent order_paid + order_completed double-accrual.
  const earnTxId = `cbt_earn_${orderId}`;
  const earnPtLogId = `ptl_earn_${orderId}`;

  // ── Batch: wallet + transaction + customer + point log + audit + order ──
  const walletUpdateStmt = effectiveTenant && walletHasTenant
    ? db
        .prepare(
          `UPDATE cashback_wallets
           SET balance = COALESCE(balance, 0) + ?, total_earned = COALESCE(total_earned, 0) + ?, updated_at = ?
           WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND id = ? AND COALESCE(balance, 0) = ?`,
        )
        .bind(cashback, cashback, now, customer.id, effectiveTenant, walletId, wallet?.balance ?? 0)
    : db
        .prepare(
          `UPDATE cashback_wallets
           SET balance = COALESCE(balance, 0) + ?, total_earned = COALESCE(total_earned, 0) + ?, updated_at = ?
           WHERE customer_id = ? AND id = ? AND COALESCE(balance, 0) = ?`,
        )
        .bind(cashback, cashback, now, customer.id, walletId, wallet?.balance ?? 0);

  // The tier and ledger balances are calculated from the same customer snapshot.
  // Do not overwrite a tier or publish a stale balance after another mutation.
  const extraCustomerSet: string[] = [];
  const extraCustomerBind: unknown[] = [];
  if (tierUpgraded) {
    extraCustomerSet.push('loyalty_tier = ?');
    extraCustomerBind.push(finalTier);
    if (hasCustomerTierCol) {
      extraCustomerSet.push('tier = ?');
      extraCustomerBind.push(finalTier);
    }
  }
  if (hasCustomerTotalSpent) {
    extraCustomerSet.push('total_spent = COALESCE(total_spent, 0) + ?');
    extraCustomerBind.push(total);
  }
  if (hasCustomerTotalOrders) {
    extraCustomerSet.push('total_orders = COALESCE(total_orders, 0) + 1');
  }
  const extraSetSql = extraCustomerSet.length > 0 ? `, ${extraCustomerSet.join(', ')}` : '';
  const customerUpdateStmt = db.prepare(`UPDATE customers
    SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?,
      updated_at = ?${extraSetSql}
    WHERE id = ?${customerScope}
      AND COALESCE(loyalty_points, 0) = ? AND COALESCE(lifetime_points, 0) = ? AND loyalty_tier IS ?`)
    .bind(points, points, now, ...extraCustomerBind, ...customerArgs,
      customer.loyalty_points ?? 0, customer.lifetime_points ?? 0, customer.loyalty_tier ?? null);

  const orderUpdateStmt = effectiveTenant && order.tenant_id !== undefined
    ? db
        .prepare(
          `UPDATE orders
           SET cashback_earned = ?, points_earned = ?
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(cashback, points, orderId, effectiveTenant)
    : db
        .prepare('UPDATE orders SET cashback_earned = ?, points_earned = ? WHERE id = ?')
        .bind(cashback, points, orderId);

  const auditInsert = (action: 'cashback_earn' | 'tier_upgrade', amount: number, metadata: unknown) => accountingInsert(
    'loyalty_audit_log',
    `${hasTextAuditId ? 'id, ' : ''}customer_id, action, amount_vnd, order_id, metadata, created_at`,
    `${hasTextAuditId ? '?, ' : ''}?, ?, ?, ?, ?, ?`,
    [...(hasTextAuditId ? [`audit_${action}_${orderId}`] : []), customer.id, action, amount, orderId, JSON.stringify(metadata), now],
  );
  const stmts = [
    walletUpdateStmt,
    requireSnapshotWrite(),
    accountingInsert('cashback_transactions',
      'id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, multiplier_applied, campaign_id, description, created_at',
      "?, ?, ?, ?, 'earn', ?, ?, ?, ?, ?, ?, ?", [
        earnTxId, walletId, customer.id, orderId, cashback, newBalance, expiresAt, multiplier,
        policy.campaignCode ?? null,
        `Cashback don #${orderId.slice(0, 8)}${multiplier > 1 ? ` (x${multiplier})` : ''}`, now,
      ]),
    requireWrite(),
    customerUpdateStmt,
    requireSnapshotWrite(),
    accountingInsert('loyalty_point_logs',
      'id, customer_id, order_id, points_change, reason, balance_after, description, created_at',
      "?, ?, ?, ?, 'purchase', ?, ?, ?", [
        earnPtLogId, customer.id, orderId, points, newPoints, `Tich diem don #${orderId.slice(0, 8)}`, now,
      ]),
    requireWrite(),
    auditInsert('cashback_earn', cashback, {
      tier: tier.tierName, base_rate: tier.cashbackRate, multiplier, campaign: policy.campaignCode ?? null,
      raw_cashback: rawCashback, capped: grossCashback < rawCashback, cap_used: maxCap,
      ...(trancheAttributions.length > 0 ? {
        gross_cashback: grossCashback,
        gross_points: grossPoints,
        refunded_amount_at_accrual: priorRefundAmount,
        reversed_cashback_at_accrual: reversedCashback,
        reversed_points_at_accrual: reversedPoints,
        refund_reversal_keys: trancheAttributions.map(tranche => tranche.reversalKey),
      } : {}),
      actor_id: input.actorId ?? null, actor_role: input.actorRole ?? null,
    }),
    requireWrite(),
    orderUpdateStmt,
    requireWrite(),
  ];
  if (tierUpgraded) {
    stmts.push(accountingInsert('loyalty_point_logs',
      'id, customer_id, points_change, reason, balance_after, description, created_at',
      "?, ?, 0, 'tier_upgrade', ?, ?, ?", [
        `ptl_tier_${orderId}`, customer.id, newPoints, `Nang hang len ${finalTier}`, now,
      ]), requireWrite(), auditInsert('tier_upgrade', 0, {
        from: customer.loyalty_tier, to: finalTier, reason: 'points_threshold', lifetime_points: newLifetimePoints,
      }), requireWrite());
  }
  if (hasAccountMirror) {
    const accountScope = accountingTenantColumns.has('loyalty_accounts');
    const where = `customer_id = ?${accountScope ? " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?" : ''}`;
    const args = [customer.id, ...(accountScope ? [writeTenant] : [])];
    // The table and a customer mirror row are optional. If a row exists it must update.
    stmts.push(db.prepare(`UPDATE loyalty_accounts
      SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, tier = ?, updated_at = ?
      WHERE ${where}`).bind(points, points, finalTier, now, ...args),
    db.prepare(`SELECT CASE WHEN changes() = (SELECT COUNT(*) FROM loyalty_accounts WHERE ${where}) THEN 1
      ELSE json_extract('{}', 'accrual required write missing') END AS accrual_account`).bind(...args));
  }

  const eligibility = ['id = ?'];
  const eligibilityArgs: unknown[] = [orderId];
  if (order.tenant_id !== undefined) {
    eligibility.push("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
    eligibilityArgs.push(writeTenant);
  }
  if (order.status !== undefined) {
    eligibility.push("LOWER(TRIM(COALESCE(status, ''))) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')");
  }
  if (order.payment_status !== undefined) {
    eligibility.push("LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'completed', 'partially_refunded')");
  }
  // A refund can commit after the eligibility read. Recheck order eligibility and
  // the exact refund_loyalty_work snapshot inside the same transaction as every
  // credit, tranche attribution, order metadata update, and mirror write.
  const eligibilityAssertion = db.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM orders WHERE ${eligibility.join(' AND ')}
  ) THEN 1 ELSE abs(-9223372036854775808) END AS accrual_eligibility`).bind(...eligibilityArgs);
  const refundWorkStatements: D1PreparedStatement[] = [];
  if (hasRefundWorkTable) {
    refundWorkStatements.push(
      db
        .prepare(
          `SELECT CASE WHEN
             (SELECT COUNT(*) FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ?) = ?
             AND (SELECT COALESCE(SUM(amount), 0) FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ?) = ?
             AND (SELECT COALESCE(SUM(COALESCE(points_reversed, 0)), 0) FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ?) = 0
             AND (SELECT COALESCE(SUM(COALESCE(cashback_reversed, 0)), 0) FROM refund_loyalty_work WHERE tenant_id = ? AND order_id = ?) = 0
           THEN 1 ELSE json_extract('{}', 'accrual snapshot changed') END AS accrual_refund_snapshot`,
        )
        .bind(
          writeTenant, orderId, priorRefundRows.length,
          writeTenant, orderId, priorRefundAmount,
          writeTenant, orderId,
          writeTenant, orderId,
        ),
    );
    for (const tranche of trancheAttributions) {
      refundWorkStatements.push(
        db
          .prepare(
            `UPDATE refund_loyalty_work
             SET status = 'completed',
                 customer_id = COALESCE(customer_id, ?),
                 points_reversed = ?,
                 cashback_reversed = ?,
                 completed_at = COALESCE(completed_at, ?)
             WHERE tenant_id = ? AND reversal_key = ? AND order_id = ?
               AND status IN ('pending', 'completed', 'failed') AND amount = ?
               AND COALESCE(points_reversed, 0) = 0 AND COALESCE(cashback_reversed, 0) = 0`,
          )
          .bind(
            customer.id,
            tranche.pointsReversed,
            tranche.cashbackReversed,
            completedAtIso,
            writeTenant,
            tranche.reversalKey,
            orderId,
            tranche.amount,
          ),
        requireSnapshotWrite(),
      );
    }
  }
  try {
    await db.batch([eligibilityAssertion, ...refundWorkStatements, ...stmts]);
  } catch (err) {
    const msg = (err as Error).message || '';
    if (/integer overflow/i.test(msg)) return { ok: false, reason: 'order_not_eligible' };
    if (/UNIQUE constraint failed: (cashback_transactions|loyalty_point_logs)\.id\b/i.test(msg)) {
      return { ok: false, reason: 'already_processed' };
    }
    return { ok: false, reason: 'd1_error', error: msg };
  }

  return {
    ok: true,
    cashback,
    points,
    walletBalance: newBalance,
    totalPoints: newPoints,
    lifetimePoints: newLifetimePoints,
    tier: finalTier,
    tierUpgraded,
    multiplierApplied: multiplier,
    campaignCode: policy.campaignCode,
    expiresAt,
  };
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
