import type { D1Database } from '@cloudflare/workers-types';
import type { Referral, Customer } from '../../types/models';

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function processReferralOnFirstOrder(db: D1Database, customerId: string): Promise<Record<string, unknown>> {
  const pending = await db.prepare('SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(customerId, 'pending').first<Referral>();
  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }

  const referrer = await db.prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?').bind(pending.referrer_id).first<Customer>();
  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const POINTS = pending.points_awarded || 100;
  const now = new Date().toISOString();
  const newPoints = (referrer.loyalty_points || 0) + POINTS;
  const newLifetimePoints = (referrer.lifetime_points || 0) + POINTS;

  await db.prepare('UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?').bind(newPoints, newLifetimePoints, now, referrer.id).run();
  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('ptl_'), referrer.id, POINTS, 'referral', newPoints, 'Gi?i thi?u b?n: +' + POINTS + ' di?m (legacy)', now).run();

  await db.prepare('UPDATE referrals SET status = ?, bonus_type = ? WHERE id = ?').bind('completed', 'points', pending.id).run();
  await db.prepare('UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?').bind(POINTS, pending.referral_code).run();

  return { success: true, points_awarded: POINTS, new_balance: newPoints, new_lifetime_balance: newLifetimePoints };
}
