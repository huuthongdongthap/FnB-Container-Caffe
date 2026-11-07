import type { D1Database } from '@cloudflare/workers-types';
import type { Referral, CashbackWallet } from '../../types/models';

function genId(prefix: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + rand;
}

export async function reverseReferralCashback(db: D1Database, referralId: string, tenantId?: string): Promise<Record<string, unknown>> {
  const rawTenant = tenantId ? tenantId.trim() : '';
  let effectiveTenant = rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : null;
  let referral: (Referral & { tenant_id?: string | null }) | null = null;
  if (effectiveTenant) {
    try {
      referral = await db
        .prepare("SELECT * FROM referrals WHERE id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(referralId, 'completed', effectiveTenant)
        .first<Referral & { tenant_id?: string | null }>();
    } catch {
      referral = await db.prepare('SELECT * FROM referrals WHERE id = ? AND status = ?').bind(referralId, 'completed').first<Referral & { tenant_id?: string | null }>();
    }
    if (referral && 'tenant_id' in referral && referral.tenant_id !== undefined) {
      const refTenant = String(referral.tenant_id ?? '').trim() || 'default';
      if (refTenant !== effectiveTenant) {
        return { success: false, reason: 'not_applicable' };
      }
    }
  } else {
    referral = await db.prepare('SELECT * FROM referrals WHERE id = ? AND status = ?').bind(referralId, 'completed').first<Referral & { tenant_id?: string | null }>();
    if (referral && 'tenant_id' in referral && referral.tenant_id !== undefined) {
      const refTenant = String(referral.tenant_id ?? '').trim();
      if (refTenant && refTenant !== '*' && refTenant.toLowerCase() !== 'hq') {
        effectiveTenant = refTenant;
      }
    }
  }
  if (!referral || !referral.cashback_awarded_vnd) {
    return { success: false, reason: 'not_applicable' };
  }

  const DEBIT_VND = referral.cashback_awarded_vnd;
  const referrerId = referral.referrer_id;
  const now = new Date().toISOString();

  if (effectiveTenant) {
    try {
      const refCust = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(referrerId).first<{ id: string; tenant_id?: string | null }>();
      if (refCust && 'tenant_id' in refCust && refCust.tenant_id !== undefined) {
        const custTenant = String(refCust.tenant_id ?? '').trim() || 'default';
        if (custTenant !== effectiveTenant) {
          return { success: false, reason: 'not_applicable' };
        }
      }
    } catch {
      // Optional customers tenant check
    }
  }

  let claimRes: unknown;
  try {
    claimRes = effectiveTenant
      ? await db
          .prepare("UPDATE referrals SET status = ?, reward_paid_at = ? WHERE id = ? AND status = 'completed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind('reversed', now, referralId, effectiveTenant)
          .run()
      : await db.prepare("UPDATE referrals SET status = ?, reward_paid_at = ? WHERE id = ? AND status = 'completed'").bind('reversed', now, referralId).run();
  } catch {
    try {
      claimRes = await db.prepare("UPDATE referrals SET status = ?, reward_paid_at = ? WHERE id = ? AND status = 'completed'").bind('reversed', now, referralId).run();
    } catch {
      claimRes = await db.prepare("UPDATE referrals SET status = ? WHERE id = ? AND status = 'completed'").bind('reversed', referralId).run();
    }
  }
  const claimChanges = (claimRes as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 1;
  if (claimChanges === 0) {
    return { success: false, reason: 'not_applicable' };
  }

  let wallet: (CashbackWallet & { tenant_id?: string | null }) | null = null;
  if (effectiveTenant) {
    try {
      wallet = await db
        .prepare("SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(referrerId, effectiveTenant)
        .first<CashbackWallet & { tenant_id?: string | null }>();
    } catch {
      try {
        wallet = await db.prepare('SELECT id, balance, tenant_id FROM cashback_wallets WHERE customer_id = ?').bind(referrerId).first<CashbackWallet & { tenant_id?: string | null }>();
      } catch {
        wallet = await db.prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?').bind(referrerId).first<CashbackWallet & { tenant_id?: string | null }>();
      }
      if (wallet && 'tenant_id' in wallet && wallet.tenant_id !== undefined) {
        const walletTenant = String(wallet.tenant_id ?? '').trim() || 'default';
        if (walletTenant !== effectiveTenant) {
          wallet = null;
        }
      }
    }
  } else {
    wallet = await db.prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?').bind(referrerId).first<CashbackWallet & { tenant_id?: string | null }>();
  }
  const batch: ReturnType<typeof db.prepare>[] = [];
  const hadExistingWallet = Boolean(wallet);

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(
      effectiveTenant
        ? db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, tenant_id) VALUES (?, ?, 0, 0, 0, ?, ?)').bind(walletId, referrerId, now, effectiveTenant)
        : db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(walletId, referrerId, now)
    );
    wallet = { id: walletId, customer_id: referrerId, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const walletBalance = Math.max(0, Number(wallet.balance) || 0);
  const actualDebit = hadExistingWallet ? Math.min(walletBalance, DEBIT_VND) : DEBIT_VND;
  const newBalance = Math.max(0, walletBalance - actualDebit);
  const txId = genId('cbt_');
  const resolvedTenantForAudit = effectiveTenant || 'default';

  batch.push(db.prepare('UPDATE cashback_wallets SET balance = MAX(0, COALESCE(balance, 0) - ?), total_earned = MAX(0, COALESCE(total_earned, 0) - ?), updated_at = ? WHERE id = ?').bind(actualDebit, actualDebit, now, wallet.id));
  batch.push(db.prepare(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, tenant_id, created_at)
     VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?, ?)`
  ).bind(txId, wallet.id, referrerId, actualDebit, newBalance, `Hoan ti?n referral (${referralId}): -${actualDebit}d do don hang bi h?y`, resolvedTenantForAudit, now));
  batch.push(db.prepare(
    'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(referrerId, 'referral_reversed', actualDebit, null, JSON.stringify({ referral_id: referralId, reason: 'order_cancelled', debited: actualDebit, requested_debit: DEBIT_VND }), resolvedTenantForAudit, now));

  try {
    await db.batch(batch);
  } catch {
    const fallbackBatch: ReturnType<typeof db.prepare>[] = [
      db.prepare('UPDATE cashback_wallets SET balance = MAX(0, COALESCE(balance, 0) - ?), total_earned = MAX(0, COALESCE(total_earned, 0) - ?), updated_at = ? WHERE id = ?').bind(actualDebit, actualDebit, now, wallet.id),
      db.prepare(
        `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
         VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?)`
      ).bind(txId, wallet.id, referrerId, actualDebit, newBalance, `Hoan ti?n referral (${referralId}): -${actualDebit}d do don hang bi h?y`, now),
    ];
    await db.batch(fallbackBatch);
  }
  return { success: true, debited_vnd: actualDebit, new_balance: newBalance };
}
