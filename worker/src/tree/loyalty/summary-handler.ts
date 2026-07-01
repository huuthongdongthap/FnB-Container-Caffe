/**
 * Summary Handler - GET /api/loyalty/summary
 * Customer loyalty dashboard data: tier, wallet, next tier, expiring cashback.
 */
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { Customer, CashbackWallet, LoyaltyTier } from '../../types/models';
import { genId } from './helpers';

const DEFAULT_TIER = 'bronze';

export async function handleSummary(c: Context<{ Bindings: Env }>) {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  const tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
    .bind(cust.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();

  let wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?')
    .bind(cust.id).first<CashbackWallet>();

  if (!wallet) {
    const wid = genId('wal_');
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)').bind(wid, cust.id, now, now).run();
    wallet = { id: wid, customer_id: cust.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const nextTier = await db.prepare('SELECT tier_name, min_points FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1')
    .bind(cust.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();

  const { results: activeRewards } = await db.prepare(
    'SELECT COUNT(*) as cnt FROM user_rewards WHERE customer_id = ? AND status = \'active\''
  ).bind(cust.id).all<{ cnt: number }>();

  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  const expiring = await db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE wallet_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
  ).bind(wallet.id, sevenDaysFromNow).first<{ total: number }>();

  return c.json({
    success: true,
    data: {
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      tier: cust.loyalty_tier || DEFAULT_TIER,
      total_points: cust.loyalty_points || 0,
      lifetime_points: cust.lifetime_points || 0,
      tier_config: tier,
      wallet: {
        balance: wallet.balance,
        total_earned: wallet.total_earned,
        total_spent: wallet.total_spent,
        expiring_within_7d: expiring?.total || 0,
      },
      next_tier: nextTier || null,
      active_rewards: activeRewards[0]?.cnt || 0,
      member_since: cust.created_at,
    },
  });
}
