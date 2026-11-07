import type { D1Database } from '@cloudflare/workers-types';
import type { Referral, CashbackWallet } from '../../types/models';

function genId(prefix: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + rand;
}

export async function processReferralCashbackOnFirstOrder(db: D1Database, customerId: string, orderId: string, orderAmount: number, tenantId?: string): Promise<Record<string, unknown>> {
  const MIN_ORDER_AMOUNT = 20000;
  const REFERRER_CASHBACK_VND = 10000;
  const rawTenant = tenantId ? tenantId.trim() : '';
  let effectiveTenant = rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : null;

  if (orderAmount < MIN_ORDER_AMOUNT) {
    return { success: false, reason: 'order_below_min', min_required: MIN_ORDER_AMOUNT };
  }

  let pending: (Referral & { tenant_id?: string | null }) | null = null;
  if (effectiveTenant) {
    try {
      pending = await db
        .prepare("SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(customerId, 'pending', effectiveTenant)
        .first<Referral & { tenant_id?: string | null }>();
    } catch {
      pending = await db.prepare('SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(customerId, 'pending').first<Referral & { tenant_id?: string | null }>();
    }
    if (pending && 'tenant_id' in pending && pending.tenant_id !== undefined) {
      const pTenant = String(pending.tenant_id ?? '').trim() || 'default';
      if (pTenant !== effectiveTenant) {
        return { success: false, reason: 'no_pending_referral' };
      }
    }
  } else {
    pending = await db.prepare('SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(customerId, 'pending').first<Referral & { tenant_id?: string | null }>();
    if (pending && 'tenant_id' in pending && pending.tenant_id !== undefined) {
      const pTenant = String(pending.tenant_id ?? '').trim();
      if (pTenant && pTenant !== '*' && pTenant.toLowerCase() !== 'hq') {
        effectiveTenant = pTenant;
      }
    }
  }
  if (!pending) {
    return { success: false, reason: 'no_pending_referral' };
  }

  if (pending.bonus_type === 'points') {
    return { success: false, reason: 'already_processed_points' };
  }

  let referrer: { id: string; tenant_id?: string | null } | null = null;
  if (effectiveTenant) {
    try {
      referrer = await db
        .prepare("SELECT id, tenant_id FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(pending.referrer_id, effectiveTenant)
        .first<{ id: string; tenant_id?: string | null }>();
    } catch {
      referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(pending.referrer_id).first<{ id: string }>();
    }
  } else {
    referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(pending.referrer_id).first<{ id: string }>();
  }
  if (!referrer) {
    return { success: false, reason: 'referrer_not_found' };
  }
  if (effectiveTenant && 'tenant_id' in referrer && referrer.tenant_id !== undefined) {
    const refTenant = String(referrer.tenant_id ?? '').trim() || 'default';
    if (refTenant !== effectiveTenant) {
      return { success: false, reason: 'referrer_not_found' };
    }
  }

  const now = new Date().toISOString();
  let wallet: CashbackWallet | null = null;
  if (effectiveTenant) {
    try {
      wallet = await db
        .prepare("SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(referrer.id, effectiveTenant)
        .first<CashbackWallet>();
    } catch {
      wallet = await db.prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?').bind(referrer.id).first<CashbackWallet>();
    }
  } else {
    wallet = await db.prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?').bind(referrer.id).first<CashbackWallet>();
  }
  const batch: ReturnType<typeof db.prepare>[] = [];

  const hadExistingWallet = Boolean(wallet);
  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      effectiveTenant
        ? db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, tenant_id) VALUES (?, ?, 0, 0, 0, ?, ?)').bind(walletId, referrer.id, now, effectiveTenant)
        : db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(walletId, referrer.id, now)
    );
    wallet = { id: walletId, customer_id: referrer.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = (wallet.balance || 0) + REFERRER_CASHBACK_VND;
  // Deterministic transaction ID keyed by referral ID prevents duplicate payouts on retry.
  const txId = `cbt_ref_${pending.id}_referrer`;
  const stampTenant = effectiveTenant || 'default';

  batch.push(
    effectiveTenant
      ? db.prepare(
          "UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(REFERRER_CASHBACK_VND, REFERRER_CASHBACK_VND, now, wallet.id, effectiveTenant)
      : db.prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(REFERRER_CASHBACK_VND, REFERRER_CASHBACK_VND, now, wallet.id)
  );
  batch.push(db.prepare(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, tenant_id, created_at)
     VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?, ?)`
  ).bind(txId, wallet.id, referrer.id, REFERRER_CASHBACK_VND, newBalance, `Gi?i thi?u b?n (referral_id=${pending.id}): +${REFERRER_CASHBACK_VND}d cashback`, stampTenant, now));
  const referralClaimBatchIndex = batch.length;
  batch.push(
    effectiveTenant
      ? db.prepare(
          "UPDATE referrals SET status = 'completed', cashback_awarded_vnd = ?, first_order_id = ?, first_order_amount = ?, reward_paid_at = ? WHERE id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(REFERRER_CASHBACK_VND, orderId, orderAmount, now, pending.id, effectiveTenant)
      : db.prepare(
          "UPDATE referrals SET status = 'completed', cashback_awarded_vnd = ?, first_order_id = ?, first_order_amount = ?, reward_paid_at = ? WHERE id = ? AND status = 'pending'"
        ).bind(REFERRER_CASHBACK_VND, orderId, orderAmount, now, pending.id)
  );
  batch.push(db.prepare(
    `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, tenant_id, created_at)
     VALUES (?, 'referral_cashback', ?, ?, ?, ?, ?)`
  ).bind(referrer.id, REFERRER_CASHBACK_VND, orderId, JSON.stringify({ referral_id: pending.id, referred_customer_id: customerId, order_amount: orderAmount }), stampTenant, now));

  try {
    const batchRes = await db.batch(batch);
    const claimStmtRes = Array.isArray(batchRes) ? (batchRes[referralClaimBatchIndex] as { meta?: { changes?: number } } | undefined) : undefined;
    if (claimStmtRes?.meta?.changes === 0) {
      return { success: false, reason: 'no_pending_referral' };
    }
  } catch {
    const fallbackBatch: ReturnType<typeof db.prepare>[] = [];
    if (!hadExistingWallet) {
      fallbackBatch.push(
        db.prepare('INSERT OR IGNORE INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(wallet.id, referrer.id, now)
      );
    }
    fallbackBatch.push(
      db.prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(REFERRER_CASHBACK_VND, REFERRER_CASHBACK_VND, now, wallet.id),
      db.prepare(
        `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
         VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?)`
      ).bind(txId, wallet.id, referrer.id, REFERRER_CASHBACK_VND, newBalance, `Gi?i thi?u b?n (referral_id=${pending.id}): +${REFERRER_CASHBACK_VND}d cashback`, now),
      db.prepare("UPDATE referrals SET status = 'completed' WHERE id = ? AND status = 'pending'").bind(pending.id)
    );
    await db.batch(fallbackBatch);
  }

  return { success: true, referrer_id: referrer.id, cashback_awarded_vnd: REFERRER_CASHBACK_VND, new_balance: newBalance };
}
