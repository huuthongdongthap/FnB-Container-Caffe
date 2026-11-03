import type { D1Database } from '@cloudflare/workers-types';
import type { Referral, Customer } from '../../types/models';

function genId(prefix: string): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + rand;
}

export async function processReferralOnFirstOrder(db: D1Database, customerId: string, tenantId?: string): Promise<Record<string, unknown>> {
  const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : null;
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
  }
  if (!pending) {
    return { success: false, reason: 'no_pending_referral' };
  }

  let referrer: (Customer & { tenant_id?: string | null }) | null = null;
  if (effectiveTenant) {
    try {
      referrer = await db.prepare(
        "SELECT id, loyalty_points, lifetime_points, loyalty_tier, tenant_id FROM customers WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(pending.referrer_id, effectiveTenant).first<Customer & { tenant_id?: string | null }>();
    } catch {
      referrer = await db.prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?').bind(pending.referrer_id).first<Customer & { tenant_id?: string | null }>();
    }
    if (referrer && 'tenant_id' in referrer && referrer.tenant_id !== undefined) {
      const refTenant = (referrer.tenant_id && String(referrer.tenant_id).trim()) || 'default';
      if (refTenant !== effectiveTenant) {
        referrer = null;
      }
    }
  } else {
    referrer = await db.prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?').bind(pending.referrer_id).first<Customer>();
  }
  if (!referrer) {
    return { success: false, reason: 'referrer_not_found' };
  }

  const POINTS = pending.points_awarded || 100;
  const now = new Date().toISOString();
  const newPoints = (referrer.loyalty_points || 0) + POINTS;
  const newLifetimePoints = (referrer.lifetime_points || 0) + POINTS;

  let claimRes: unknown;
  try {
    claimRes = effectiveTenant
      ? await db
          .prepare("UPDATE referrals SET status = ?, bonus_type = ? WHERE id = ? AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind('completed', 'points', pending.id, effectiveTenant)
          .run()
      : await db.prepare("UPDATE referrals SET status = ?, bonus_type = ? WHERE id = ? AND status = 'pending'").bind('completed', 'points', pending.id).run();
  } catch {
    try {
      claimRes = await db.prepare("UPDATE referrals SET status = ?, bonus_type = ? WHERE id = ? AND status = 'pending'").bind('completed', 'points', pending.id).run();
    } catch {
      claimRes = await db.prepare("UPDATE referrals SET status = ? WHERE id = ? AND status = 'pending'").bind('completed', pending.id).run();
    }
  }
  const claimChanges = (claimRes as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 1;
  if (claimChanges === 0) {
    return { success: false, reason: 'no_pending_referral' };
  }

  if (effectiveTenant) {
    try {
      await db.prepare(
        "UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(POINTS, POINTS, now, referrer.id, effectiveTenant).run();
    } catch {
      await db.prepare('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE id = ?').bind(POINTS, POINTS, now, referrer.id).run();
    }
  } else {
    await db.prepare('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE id = ?').bind(POINTS, POINTS, now, referrer.id).run();
  }
  const ptLogId = pending.id ? `ptl_ref_${pending.id}` : genId('ptl_');
  const stampTenant = effectiveTenant || 'default';
  try {
    await db.prepare(
      'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(ptLogId, referrer.id, POINTS, 'referral', newPoints, `Gi?i thi?u b?n: +${POINTS} di?m (legacy)`, stampTenant, now).run();
  } catch {
    await db.prepare(
      'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(ptLogId, referrer.id, POINTS, 'referral', newPoints, `Gi?i thi?u b?n: +${POINTS} di?m (legacy)`, now).run();
  }

  await db.prepare('UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?').bind(POINTS, pending.referral_code).run();

  if (effectiveTenant || (claimRes as { meta?: unknown } | undefined)?.meta !== undefined) {
    try {
      await db
        .prepare(
          'UPDATE loyalty_accounts SET current_points = COALESCE(current_points, 0) + ?, lifetime_points = COALESCE(lifetime_points, 0) + ?, updated_at = ? WHERE customer_id = ?'
        )
        .bind(POINTS, POINTS, now, referrer.id)
        .run();
    } catch {
      // loyalty_accounts table is optional in minimal schemas
    }
  }

  return { success: true, points_awarded: POINTS, new_balance: newPoints, new_lifetime_balance: newLifetimePoints };
}
