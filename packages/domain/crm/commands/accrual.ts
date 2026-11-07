/**
 * CRM — Loyalty accrual.
 * applyAccrual: credits points + cashback wallet for a paid order,
 * recalculates tier, and writes audit logs. Idempotent — skips if an
 * earn transaction already exists for this order.
 *
 * Hono-free, D1-only. Designed to be called after order INSERT.
 */

import type { D1Database } from '@cloudflare/workers-types';
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
  'rejected',
  'failed',
  'expired',
  'refunded',
]);

const UNPAID_ORDER_PAYMENT_STATUSES = new Set([
  'pending',
  'unpaid',
  'failed',
  'cancelled',
  'canceled',
  'expired',
  'refunded',
]);

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

  const normalizedOrderStatus = typeof order.status === 'string' ? order.status.trim().toLowerCase() : '';
  const normalizedPaymentStatus = typeof order.payment_status === 'string' ? order.payment_status.trim().toLowerCase() : '';
  if (
    (normalizedOrderStatus && INELIGIBLE_ORDER_STATUSES.has(normalizedOrderStatus)) ||
    (normalizedPaymentStatus && UNPAID_ORDER_PAYMENT_STATUSES.has(normalizedPaymentStatus))
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
            if (effectiveTenant === 'default') {
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
          .catch(() =>
            effectiveTenant === 'default'
              ? db
                  .prepare("SELECT id FROM loyalty_point_logs WHERE order_id = ? AND reason = 'purchase' LIMIT 1")
                  .bind(orderId)
                  .first<{ id: string }>()
                  .catch(() => null)
              : null,
          )
      : await db
          .prepare(`SELECT id FROM loyalty_point_logs WHERE order_id = ? AND reason = 'purchase' LIMIT 1`)
          .bind(orderId)
          .first<{ id: string }>()
          .catch(() => null);
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
      } catch {
        if (effectiveTenant === 'default') {
          customer = await db
            .prepare(
              `SELECT id, loyalty_points, lifetime_points, loyalty_tier
               FROM customers WHERE id = ?`,
            )
            .bind(customerId)
            .first<CustomerRow>();
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

  const tier = tierByName(policy, customer.loyalty_tier);
  const multiplier = policy.campaignMultiplier;
  const maxCap = policy.maxCapPerTx;

  const baseRate = tier.cashbackRate;
  const netEligibleTotal = Math.max(0, total - cashbackUsed);
  const rawCashback = Math.max(0, Math.round(netEligibleTotal * baseRate * multiplier));
  const cashback = Math.min(rawCashback, maxCap);

  const points = Math.floor((total / 10_000) * (tier.pointMultiplier || 1));

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const expiresAt = policy.expiresAt;

  // ── Ensure wallet exists ──
  let wallet: { id: string; balance: number } | null = null;
  try {
    if (effectiveTenant) {
      try {
        wallet = await db
          .prepare("SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(customer.id, effectiveTenant)
          .first<{ id: string; balance: number }>();
      } catch {
        if (effectiveTenant === 'default') {
          wallet = await db
            .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
            .bind(customer.id)
            .first<{ id: string; balance: number }>();
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
      if (effectiveTenant) {
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
          if (effectiveTenant === 'default') {
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
  // Deterministic ledger IDs keyed by orderId prevent concurrent order_paid + order_completed double-accrual.
  const earnTxId = `cbt_earn_${orderId}`;
  const earnPtLogId = `ptl_earn_${orderId}`;

  // ── Batch: wallet + transaction + customer + point log + audit + order ──
  const walletUpdateStmt = effectiveTenant
    ? db
        .prepare(
          `UPDATE cashback_wallets
           SET balance = COALESCE(balance, 0) + ?, total_earned = COALESCE(total_earned, 0) + ?, updated_at = ?
           WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(cashback, cashback, now, customer.id, effectiveTenant)
    : db
        .prepare(
          `UPDATE cashback_wallets
           SET balance = COALESCE(balance, 0) + ?, total_earned = COALESCE(total_earned, 0) + ?, updated_at = ?
           WHERE customer_id = ?`,
        )
        .bind(cashback, cashback, now, customer.id);

  const customerUpdateStmt = effectiveTenant
    ? db
        .prepare(
          `UPDATE customers
           SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`,
        )
        .bind(points, points, now, customer.id, effectiveTenant)
    : db
        .prepare(
          `UPDATE customers
           SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(points, points, now, customer.id);

  const orderUpdateStmt = effectiveTenant
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

  const stmts = [
    walletUpdateStmt,
    db
      .prepare(
        `INSERT INTO cashback_transactions
         (id, wallet_id, customer_id, order_id, type, amount, balance_after,
          expires_at, multiplier_applied, campaign_id, description, created_at)
         VALUES (?, ?, ?, ?, 'earn', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        earnTxId,
        walletId,
        customer.id,
        orderId,
        cashback,
        newBalance,
        expiresAt,
        multiplier,
        policy.campaignCode ?? null,
        `Cashback don #${orderId.slice(0, 8)}${multiplier > 1 ? ` (x${multiplier})` : ''}`,
        now,
      ),
    customerUpdateStmt,
    db
      .prepare(
        `INSERT INTO loyalty_point_logs
         (id, customer_id, order_id, points_change, reason, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, 'purchase', ?, ?, ?)`,
      )
      .bind(
        earnPtLogId,
        customer.id,
        orderId,
        points,
        newPoints,
        `Tich diem don #${orderId.slice(0, 8)}`,
        now,
      ),
    db
      .prepare(
        `INSERT INTO loyalty_audit_log
         (customer_id, action, amount_vnd, order_id, metadata, created_at)
         VALUES (?, 'cashback_earn', ?, ?, ?, ?)`,
      )
      .bind(
        customer.id,
        cashback,
        orderId,
        JSON.stringify({
          tier: tier.tierName,
          base_rate: tier.cashbackRate,
          multiplier,
          campaign: policy.campaignCode ?? null,
          raw_cashback: rawCashback,
          capped: cashback < rawCashback,
          cap_used: maxCap,
          actor_id: input.actorId ?? null,
          actor_role: input.actorRole ?? null,
        }),
        now,
      ),
    orderUpdateStmt,
  ];

  try {
    await db.batch(stmts);
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return { ok: false, reason: 'already_processed' };
    }
    try {
      await db.batch(stmts.slice(0, 5));
    } catch (coreErr) {
      const coreMsg = (coreErr as Error).message || '';
      if (coreMsg.includes('UNIQUE') || coreMsg.includes('constraint')) {
        return { ok: false, reason: 'already_processed' };
      }
      return { ok: false, reason: 'd1_error', error: coreMsg || msg };
    }
  }

  // ── Tier upgrade check ──
  const computed = computeTier(newLifetimePoints, customer.loyalty_tier, policy);
  let tierUpgraded = false;
  if (computed.changed && computed.tierName !== customer.loyalty_tier) {
    tierUpgraded = true;
    try {
      const upgradePtLogId = genId('ptl_');
      if (effectiveTenant) {
        await db
          .prepare("UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(computed.tierName, now, customer.id, effectiveTenant)
          .run()
          .catch((err) => {
            if (effectiveTenant === 'default') {
              return db
                .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
                .bind(computed.tierName, now, customer.id)
                .run();
            }
            throw err;
          });
      } else {
        await db
          .prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?')
          .bind(computed.tierName, now, customer.id)
          .run();
      }
      await db.batch([
        db
          .prepare(
            `INSERT INTO loyalty_point_logs
             (id, customer_id, points_change, reason, balance_after, description, created_at)
             VALUES (?, ?, 0, 'tier_upgrade', ?, ?, ?)`,
          )
          .bind(
            upgradePtLogId,
            customer.id,
            newPoints,
            `Nang hang len ${computed.tierName}`,
            now,
          ),
        db
          .prepare(
            `INSERT INTO loyalty_audit_log
             (customer_id, action, amount_vnd, order_id, metadata, created_at)
             VALUES (?, 'tier_upgrade', null, ?, ?, ?)`,
          )
          .bind(
            customer.id,
            orderId,
            JSON.stringify({
              from: customer.loyalty_tier,
              to: computed.tierName,
              reason: 'points_threshold',
              lifetime_points: newLifetimePoints,
            }),
            now,
          ),
      ]);
      await db
        .prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ?')
        .bind(writeTenant, upgradePtLogId)
        .run()
        .catch(() => {});
      await db
        .prepare("UPDATE loyalty_audit_log SET tenant_id = ? WHERE order_id = ? AND customer_id = ? AND action = 'tier_upgrade' AND created_at = ?")
        .bind(writeTenant, orderId, customer.id, now)
        .run()
        .catch(() => {});
    } catch (_e) {
      // Tier upgrade is non-blocking — accrual already committed.
      tierUpgraded = false;
    }
  }

  const finalTier = tierUpgraded ? computed.tierName : (customer.loyalty_tier ?? tier.tierName);
  try {
    if (effectiveTenant) {
      await db
        .prepare(
          "UPDATE loyalty_accounts SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, tier = ?, updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
        )
        .bind(points, points, finalTier, now, customer.id, effectiveTenant)
        .run()
        .catch((err) => {
          if (effectiveTenant === 'default') {
            return db
              .prepare(
                'UPDATE loyalty_accounts SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, tier = ?, updated_at = ? WHERE customer_id = ?',
              )
              .bind(points, points, finalTier, now, customer.id)
              .run();
          }
          throw err;
        });
    } else {
      await db
        .prepare(
          'UPDATE loyalty_accounts SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, tier = ?, updated_at = ? WHERE customer_id = ?',
        )
        .bind(points, points, finalTier, now, customer.id)
        .run();
    }
  } catch {
    // loyalty_accounts is optional in minimal schemas
  }

  try {
    await db.batch([
      db.prepare('UPDATE cashback_transactions SET tenant_id = ? WHERE id = ? AND tenant_id IS NULL').bind(writeTenant, earnTxId),
      db.prepare('UPDATE loyalty_point_logs SET tenant_id = ? WHERE id = ? AND tenant_id IS NULL').bind(writeTenant, earnPtLogId),
      db.prepare("UPDATE loyalty_audit_log SET tenant_id = ? WHERE order_id = ? AND customer_id = ? AND action = 'cashback_earn' AND tenant_id IS NULL").bind(writeTenant, orderId, customer.id),
    ]);
  } catch {
    // Optional tenant_id column in minimal schemas
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
