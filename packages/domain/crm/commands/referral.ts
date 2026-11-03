/**
 * CRM — Referral operations (domain logic).
 *
 * Migrates from worker/src/tree/referrals/:
 *   apply-referral.ts  → redeemReferral (pending record at signup)
 *   process-referral.ts → rewardReferralOnFirstOrder (points mode)
 *   referral-cashback.ts → rewardReferralOnFirstOrder (cashback mode)
 *   reverse-cashback.ts → reverseReferralCashback
 *
 * Idempotency: one reward per (referrer, referee) via referral.status check.
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  DEFAULT_REFERRAL_POLICY,
  type ReferralPolicy,
  type ReferralBonusType,
} from './referral-policy';

// ─── types ──────────────────────────────────────────────────────────────

export interface ReferralCodeRow {
  id: string;
  customer_id: string;
  code: string;
  times_used: number;
  total_points_earned: number;
  total_cashback_earned_vnd: number;
}

export interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_customer_id: string;
  referral_code: string;
  points_awarded: number;
  cashback_awarded_vnd: number;
  first_order_id: string | null;
  first_order_amount: number | null;
  status: 'pending' | 'completed' | 'reversed';
  bonus_type: ReferralBonusType | null;
  reward_paid_at: string | null;
  created_at: string;
}

export interface ReferralStatus {
  code: string | null;
  total_referrals: number;
  pending_count: number;
  total_points_earned: number;
  total_cashback_earned_vnd: number;
  code_usage: number;
}

export interface ReferralResult {
  success: boolean;
  reason?: string;
  referrer_id?: string;
  referee_id?: string;
  reward_points?: number;
  reward_vnd?: number;
  new_balance?: number;
  new_lifetime_balance?: number;
  referral_id?: string;
}

// ─── helpers ────────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateCode(length = 6): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

function genId(prefix: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + hex.slice(0, 4);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── create/get referral code ───────────────────────────────────────────

/**
 * Get or create a referral code for a customer.
 */
export async function getOrCreateReferralCode(
  db: D1Database,
  customerId: string,
  tenantId?: string,
): Promise<{ code: string; isNew: boolean }> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  let existing = await db
    .prepare('SELECT * FROM referral_codes WHERE customer_id = ?')
    .bind(customerId)
    .first<ReferralCodeRow & { tenant_id?: string | null }>();
  if (existing && effectiveTenant && 'tenant_id' in existing && existing.tenant_id !== undefined) {
    const rowTenant = String(existing.tenant_id ?? '').trim() || 'default';
    if (rowTenant !== effectiveTenant) {
      existing = await db
        .prepare("SELECT * FROM referral_codes WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, effectiveTenant)
        .first<ReferralCodeRow & { tenant_id?: string | null }>()
        .catch(() => null);
    }
  }
  if (existing) {
    return { code: existing.code, isNew: false };
  }

  const code = generateCode(6);
  const id = genId('rc_');
  await db
    .prepare(
      `INSERT INTO referral_codes (id, customer_id, code, times_used, total_points_earned, total_cashback_earned_vnd, created_at)
       VALUES (?, ?, ?, 0, 0, 0, ?)`,
    )
    .bind(id, customerId, code, nowIso())
    .run();
  if (effectiveTenant) {
    await db
      .prepare('UPDATE referral_codes SET tenant_id = ? WHERE id = ?')
      .bind(effectiveTenant, id)
      .run()
      .catch(() => {});
  }

  return { code, isNew: true };
}

/**
 * Look up a referral code value by customer.
 */
export async function getReferralCode(
  db: D1Database,
  customerId: string,
  tenantId?: string,
): Promise<string | null> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  if (effectiveTenant) {
    try {
      const scoped = await db
        .prepare("SELECT code, tenant_id FROM referral_codes WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, effectiveTenant)
        .first<{ code: string; tenant_id?: string | null }>();
      if (scoped && 'tenant_id' in scoped && scoped.tenant_id !== undefined) {
        const rowTenant = String(scoped.tenant_id ?? '').trim() || 'default';
        if (rowTenant !== effectiveTenant) return null;
      }
      return scoped?.code ?? null;
    } catch {
      // Fallback when tenant_id column is absent
    }
  }
  const rc = await db
    .prepare('SELECT code FROM referral_codes WHERE customer_id = ?')
    .bind(customerId)
    .first<{ code: string }>();
  return rc?.code ?? null;
}

