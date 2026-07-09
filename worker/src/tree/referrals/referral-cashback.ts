import type { D1Database } from '@cloudflare/workers-types';
import type { Referral, CashbackWallet } from '../../types/models';

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function processReferralCashbackOnFirstOrder(db: D1Database, customerId: string, orderId: string, orderAmount: number): Promise<Record<string, unknown>> {
  const MIN_ORDER_AMOUNT = 20000;
  const REFERRER_CASHBACK_VND = 10000;

  if (orderAmount < MIN_ORDER_AMOUNT) {
    return { success: false, reason: 'order_below_min', min_required: MIN_ORDER_AMOUNT };
  }

  const pending = await db.prepare('SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(customerId, 'pending').first<Referral>();
  if (!pending) {
    return { success: false, reason: 'no_pending_referral' };
  }

  if (pending.bonus_type === 'points') {
    return { success: false, reason: 'already_processed_points' };
  }

  const referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(pending.referrer_id).first<{ id: string }>();
  if (!referrer) {
    return { success: false, reason: 'referrer_not_found' };
  }

  const now = new Date().toISOString();
  let wallet = await db.prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?').bind(referrer.id).first<CashbackWallet>();
  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(walletId, referrer.id, now));
    wallet = { id: walletId, customer_id: referrer.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = (wallet.balance || 0) + REFERRER_CASHBACK_VND;
  const txId = genId('cbt_');

  batch.push(db.prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(REFERRER_CASHBACK_VND, REFERRER_CASHBACK_VND, now, wallet.id));
  batch.push(db.prepare(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
     VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?)`
  ).bind(txId, wallet.id, referrer.id, REFERRER_CASHBACK_VND, newBalance, `Gi?i thi?u b?n (referral_id=${pending.id}): +${REFERRER_CASHBACK_VND}d cashback`, now));
  batch.push(db.prepare(
    'UPDATE referrals SET status = \'completed\', cashback_awarded_vnd = ?, first_order_id = ?, first_order_amount = ?, reward_paid_at = ? WHERE id = ?'
  ).bind(REFERRER_CASHBACK_VND, orderId, orderAmount, now, pending.id));
  batch.push(db.prepare(
    `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
     VALUES (?, 'referral_cashback', ?, ?, ?, ?)`
  ).bind(referrer.id, REFERRER_CASHBACK_VND, orderId, JSON.stringify({ referral_id: pending.id, referred_customer_id: customerId, order_amount: orderAmount }), now));

  await db.batch(batch);

  return { success: true, referrer_id: referrer.id, cashback_awarded_vnd: REFERRER_CASHBACK_VND, new_balance: newBalance };
}
