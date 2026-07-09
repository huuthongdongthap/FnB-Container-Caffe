import type { D1Database } from '@cloudflare/workers-types';
import type { Referral, CashbackWallet } from '../../types/models';

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function reverseReferralCashback(db: D1Database, referralId: string): Promise<Record<string, unknown>> {
  const referral = await db.prepare('SELECT * FROM referrals WHERE id = ? AND status = ?').bind(referralId, 'completed').first<Referral>();
  if (!referral || !referral.cashback_awarded_vnd) {
    return { success: false, reason: 'not_applicable' };
  }

  const DEBIT_VND = referral.cashback_awarded_vnd;
  const referrerId = referral.referrer_id;
  const now = new Date().toISOString();

  let wallet = await db.prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?').bind(referrerId).first<CashbackWallet>();
  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(walletId, referrerId, now));
    wallet = { id: walletId, customer_id: referrerId, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = Math.max(0, (wallet.balance || 0) - DEBIT_VND);
  const txId = genId('cbt_');

  batch.push(db.prepare('UPDATE cashback_wallets SET balance = ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?').bind(newBalance, DEBIT_VND, now, wallet.id));
  batch.push(db.prepare(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
     VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?)`
  ).bind(txId, wallet.id, referrerId, DEBIT_VND, newBalance, `Hoan ti?n referral (${referralId}): -${DEBIT_VND}d do don hang bi h?y`, now));
  batch.push(db.prepare('UPDATE referrals SET status = ?, reward_paid_at = ? WHERE id = ?').bind('reversed', now, referralId));
  batch.push(db.prepare(
    'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(referrerId, 'referral_reversed', DEBIT_VND, null, JSON.stringify({ referral_id: referralId, reason: 'order_cancelled', debited: DEBIT_VND }), now));

  await db.batch(batch);
  return { success: true, debited_vnd: DEBIT_VND, new_balance: newBalance };
}