// ─── redeem referral ────────────────────────────────────────────────────

/**
 * Redeem a referral code: creates a pending referral record linking
 * referee → referrer. Idempotency: if judge has pending referral, return existing.
 */
export async function redeemReferral(
  db: D1Database,
  referralCode: string,
  refereeId: string,
  tenantId?: string,
): Promise<ReferralResult> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  const normalized = referralCode.trim().toUpperCase();

  const rc = await db
    .prepare('SELECT * FROM referral_codes WHERE code = ?')
    .bind(normalized)
    .first<ReferralCodeRow & { tenant_id?: string | null; max_uses?: number | null }>();
  if (!rc) return { success: false, reason: 'invalid_code' };

  if (rc.customer_id === refereeId) {
    return { success: false, reason: 'self_referral' };
  }
  if (effectiveTenant && 'tenant_id' in rc && rc.tenant_id !== undefined) {
    const rcTenant = String(rc.tenant_id ?? '').trim() || 'default';
    if (rcTenant !== effectiveTenant) {
      return { success: false, reason: 'invalid_code' };
    }
  }
  if (typeof rc.max_uses === 'number' && rc.max_uses > 0 && Number(rc.times_used ?? 0) >= rc.max_uses) {
    return { success: false, reason: 'code_exhausted' };
  }

  // Check for existing referral (pending, completed, or reversed)
  const existing = await db
    .prepare('SELECT id, status, bonus_type FROM referrals WHERE referred_customer_id = ?')
    .bind(refereeId)
    .first<{ id: string; status: string; bonus_type: ReferralBonusType | null }>();
  if (existing) {
    if (existing.status && existing.status !== 'pending') {
      return { success: false, reason: 'already_referred' };
    }
    if (existing.bonus_type === 'points') {
      return { success: false, reason: 'already_processed_points' };
    }
    return { success: false, reason: 'already_has_pending_referral' };
  }

  let referrer: { id: string; tenant_id?: string | null } | null = null;
  try {
    referrer = await db
      .prepare('SELECT id, tenant_id FROM customers WHERE id = ?')
      .bind(rc.customer_id)
      .first<{ id: string; tenant_id?: string | null }>();
  } catch {
    referrer = await db
      .prepare('SELECT id FROM customers WHERE id = ?')
      .bind(rc.customer_id)
      .first<{ id: string }>();
  }
  if (!referrer) return { success: false, reason: 'referrer_not_found' };
  if (effectiveTenant && 'tenant_id' in referrer && referrer.tenant_id !== undefined) {
    const referrerTenant = (referrer.tenant_id && String(referrer.tenant_id).trim()) || 'default';
    if (referrerTenant !== effectiveTenant) {
      return { success: false, reason: 'invalid_code' };
    }
  }

  const refId = genId('ref_');
  const now = nowIso();

  const policy = DEFAULT_REFERRAL_POLICY;
  const bonusType: ReferralBonusType = policy.bonusType;

  await db
    .prepare(
      `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, first_order_id, first_order_amount, status, bonus_type, reward_paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'pending', ?, NULL, ?)`,
    )
    .bind(refId, referrer.id, refereeId, normalized, policy.pointsReferrer, policy.cashbackReferrerVnd, bonusType, now)
    .run();
  if (effectiveTenant) {
    await db
      .prepare('UPDATE referrals SET tenant_id = ? WHERE id = ?')
      .bind(effectiveTenant, refId)
      .run()
      .catch(() => {});
  }

  await db
    .prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?')
    .bind(rc.id)
    .run();

  return { success: true, referrer_id: referrer.id, referee_id: refereeId, referral_id: refId };
}

// ─── reward on first order ──────────────────────────────────────────────

/**
 * Process referral reward when referee places first qualifying order.
 * Awards points OR cashback per policy. Idempotent: only processes 'pending'.
 */
