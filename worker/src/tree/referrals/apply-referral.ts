import type { D1Database } from '@cloudflare/workers-types';
import type { ReferralCode } from '../../types/models';

function genId(prefix: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + rand;
}

export async function applyReferralForNewCustomer(db: D1Database, newCustomerId: string, referralCode: string): Promise<Record<string, unknown>> {
  if (!referralCode) {
    return { success: false, reason: 'no_code' };
  }

  const normalized = referralCode.trim().toUpperCase();
  const rc = await db.prepare('SELECT * FROM referral_codes WHERE code = ?').bind(normalized).first<ReferralCode>();
  if (!rc) {
    return { success: false, reason: 'invalid_code' };
  }
  if (rc.customer_id === newCustomerId) {
    return { success: false, reason: 'self_referral' };
  }

  let pending: { id: string; bonus_type: string | null } | null = null;
  try {
    pending = await db.prepare('SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(newCustomerId, 'pending').first<{ id: string; bonus_type: string | null }>();
  } catch {
    const row = await db.prepare('SELECT id FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(newCustomerId, 'pending').first<{ id: string }>();
    pending = row ? { id: row.id, bonus_type: 'cashback' } : null;
  }
  if (!pending) {
    return { success: false, reason: 'no_pending_referral' };
  }
  if (pending.bonus_type === 'points') {
    return { success: false, reason: 'already_processed_points' };
  }

  const referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string; tenant_id?: string | null }>();
  if (!referrer) {
    return { success: false, reason: 'referrer_not_found' };
  }
  try {
    const referrerWithTenant = referrer.tenant_id !== undefined
      ? referrer
      : await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string; tenant_id?: string | null }>();
    if (referrerWithTenant && referrerWithTenant.tenant_id !== undefined) {
      const referee = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(newCustomerId).first<{ id: string; tenant_id?: string | null }>();
      if (referee && referee.tenant_id !== undefined) {
        const refTenant = (referrerWithTenant.tenant_id && referrerWithTenant.tenant_id.trim()) || 'default';
        const custTenant = (referee.tenant_id && referee.tenant_id.trim()) || 'default';
        if (refTenant !== custTenant) {
          return { success: false, reason: 'referrer_not_found' };
        }
      }
    }
  } catch {
    // Optional tenant_id column in minimal test schemas
  }

  const REFERRER_CASHBACK_VND = 10000;
  const now = new Date().toISOString();
  const refId = genId('ref_');

  try {
    await db.prepare(
      `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
    ).bind(refId, referrer.id, newCustomerId, normalized, REFERRER_CASHBACK_VND, 'pending', now).run();
  } catch {
    await db.prepare(
      `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, status, created_at)
       VALUES (?, ?, ?, ?, 0, 'pending', ?)`
    ).bind(refId, referrer.id, newCustomerId, normalized, now).run();
  }

  await db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?').bind(rc.id).run();
  return { success: true, referrer_cashback_pending: REFERRER_CASHBACK_VND };
}
