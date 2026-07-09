/**
 * Lookup Handler - GET /api/loyalty/lookup
 * POS lookup customer by phone with wallet balance, tier progress, expiring cashback.
 */
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { Customer, CashbackWallet } from '../../types/models';

const DEFAULT_TIER = 'bronze';
const TIER_VI_MAP: Record<string, string> = { bronze: 'DGng', silver: 'B?c', gold: 'VAng', platinum: 'B?ch Kim' };

export async function handleLookup(c: Context<{ Bindings: Env }>) {
  const phone = (c.req.query('phone') || '').trim();
  if (!phone) {
    return c.json({ ok: false, error: 'Thi?u s? di?n tho?i' }, 400);
  }

  const db = c.env.AURA_DB;
  const customer = await db.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
  ).bind(phone).first<Customer>();
  if (!customer) {
    return c.json({ ok: false, error: 'Không tìm thấy thành viên' }, 200);
  }

  const wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(customer.id).first<CashbackWallet>();
  const balance = wallet?.balance || 0;

  const lifetimeRow = await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\')'
  ).bind(customer.id).first<{ total: number }>();

  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
  const expiringRow = await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
  ).bind(customer.id, sevenDays).first<{ total: number; cnt: number }>();

  const nextTierRow = await db.prepare(
    'SELECT * FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1'
  ).bind(customer.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();

  let tierProgress: Record<string, unknown> | null = null;
  if (nextTierRow && customer.lifetime_points !== undefined) {
    const pts = customer.lifetime_points || 0;
    const needed = nextTierRow.min_points - pts;
    const prevTier = await db.prepare(
      'SELECT min_points FROM loyalty_tiers WHERE min_points < ? ORDER BY min_points DESC LIMIT 1'
    ).bind(nextTierRow.min_points).first<{ min_points: number }>();
    const range = nextTierRow.min_points - (prevTier?.min_points || 0);
    const filled = pts - (prevTier?.min_points || 0);
    tierProgress = {
      next_tier: nextTierRow.tier_name,
      next_tier_vi: TIER_VI_MAP[nextTierRow.tier_name] || nextTierRow.tier_name,
      to_next: needed,
      percent: Math.max(0, Math.min(100, range > 0 ? (filled / range) * 100 : 100))
    };
  }

  return c.json({
    ok: true,
    member: {
      id: customer.id,
      member_id: `AC${String(customer.id).slice(-6).toUpperCase()}`,
      name: customer.name,
      phone: customer.phone,
      tier: customer.loyalty_tier || DEFAULT_TIER,
      loyalty_tier: customer.loyalty_tier || DEFAULT_TIER,
      loyalty_points: customer.loyalty_points || 0,
      lifetime_points: customer.lifetime_points || 0,
      tier_vi: TIER_VI_MAP[customer.loyalty_tier] || TIER_VI_MAP.bronze,
      balance,
      cashback_balance: balance,
      cashback_balance_vnd: balance,
      lifetime_cashback: lifetimeRow?.total || 0,
      expiring_amount: expiringRow?.total || 0,
      expiring_within_7d: expiringRow?.cnt || 0,
      tier_progress: tierProgress,
      member_since: customer.created_at
    }
  });
}