export async function rewardReferralOnFirstOrder(
  db: D1Database,
  refereeId: string,
  orderId: string,
  orderAmountVnd: number,
  policyOverride?: ReferralPolicy,
  tenantId?: string,
): Promise<ReferralResult> {
  const policy = policyOverride ?? DEFAULT_REFERRAL_POLICY;
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;

  const referral = await db
    .prepare("SELECT * FROM referrals WHERE referred_customer_id = ? AND status = 'pending'")
    .bind(refereeId)
    .first<ReferralRow & { tenant_id?: string | null }>();
  if (!referral) return { success: false, reason: 'no_pending_referral' };
  if (effectiveTenant && 'tenant_id' in referral && referral.tenant_id !== undefined) {
    const refRowTenant = String(referral.tenant_id ?? '').trim() || 'default';
    if (refRowTenant !== effectiveTenant) return { success: false, reason: 'no_pending_referral' };
  }

  let referrer: { id: string; loyalty_points: number; lifetime_points: number; loyalty_tier: string; tenant_id?: string | null } | null = null;
  if (effectiveTenant) {
    try {
      referrer = await db
        .prepare("SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(referral.referrer_id, effectiveTenant)
        .first<{ id: string; loyalty_points: number; lifetime_points: number; loyalty_tier: string; tenant_id?: string | null }>();
    } catch {
      referrer = await db
        .prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?')
        .bind(referral.referrer_id)
        .first<{ id: string; loyalty_points: number; lifetime_points: number; loyalty_tier: string }>();
    }
  } else {
    referrer = await db
      .prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?')
      .bind(referral.referrer_id)
      .first<{ id: string; loyalty_points: number; lifetime_points: number; loyalty_tier: string }>();
  }
  if (!referrer) return { success: false, reason: 'referrer_not_found' };
  if (effectiveTenant && 'tenant_id' in referrer && referrer.tenant_id !== undefined) {
    const refTenant = String(referrer.tenant_id ?? '').trim() || 'default';
    if (refTenant !== effectiveTenant) return { success: false, reason: 'referrer_not_found' };
  }

  const now = nowIso();

  if (orderAmountVnd < policy.minOrderVnd) {
    return { success: false, reason: 'order_below_min', referral_id: referral.id };
  }

  if (policy.bonusType === 'points') {
    // ── points mode ──────────────────────────────────────────────────────
    const pointsToAward = policy.pointsReferrer;
    const newPoints = referrer.loyalty_points + pointsToAward;
    const newLifetime = referrer.lifetime_points + pointsToAward;

    const claimRes = await db
      .prepare("UPDATE referrals SET status = 'completed', bonus_type = 'points', reward_paid_at = ?, first_order_id = ?, first_order_amount = ? WHERE id = ? AND status = 'pending'")
      .bind(now, orderId, orderAmountVnd, referral.id)
      .run();
    if ((claimRes?.meta?.changes ?? 1) === 0) {
      return { success: false, reason: 'no_pending_referral' };
    }

    await db
      .prepare('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE id = ?')
      .bind(pointsToAward, pointsToAward, now, referrer.id)
      .run();

    await db
      .prepare(
        'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(genId('ptl_'), referrer.id, pointsToAward, 'referral', newPoints, `Referral bonus: +${pointsToAward} points`, now)
      .run();

    await db
      .prepare('UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?')
      .bind(pointsToAward, referral.referral_code)
      .run();

    await db
      .prepare('UPDATE loyalty_accounts SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE customer_id = ?')
      .bind(pointsToAward, pointsToAward, now, referrer.id)
      .run()
      .catch(() => {});

    if (policy.pointsReferee > 0) {
      try {
        const refereeBefore = await db
          .prepare('SELECT loyalty_points FROM customers WHERE id = ?')
          .bind(refereeId)
          .first<{ loyalty_points?: number }>()
          .catch(() => null);
        const refereeBalanceAfter = Number(refereeBefore?.loyalty_points ?? 0) + policy.pointsReferee;
        await db
          .prepare(
            'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE id = ?',
          )
          .bind(policy.pointsReferee, policy.pointsReferee, now, refereeId)
          .run();
        await db
          .prepare(
            'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            genId('ptl_'),
            refereeId,
            policy.pointsReferee,
            'referral_welcome',
            refereeBalanceAfter,
            `Referral welcome bonus: +${policy.pointsReferee} points`,
            now,
          )
          .run();
        await db
          .prepare('UPDATE loyalty_accounts SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE customer_id = ?')
          .bind(policy.pointsReferee, policy.pointsReferee, now, refereeId)
          .run()
          .catch(() => {});
      } catch {
        // Optional referee bonus credit
      }
    }

    return { success: true, referrer_id: referrer.id, referee_id: refereeId, reward_points: pointsToAward, new_balance: newPoints, new_lifetime_balance: newLifetime, referral_id: referral.id };
  }

  // ── cashback mode ─────────────────────────────────────────────────────
  const cashbackVnd = policy.cashbackReferrerVnd;

  // Ensure referrer has wallet
  let wallet: { id: string; balance: number; total_earned: number } | null = null;
  if (effectiveTenant) {
    try {
      wallet = await db
        .prepare("SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(referrer.id, effectiveTenant)
        .first<{ id: string; balance: number; total_earned: number }>();
    } catch {
      wallet = await db
        .prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?')
        .bind(referrer.id)
        .first<{ id: string; balance: number; total_earned: number }>();
    }
  } else {
    wallet = await db
      .prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?')
      .bind(referrer.id)
      .first<{ id: string; balance: number; total_earned: number }>();
  }

  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      effectiveTenant
        ? db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, tenant_id) VALUES (?, ?, 0, 0, 0, ?, ?)')
            .bind(walletId, referrer.id, now, effectiveTenant)
        : db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)')
            .bind(walletId, referrer.id, now),
    );
    wallet = { id: walletId, balance: 0, total_earned: 0 };
  }

  const cashbackClaimRes = await db
    .prepare("UPDATE referrals SET status = 'completed', bonus_type = 'cashback', cashback_awarded_vnd = ?, first_order_id = ?, first_order_amount = ?, reward_paid_at = ? WHERE id = ? AND status = 'pending'")
    .bind(cashbackVnd, orderId, orderAmountVnd, now, referral.id)
    .run();
  if ((cashbackClaimRes?.meta?.changes ?? 1) === 0) {
    return { success: false, reason: 'no_pending_referral' };
  }

  const newBalance = wallet.balance + cashbackVnd;
  const txId = referral.id ? `cbt_ref_${referral.id}_referrer` : genId('cbt_');

  batch.push(
    db.prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?')
      .bind(cashbackVnd, cashbackVnd, now, wallet.id),
  );
  batch.push(
    db.prepare(
      `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
       VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?)`,
    ).bind(txId, wallet.id, referrer.id, cashbackVnd, newBalance, `Referral bonus (ref=${referral.id}): +${cashbackVnd} VND`, now),
  );
  batch.push(
    db.prepare(
      `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
       VALUES (?, 'referral_cashback', ?, ?, ?, ?)`,
    ).bind(referrer.id, cashbackVnd, orderId, JSON.stringify({ referral_id: referral.id, referred_customer_id: refereeId }), now),
  );

  await db.batch(batch);

  try {
    await db
      .prepare('UPDATE referral_codes SET total_cashback_earned_vnd = total_cashback_earned_vnd + ? WHERE code = ?')
      .bind(cashbackVnd, referral.referral_code)
      .run();
  } catch {
    // Optional column/table in partial schemas
  }

  if (policy.cashbackRefereeVnd > 0) {
    try {
      const refereeCashback = policy.cashbackRefereeVnd;
      const existingRefWallet = effectiveTenant
        ? await db
            .prepare("SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
            .bind(refereeId, effectiveTenant)
            .first<{ id: string; balance: number; total_earned: number }>()
            .catch(() => null)
        : await db
            .prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?')
            .bind(refereeId)
            .first<{ id: string; balance: number; total_earned: number }>()
            .catch(() => null);
      const refWalletId = existingRefWallet?.id || genId('cbw_');
      const existingRefBalance = Number(existingRefWallet?.balance ?? 0);
      const newRefBalance = existingRefBalance + refereeCashback;
      if (!existingRefWallet) {
        if (effectiveTenant) {
          try {
            await db
              .prepare(
                'INSERT OR IGNORE INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, tenant_id) VALUES (?, ?, 0, 0, 0, ?, ?)',
              )
              .bind(refWalletId, refereeId, now, effectiveTenant)
              .run();
          } catch {
            await db
              .prepare(
                'INSERT OR IGNORE INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)',
              )
              .bind(refWalletId, refereeId, now)
              .run();
          }
        } else {
          await db
            .prepare(
              'INSERT OR IGNORE INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)',
            )
            .bind(refWalletId, refereeId, now)
            .run();
        }
      }
      if (effectiveTenant) {
        await db
          .prepare(
            "UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          )
          .bind(refereeCashback, refereeCashback, now, refereeId, effectiveTenant)
          .run();
      } else {
        await db
          .prepare(
            'UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ?',
          )
          .bind(refereeCashback, refereeCashback, now, refereeId)
          .run();
      }
      await db
        .prepare(
          `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
           VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?)`,
        )
        .bind(
          genId('cbt_'),
          refWalletId,
          refereeId,
          refereeCashback,
          newRefBalance,
          `Referral welcome bonus (ref=${referral.id}): +${refereeCashback} VND`,
          now,
        )
        .run();
    } catch {
      // Non-blocking referee bonus credit
    }
  }

  return { success: true, referrer_id: referrer.id, referee_id: refereeId, reward_vnd: cashbackVnd, referral_id: referral.id };
}

// ─── reverse referral cashback ──────────────────────────────────────────

/**
 * Reverse a completed referral cashback (on refund/cancel).
 */
export async function reverseReferralCashback(
  db: D1Database,
  referralId: string,
  tenantId?: string,
): Promise<ReferralResult> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  const referral = await db
    .prepare("SELECT * FROM referrals WHERE id = ? AND status = 'completed'")
    .bind(referralId)
    .first<ReferralRow & { tenant_id?: string | null }>();
  if (!referral) {
    return { success: false, reason: 'not_applicable', referral_id: referralId };
  }
  if (effectiveTenant) {
    if ('tenant_id' in referral && referral.tenant_id !== undefined) {
      const refRowTenant = String(referral.tenant_id ?? '').trim() || 'default';
      if (refRowTenant !== effectiveTenant) {
        return { success: false, reason: 'not_applicable', referral_id: referralId };
      }
    }
    try {
      const referrerTenantRow = await db
        .prepare('SELECT id, tenant_id FROM customers WHERE id = ?')
        .bind(referral.referrer_id)
        .first<{ id: string; tenant_id?: string | null }>();
      if (referrerTenantRow && 'tenant_id' in referrerTenantRow && referrerTenantRow.tenant_id !== undefined) {
        const refCustTenant = String(referrerTenantRow.tenant_id ?? '').trim() || 'default';
        if (refCustTenant !== effectiveTenant) {
          return { success: false, reason: 'not_applicable', referral_id: referralId };
        }
      }
    } catch {
      // Optional tenant_id column in minimal schemas
    }
  }

  const now = nowIso();

  if (!referral.cashback_awarded_vnd && referral.bonus_type === 'points') {
    const revClaim = await db
      .prepare("UPDATE referrals SET status = 'reversed', reward_paid_at = ? WHERE id = ? AND status = 'completed'")
      .bind(now, referralId)
      .run();
    if ((revClaim?.meta?.changes ?? 1) === 0) {
      return { success: false, reason: 'not_applicable', referral_id: referralId };
    }

    const referrerLog = await db
      .prepare(
        "SELECT points_change FROM loyalty_point_logs WHERE customer_id = ? AND reason = 'referral' AND points_change > 0 ORDER BY created_at DESC LIMIT 1",
      )
      .bind(referral.referrer_id)
      .first<{ points_change?: number }>()
      .catch(() => null);
    const pointsToReverse = Number(referrerLog?.points_change ?? DEFAULT_REFERRAL_POLICY.pointsReferrer);
    const referrerRow = await db
      .prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?')
      .bind(referral.referrer_id)
      .first<{ loyalty_points?: number; lifetime_points?: number }>()
      .catch(() => null);
    const newRefPoints = Math.max(0, Number(referrerRow?.loyalty_points ?? 0) - pointsToReverse);

    await db
      .prepare('UPDATE customers SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), updated_at = ? WHERE id = ?')
      .bind(pointsToReverse, pointsToReverse, now, referral.referrer_id)
      .run();
    await db
      .prepare('UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), updated_at = ? WHERE customer_id = ?')
      .bind(pointsToReverse, pointsToReverse, now, referral.referrer_id)
      .run()
      .catch(() => {});
    await db
      .prepare(
        'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        genId('ptl_'),
        referral.referrer_id,
        -pointsToReverse,
        'referral_reversal',
        newRefPoints,
        `Referral reversal (${referralId}): -${pointsToReverse} points`,
        now,
      )
      .run()
      .catch(() => {});
    await db
      .prepare(
        'UPDATE referral_codes SET total_points_earned = CASE WHEN COALESCE(total_points_earned, 0) >= ? THEN total_points_earned - ? ELSE 0 END WHERE code = ?',
      )
      .bind(pointsToReverse, pointsToReverse, referral.referral_code)
      .run()
      .catch(() => {});

    if (referral.referred_customer_id) {
      try {
        const welcomeLog = await db
          .prepare(
            "SELECT points_change FROM loyalty_point_logs WHERE customer_id = ? AND reason = 'referral_welcome' AND points_change > 0 ORDER BY created_at DESC LIMIT 1",
          )
          .bind(referral.referred_customer_id)
          .first<{ points_change?: number }>()
          .catch(() => null);
        const welcomePts = Number(welcomeLog?.points_change ?? 0);
        if (welcomePts > 0) {
          const refereeRow = await db
            .prepare('SELECT loyalty_points, lifetime_points FROM customers WHERE id = ?')
            .bind(referral.referred_customer_id)
            .first<{ loyalty_points?: number; lifetime_points?: number }>()
            .catch(() => null);
          const nextRefereePts = Math.max(0, Number(refereeRow?.loyalty_points ?? 0) - welcomePts);
          await db
            .prepare('UPDATE customers SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), updated_at = ? WHERE id = ?')
            .bind(welcomePts, welcomePts, now, referral.referred_customer_id)
            .run();
          await db
            .prepare('UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?), lifetime_points = MAX(0, COALESCE(lifetime_points, 0) - ?), updated_at = ? WHERE customer_id = ?')
            .bind(welcomePts, welcomePts, now, referral.referred_customer_id)
            .run()
            .catch(() => {});
          await db
            .prepare(
              'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              genId('ptl_'),
              referral.referred_customer_id,
              -welcomePts,
              'referral_welcome_reversal',
              nextRefereePts,
              `Referral welcome reversal (${referralId}): -${welcomePts} points`,
              now,
            )
            .run()
            .catch(() => {});
        }
      } catch {
        // Optional referee points reversal
      }
    }

    return { success: true, referrer_id: referral.referrer_id, referral_id: referralId, reward_points: -pointsToReverse, new_balance: newRefPoints };
  }

  if (!referral.cashback_awarded_vnd) {
    return { success: false, reason: 'not_applicable', referral_id: referralId };
  }

  const cbRevClaim = await db
    .prepare("UPDATE referrals SET status = 'reversed', reward_paid_at = ? WHERE id = ? AND status = 'completed'")
    .bind(now, referralId)
    .run();
  if ((cbRevClaim?.meta?.changes ?? 1) === 0) {
    return { success: false, reason: 'not_applicable', referral_id: referralId };
  }

  const debitVnd = referral.cashback_awarded_vnd;

  let wallet = effectiveTenant
    ? await db
        .prepare("SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(referral.referrer_id, effectiveTenant)
        .first<{ id: string; balance: number }>()
        .catch(() =>
          db
            .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
            .bind(referral.referrer_id)
            .first<{ id: string; balance: number }>()
        )
    : await db
        .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
        .bind(referral.referrer_id)
        .first<{ id: string; balance: number }>();

  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      effectiveTenant
        ? db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, tenant_id) VALUES (?, ?, 0, 0, 0, ?, ?)')
            .bind(walletId, referral.referrer_id, now, effectiveTenant)
        : db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)')
            .bind(walletId, referral.referrer_id, now),
    );
    wallet = { id: walletId, balance: 0 };
  }

  const newBalance = Math.max(0, wallet.balance - debitVnd);
  const txId = referralId ? `cbt_ref_rev_${referralId}` : genId('cbt_');

  batch.push(
    db.prepare('UPDATE cashback_wallets SET balance = MAX(0, COALESCE(balance, 0) - ?), total_spent = COALESCE(total_spent, 0) + ?, updated_at = ? WHERE id = ?')
      .bind(debitVnd, debitVnd, now, wallet.id),
  );
  batch.push(
    db.prepare(
      `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
       VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?)`,
    ).bind(txId, wallet.id, referral.referrer_id, debitVnd, newBalance, `Referral reversal (${referralId}): -${debitVnd} VND`, now),
  );
  batch.push(
    db.prepare(
      `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
       VALUES (?, 'referral_reversed', ?, NULL, ?, ?)`,
    ).bind(referral.referrer_id, debitVnd, JSON.stringify({ referral_id: referralId, reason: 'order_cancelled', debited: debitVnd }), now),
  );

  await db.batch(batch);

  try {
    await db
      .prepare(
        'UPDATE referral_codes SET total_cashback_earned_vnd = CASE WHEN COALESCE(total_cashback_earned_vnd, 0) >= ? THEN total_cashback_earned_vnd - ? ELSE 0 END WHERE code = ?',
      )
      .bind(debitVnd, debitVnd, referral.referral_code)
      .run();
  } catch {
    // Optional column/table in partial schemas
  }

  // Also reverse referee welcome bonus if credited on this referral
  if (referral.referred_customer_id) {
    try {
      const refTx = await db
        .prepare(
          "SELECT id, wallet_id, amount FROM cashback_transactions WHERE customer_id = ? AND type = 'bonus' AND description LIKE ? LIMIT 1",
        )
        .bind(referral.referred_customer_id, `Referral welcome bonus (ref=${referralId})%`)
        .first<{ id: string; wallet_id: string; amount: number }>()
        .catch(() => null);
      if (refTx && refTx.wallet_id && typeof refTx.amount === 'number' && refTx.amount > 0) {
        const refWallet = await db
          .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
          .bind(referral.referred_customer_id)
          .first<{ id: string; balance: number }>()
          .catch(() => null);
        if (refWallet) {
          const nextRefBal = Math.max(0, Number(refWallet.balance ?? 0) - refTx.amount);
          await db.batch([
            db.prepare('UPDATE cashback_wallets SET balance = ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?')
              .bind(nextRefBal, refTx.amount, now, refWallet.id),
            db.prepare(
              `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
               VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?)`,
            ).bind(genId('cbt_'), refWallet.id, referral.referred_customer_id, refTx.amount, nextRefBal, `Referral welcome reversal (${referralId}): -${refTx.amount} VND`, now),
          ]);
        }
      }
    } catch {
      // Non-blocking referee reversal
    }
  }

  return { success: true, referrer_id: referral.referrer_id, referral_id: referralId };
}

