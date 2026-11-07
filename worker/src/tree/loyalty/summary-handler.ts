/**
 * Summary Handler - GET /api/loyalty/summary
 * Customer loyalty dashboard data: tier, wallet, next tier, expiring cashback.
 */
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { Customer, CashbackWallet, LoyaltyTier } from '../../types/models';
import { resolvePilotStore } from '../../lib/pilot-store';
import { genId } from './helpers';

const DEFAULT_TIER = 'bronze';

export async function handleSummary(c: Context<{ Bindings: Env }>) {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  const custAny = cust as unknown as { tenant_id?: string | null; tenantId?: string | null };
  const custTenant = (custAny.tenant_id && String(custAny.tenant_id).trim())
    || (custAny.tenantId && String(custAny.tenantId).trim())
    || '';
  let tenantId = custTenant || 'default';
  if (c.env?.PILOT_TENANT_ID) {
    try {
      tenantId = resolvePilotStore(c.env as unknown as Record<string, unknown>);
    } catch {
      // keep custTenant || 'default'
    }
  }
  const queryTenant = (
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    ''
  ).trim();
  const headerTenant = (
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (queryTenant && headerTenant && queryTenant !== headerTenant) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const requestedTenant = queryTenant || headerTenant;
  if (
    custTenant === '*' ||
    custTenant.toLowerCase() === 'hq' ||
    (requestedTenant && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== tenantId)) ||
    (custTenant && custTenant !== tenantId)
  ) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  let tier: LoyaltyTier | null = null;
  try {
    tier = await db.prepare("SELECT * FROM loyalty_tiers WHERE tier_name = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(cust.loyalty_tier || DEFAULT_TIER, tenantId).first<LoyaltyTier>();
    if (!tier && tenantId !== 'default') {
      tier = await db.prepare("SELECT * FROM loyalty_tiers WHERE tier_name = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'")
        .bind(cust.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();
    }
  } catch {
    try {
      tier = await db.prepare("SELECT tier AS tier_name, min_points, cashback_rate, points_multiplier, perks FROM tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(cust.loyalty_tier || DEFAULT_TIER, tenantId).first<LoyaltyTier>();
      if (!tier && tenantId !== 'default') {
        tier = await db.prepare("SELECT tier AS tier_name, min_points, cashback_rate, points_multiplier, perks FROM tier_configs WHERE tier = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'")
          .bind(cust.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();
      }
    } catch {
      if (tenantId === 'default') {
        try {
          tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
            .bind(cust.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();
        } catch {
          try {
            tier = await db.prepare('SELECT tier AS tier_name, min_points, cashback_rate, points_multiplier, perks FROM tier_configs WHERE tier = ?')
              .bind(cust.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();
          } catch {
            tier = null;
          }
        }
      }
    }
  }

  let wallet: (CashbackWallet & { tenant_id?: string | null }) | null = null;
  try {
    wallet = await db.prepare("SELECT * FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
      .bind(cust.id, tenantId).first<CashbackWallet & { tenant_id?: string | null }>();
  } catch {
    if (tenantId === 'default') {
      wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?')
        .bind(cust.id).first<CashbackWallet & { tenant_id?: string | null }>();
      if (wallet && 'tenant_id' in wallet && wallet.tenant_id !== undefined) {
        const walletTenant = (wallet.tenant_id && String(wallet.tenant_id).trim()) || 'default';
        if (walletTenant !== tenantId) {
          wallet = null;
        }
      }
    }
  }

  if (!wallet) {
    const wid = genId('wal_');
    const now = new Date().toISOString();
    try {
      await db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?, ?)').bind(wid, cust.id, tenantId, now, now).run();
    } catch (insertWalErr) {
      if (tenantId !== 'default') {
        throw insertWalErr;
      }
      await db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)').bind(wid, cust.id, now, now).run();
    }
    wallet = { id: wid, customer_id: cust.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  let nextTier: { tier_name: string; min_points: number } | null = null;
  try {
    nextTier = await db.prepare("SELECT tier_name, min_points FROM loyalty_tiers WHERE min_points > ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY min_points ASC LIMIT 1")
      .bind(cust.lifetime_points || 0, tenantId).first<{ tier_name: string; min_points: number }>();
    if (!nextTier && tenantId !== 'default') {
      nextTier = await db.prepare("SELECT tier_name, min_points FROM loyalty_tiers WHERE min_points > ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default' ORDER BY min_points ASC LIMIT 1")
        .bind(cust.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();
    }
  } catch {
    try {
      nextTier = await db.prepare("SELECT tier AS tier_name, min_points FROM tier_configs WHERE min_points > ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY min_points ASC LIMIT 1")
        .bind(cust.lifetime_points || 0, tenantId).first<{ tier_name: string; min_points: number }>();
      if (!nextTier && tenantId !== 'default') {
        nextTier = await db.prepare("SELECT tier AS tier_name, min_points FROM tier_configs WHERE min_points > ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default' ORDER BY min_points ASC LIMIT 1")
          .bind(cust.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();
      }
    } catch {
      if (tenantId === 'default') {
        try {
          nextTier = await db.prepare('SELECT tier_name, min_points FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1')
            .bind(cust.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();
        } catch {
          try {
            nextTier = await db.prepare('SELECT tier AS tier_name, min_points FROM tier_configs WHERE min_points > ? ORDER BY min_points ASC LIMIT 1')
              .bind(cust.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();
          } catch {
            nextTier = null;
          }
        }
      }
    }
  }

  let activeRewards: { cnt: number }[] = [];
  try {
    const res = await db.prepare(
      "SELECT COUNT(*) as cnt FROM user_rewards WHERE customer_id = ? AND status IN ('active', 'pending') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(cust.id, tenantId).all<{ cnt: number }>();
    activeRewards = res.results || [];
  } catch {
    try {
      const res = await db.prepare(
        "SELECT COUNT(*) as cnt FROM loyalty_redemptions WHERE customer_id = ? AND status IN ('active', 'pending') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(cust.id, tenantId).all<{ cnt: number }>();
      activeRewards = res.results || [];
    } catch {
      if (tenantId === 'default') {
        try {
          const res = await db.prepare(
            "SELECT COUNT(*) as cnt FROM user_rewards WHERE customer_id = ? AND status IN ('active', 'pending')"
          ).bind(cust.id).all<{ cnt: number }>();
          activeRewards = res.results || [];
        } catch {
          try {
            const res = await db.prepare(
              "SELECT COUNT(*) as cnt FROM loyalty_redemptions WHERE customer_id = ? AND status IN ('active', 'pending')"
            ).bind(cust.id).all<{ cnt: number }>();
            activeRewards = res.results || [];
          } catch {
            activeRewards = [];
          }
        }
      } else {
        activeRewards = [];
      }
    }
  }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
  let expiring: { total: number } | null = null;
  try {
    expiring = await db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE wallet_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
    ).bind(wallet.id, sevenDaysFromNow).first<{ total: number }>();
  } catch {
    if (tenantId === 'default') {
      expiring = await db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
      ).bind(cust.id, sevenDaysFromNow).first<{ total: number }>();
    }
  }

  const custMeta = cust as unknown as { verified_at?: string | null; phone_verified?: boolean };
  const phoneVerified = Boolean(custMeta.verified_at || custMeta.phone_verified !== false);

  return c.json({
    success: true,
    data: {
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      phone_verified: phoneVerified,
      assurance_level: phoneVerified ? 'verified' : 'unverified_phone',
      tier: cust.loyalty_tier || DEFAULT_TIER,
      total_points: cust.loyalty_points || 0,
      lifetime_points: cust.lifetime_points || 0,
      tier_config: tier,
      wallet: {
        balance: wallet.balance,
        total_earned: wallet.total_earned,
        total_spent: wallet.total_spent,
        expiring_within_7d: expiring?.total || 0
      },
      next_tier: nextTier || null,
      active_rewards: activeRewards[0]?.cnt || 0,
      member_since: cust.created_at
    }
  });
}
