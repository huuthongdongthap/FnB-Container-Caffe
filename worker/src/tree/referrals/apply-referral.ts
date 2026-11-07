import type { D1Database } from '@cloudflare/workers-types';
import type { ReferralCode } from '../../types/models';

function genId(prefix: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + rand;
}

export async function applyReferralForNewCustomer(db: D1Database, newCustomerId: string, referralCode: string, tenantId?: string): Promise<Record<string, unknown>> {
  const rawTenant = tenantId ? tenantId.trim() : '';
  let effectiveTenant = rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : null;
  if (!referralCode) {
    return { success: false, reason: 'no_code' };
  }

  const normalized = referralCode.trim().toUpperCase();
  let rc: (ReferralCode & { tenant_id?: string | null; max_uses?: number | null }) | null = null;
  if (effectiveTenant) {
    try {
      rc = await db.prepare(
        "SELECT * FROM referral_codes WHERE code = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(normalized, effectiveTenant).first<ReferralCode & { tenant_id?: string | null; max_uses?: number | null }>();
    } catch {
      rc = null;
    }
  }
  if (!rc) {
    rc = await db.prepare('SELECT * FROM referral_codes WHERE code = ?').bind(normalized).first<ReferralCode & { tenant_id?: string | null; max_uses?: number | null }>();
  }
  if (!rc) {
    return { success: false, reason: 'invalid_code' };
  }
  if (rc.customer_id === newCustomerId) {
    return { success: false, reason: 'self_referral' };
  }
  if ('tenant_id' in rc && rc.tenant_id !== undefined) {
    const rcTenant = (String(rc.tenant_id ?? '').trim()) || 'default';
    if (effectiveTenant && rcTenant !== effectiveTenant) {
      return { success: false, reason: 'referrer_not_found' };
    }
    if (!effectiveTenant && rcTenant !== '*' && rcTenant.toLowerCase() !== 'hq') {
      effectiveTenant = rcTenant;
    }
  }
  if (typeof rc.max_uses === 'number' && rc.max_uses > 0 && Number(rc.times_used ?? 0) >= rc.max_uses) {
    return { success: false, reason: 'code_exhausted' };
  }

  let pending: { id: string; bonus_type: string | null; tenant_id?: string | null } | null = null;
  try {
    if (effectiveTenant) {
      pending = await db.prepare(
        "SELECT id, bonus_type, tenant_id FROM referrals WHERE referred_customer_id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
      ).bind(newCustomerId, 'pending', effectiveTenant).first<{ id: string; bonus_type: string | null; tenant_id?: string | null }>();
      if (!pending) {
        pending = await db.prepare(
          'SELECT id, bonus_type, tenant_id FROM referrals WHERE referred_customer_id = ? AND status = ?'
        ).bind(newCustomerId, 'pending').first<{ id: string; bonus_type: string | null; tenant_id?: string | null }>();
      }
      if (!pending) {
        pending = await db.prepare(
          'SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?'
        ).bind(newCustomerId, 'pending').first<{ id: string; bonus_type: string | null; tenant_id?: string | null }>();
      }
    } else {
      pending = await db.prepare(
        'SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?'
      ).bind(newCustomerId, 'pending').first<{ id: string; bonus_type: string | null; tenant_id?: string | null }>();
    }
  } catch {
    try {
      pending = await db.prepare('SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(newCustomerId, 'pending').first<{ id: string; bonus_type: string | null; tenant_id?: string | null }>();
    } catch {
      const row = await db.prepare('SELECT id FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(newCustomerId, 'pending').first<{ id: string }>();
      pending = row ? { id: row.id, bonus_type: 'cashback' } : null;
    }
  }
  if (pending && effectiveTenant && 'tenant_id' in pending && pending.tenant_id !== undefined) {
    const pendingTenant = (String(pending.tenant_id ?? '').trim()) || 'default';
    if (pendingTenant !== effectiveTenant) {
      return { success: false, reason: 'no_pending_referral' };
    }
  }
  if (pending && pending.bonus_type === 'points') {
    return { success: false, reason: 'already_processed_points' };
  }

  const referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string; tenant_id?: string | null }>();
  if (!referrer) {
    return { success: false, reason: pending ? 'referrer_not_found' : 'no_pending_referral' };
  }
  try {
    const referrerWithTenant = referrer.tenant_id !== undefined
      ? referrer
      : await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string; tenant_id?: string | null }>();
    if (!pending && !effectiveTenant && !referrerWithTenant) {
      return { success: false, reason: 'no_pending_referral' };
    }
    if (referrerWithTenant && referrerWithTenant.tenant_id !== undefined) {
      const refTenant = (referrerWithTenant.tenant_id && referrerWithTenant.tenant_id.trim()) || 'default';
      if (effectiveTenant && refTenant !== effectiveTenant) {
        return { success: false, reason: 'referrer_not_found' };
      }
      const referee = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(newCustomerId).first<{ id: string; tenant_id?: string | null }>();
      if (referee && referee.tenant_id !== undefined) {
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
  const refId = pending?.id || genId('ref_');
  const stampTenant = effectiveTenant || 'default';

  if (pending) {
    let updatedExisting = false;
    try {
      const updRes = effectiveTenant && 'tenant_id' in pending && pending.tenant_id !== undefined
        ? await db.prepare(
            `UPDATE referrals
             SET referrer_id = ?, referral_code = ?, cashback_awarded_vnd = ?, bonus_type = 'cashback'
             WHERE id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          ).bind(referrer.id, normalized, REFERRER_CASHBACK_VND, pending.id, effectiveTenant).run()
        : await db.prepare(
            `UPDATE referrals
             SET referrer_id = ?, referral_code = ?, cashback_awarded_vnd = ?, bonus_type = 'cashback'
             WHERE id = ? AND status = 'pending'`
          ).bind(referrer.id, normalized, REFERRER_CASHBACK_VND, pending.id).run();
      const changes = (updRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
        ?? (updRes as unknown as { changes?: number })?.changes
        ?? 1;
      updatedExisting = changes > 0;
    } catch {
      updatedExisting = false;
    }
    if (!updatedExisting) {
      try {
        await db.prepare(
          `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, tenant_id, created_at)
           VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?)`
        ).bind(genId('ref_'), referrer.id, newCustomerId, normalized, REFERRER_CASHBACK_VND, 'cashback', stampTenant, now).run();
      } catch {
        // Ignore if row already exists
      }
    }
  } else {
    try {
      await db.prepare(
        `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, tenant_id, created_at)
         VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?)`
      ).bind(refId, referrer.id, newCustomerId, normalized, REFERRER_CASHBACK_VND, 'cashback', stampTenant, now).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, created_at)
           VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
        ).bind(refId, referrer.id, newCustomerId, normalized, REFERRER_CASHBACK_VND, 'cashback', now).run();
      } catch {
        await db.prepare(
          `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, status, created_at)
           VALUES (?, ?, ?, ?, 0, 'pending', ?)`
        ).bind(refId, referrer.id, newCustomerId, normalized, now).run();
      }
    }
  }

  if (effectiveTenant || typeof rc.max_uses === 'number') {
    try {
      const usageRes = effectiveTenant
        ? await db.prepare(
            "UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ? AND (max_uses IS NULL OR max_uses <= 0 OR COALESCE(times_used, 0) < max_uses) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(rc.id, effectiveTenant).run()
        : await db.prepare(
            'UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ? AND (max_uses IS NULL OR max_uses <= 0 OR COALESCE(times_used, 0) < max_uses)'
          ).bind(rc.id).run();
      const usageChanges = (usageRes as unknown as { meta?: { changes?: number }; changes?: number })?.meta?.changes
        ?? (usageRes as unknown as { changes?: number })?.changes
        ?? 1;
      if (usageChanges === 0) {
        if (!pending) {
          await db.prepare('DELETE FROM referrals WHERE id = ?').bind(refId).run().catch(() => {});
        }
        return { success: false, reason: 'code_exhausted' };
      }
    } catch {
      await db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?').bind(rc.id).run();
    }
  } else {
    await db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?').bind(rc.id).run();
  }
  return { success: true, referrer_cashback_pending: REFERRER_CASHBACK_VND };
}
