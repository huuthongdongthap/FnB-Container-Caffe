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
  resolveReferralPolicy,
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
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return result;
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
): Promise<{ code: string; isNew: boolean }> {
  const existing = await db
    .prepare('SELECT * FROM referral_codes WHERE customer_id = ?')
    .bind(customerId)
    .first<ReferralCodeRow>();
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

  return { code, isNew: true };
}

/**
 * Look up a referral code value by customer.
 */
export async function getReferralCode(
  db: D1Database,
  customerId: string,
): Promise<string | null> {
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
): Promise<ReferralResult> {
  const normalized = referralCode.trim().toUpperCase();

  const rc = await db
    .prepare('SELECT * FROM referral_codes WHERE code = ?')
    .bind(normalized)
    .first<ReferralCodeRow>();
  if (!rc) return { success: false, reason: 'invalid_code' };

  if (rc.customer_id === refereeId) {
    return { success: false, reason: 'self_referral' };
  }

  // Check for existing pending referral
  const existing = await db
    .prepare("SELECT id, status, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = 'pending'")
    .bind(refereeId)
    .first<{ id: string; status: string; bonus_type: ReferralBonusType | null }>();
  if (existing) {
    if (existing.bonus_type === 'points') {
      return { success: false, reason: 'already_processed_points' };
    }
    return { success: false, reason: 'already_has_pending_referral' };
  }

  const referrer = await db
    .prepare('SELECT id FROM customers WHERE id = ?')
    .bind(rc.customer_id)
    .first<{ id: string }>();
  if (!referrer) return { success: false, reason: 'referrer_not_found' };

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
): Promise<ReferralResult> {
  const policy = policyOverride ?? DEFAULT_REFERRAL_POLICY;

  const referral = await db
    .prepare("SELECT * FROM referrals WHERE referred_customer_id = ? AND status = 'pending'")
    .bind(refereeId)
    .first<ReferralRow>();
  if (!referral) return { success: false, reason: 'no_pending_referral' };

  const referrer = await db
    .prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?')
    .bind(referral.referrer_id)
    .first<{ id: string; loyalty_points: number; lifetime_points: number; loyalty_tier: string }>();
  if (!referrer) return { success: false, reason: 'referrer_not_found' };

  const now = nowIso();

  if (policy.bonusType === 'points') {
    // ── points mode ──────────────────────────────────────────────────────
    const pointsToAward = policy.pointsReferrer;
    const newPoints = referrer.loyalty_points + pointsToAward;
    const newLifetime = referrer.lifetime_points + pointsToAward;

    await db
      .prepare('UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?')
      .bind(newPoints, newLifetime, now, referrer.id)
      .run();

    await db
      .prepare(
        'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(genId('ptl_'), referrer.id, pointsToAward, 'referral', newPoints, `Referral bonus: +${pointsToAward} points`, now)
      .run();

    await db
      .prepare("UPDATE referrals SET status = 'completed', bonus_type = 'points', reward_paid_at = ?, first_order_id = ?, first_order_amount = ? WHERE id = ?")
      .bind(now, orderId, orderAmountVnd, referral.id)
      .run();

    await db
      .prepare('UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?')
      .bind(pointsToAward, referral.referral_code)
      .run();

    return { success: true, referrer_id: referrer.id, referee_id: refereeId, reward_points: pointsToAward, new_balance: newPoints, new_lifetime_balance: newLifetime, referral_id: referral.id };
  }

  // ── cashback mode ─────────────────────────────────────────────────────
  if (orderAmountVnd < policy.minOrderVnd) {
    return { success: false, reason: 'order_below_min', referral_id: referral.id };
  }

  const cashbackVnd = policy.cashbackReferrerVnd;

  // Ensure referrer has wallet
  let wallet = await db
    .prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?')
    .bind(referrer.id)
    .first<{ id: string; balance: number; total_earned: number }>();

  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)')
        .bind(walletId, referrer.id, now),
    );
    wallet = { id: walletId, balance: 0, total_earned: 0 };
  }

  const newBalance = wallet.balance + cashbackVnd;
  const txId = genId('cbt_');

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
    db.prepare("UPDATE referrals SET status = 'completed', bonus_type = 'cashback', cashback_awarded_vnd = ?, first_order_id = ?, first_order_amount = ?, reward_paid_at = ? WHERE id = ?")
      .bind(cashbackVnd, orderId, orderAmountVnd, now, referral.id),
  );
  batch.push(
    db.prepare(
      `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
       VALUES (?, 'referral_cashback', ?, ?, ?, ?)`,
    ).bind(referrer.id, cashbackVnd, orderId, JSON.stringify({ referral_id: referral.id, referred_customer_id: refereeId }), now),
  );

  await db.batch(batch);

  return { success: true, referrer_id: referrer.id, referee_id: refereeId, reward_vnd: cashbackVnd, referral_id: referral.id };
}

// ─── reverse referral cashback ──────────────────────────────────────────

/**
 * Reverse a completed referral cashback (on refund/cancel).
 */
export async function reverseReferralCashback(
  db: D1Database,
  referralId: string,
): Promise<ReferralResult> {
  const referral = await db
    .prepare("SELECT * FROM referrals WHERE id = ? AND status = 'completed'")
    .bind(referralId)
    .first<ReferralRow>();
  if (!referral || !referral.cashback_awarded_vnd) {
    return { success: false, reason: 'not_applicable', referral_id: referralId };
  }

  const debitVnd = referral.cashback_awarded_vnd;
  const now = nowIso();

  let wallet = await db
    .prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?')
    .bind(referral.referrer_id)
    .first<{ id: string; balance: number }>();

  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)')
        .bind(walletId, referral.referrer_id, now),
    );
    wallet = { id: walletId, balance: 0 };
  }

  const newBalance = Math.max(0, wallet.balance - debitVnd);
  const txId = genId('cbt_');

  batch.push(
    db.prepare('UPDATE cashback_wallets SET balance = ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?')
      .bind(newBalance, debitVnd, now, wallet.id),
  );
  batch.push(
    db.prepare(
      `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
       VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?)`,
    ).bind(txId, wallet.id, referral.referrer_id, debitVnd, newBalance, `Referral reversal (${referralId}): -${debitVnd} VND`, now),
  );
  batch.push(
    db.prepare("UPDATE referrals SET status = 'reversed', reward_paid_at = ? WHERE id = ?")
      .bind(now, referralId),
  );
  batch.push(
    db.prepare(
      `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
       VALUES (?, 'referral_reversed', ?, NULL, ?, ?)`,
    ).bind(referral.referrer_id, debitVnd, JSON.stringify({ referral_id: referralId, reason: 'order_cancelled', debited: debitVnd }), now),
  );

  await db.batch(batch);

  return { success: true, referrer_id: referral.referrer_id, referral_id: referralId };
}

// ─── status ─────────────────────────────────────────────────────────────

/**
 * Get full referral status for a dashboard.
 */
export async function getReferralStatus(
  db: D1Database,
  customerId: string,
): Promise<ReferralStatus> {
  const rc = await db
    .prepare('SELECT * FROM referral_codes WHERE customer_id = ?')
    .bind(customerId)
    .first<ReferralCodeRow>();

  const total = await db
    .prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status IN (?, ?)')
    .bind(customerId, 'completed', 'pending')
    .first<{ cnt: number }>();

  const pending = await db
    .prepare("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND status = 'pending'")
    .bind(customerId)
    .first<{ cnt: number }>();

  const cashbackEarned = await db
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