// ─── status ─────────────────────────────────────────────────────────────

/**
 * Get full referral status for a dashboard.
 */
export async function getReferralStatus(
  db: D1Database,
  customerId: string,
  tenantId?: string,
): Promise<ReferralStatus> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
  let rc = await db
    .prepare('SELECT * FROM referral_codes WHERE customer_id = ?')
    .bind(customerId)
    .first<ReferralCodeRow & { tenant_id?: string | null }>();
  if (rc && effectiveTenant && 'tenant_id' in rc && rc.tenant_id !== undefined) {
    const rcTenant = String(rc.tenant_id ?? '').trim() || 'default';
    if (rcTenant !== effectiveTenant) {
      rc = await db
        .prepare("SELECT * FROM referral_codes WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, effectiveTenant)
        .first<ReferralCodeRow & { tenant_id?: string | null }>()
        .catch(() => null);
    }
  }

  const total = effectiveTenant
    ? await db
        .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status IN (?, ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, 'completed', 'pending', effectiveTenant)
        .first<{ cnt: number }>()
        .catch(() =>
          db
            .prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status IN (?, ?)')
            .bind(customerId, 'completed', 'pending')
            .first<{ cnt: number }>()
        )
    : await db
        .prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status IN (?, ?)')
        .bind(customerId, 'completed', 'pending')
        .first<{ cnt: number }>();

  const pending = effectiveTenant
    ? await db
        .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, effectiveTenant)
        .first<{ cnt: number }>()
        .catch(() =>
          db
            .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'pending'")
            .bind(customerId)
            .first<{ cnt: number }>()
        )
    : await db
        .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'pending'")
        .bind(customerId)
        .first<{ cnt: number }>();

  const cashbackEarned = effectiveTenant
    ? await db
        .prepare("SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, 'completed', effectiveTenant)
        .first<{ total: number }>()
        .catch(() =>
          db
            .prepare('SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ?')
            .bind(customerId, 'completed')
            .first<{ total: number }>()
        )
    : await db
        .prepare('SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ?')
        .bind(customerId, 'completed')
        .first<{ total: number }>();

  return {
    code: rc?.code ?? null,
    total_referrals: total?.cnt ?? 0,
    pending_count: pending?.cnt ?? 0,
    total_points_earned: rc?.total_points_earned ?? 0,
    total_cashback_earned_vnd: cashbackEarned?.total ?? 0,
    code_usage: rc?.times_used ?? 0,
  };
}
