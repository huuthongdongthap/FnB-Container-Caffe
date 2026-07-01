// processOrderLoyalty — extracted from routes/loyalty.ts

import { createLogger } from '../../middleware/logger';
import { genId, nowSqlTimestamp } from './helpers';
import { getActiveCampaign, calcExpiresAt } from './campaign';
import type { Customer, CashbackWallet, LoyaltyTier, BonusCampaign } from '../../types/models';

const log = createLogger({ route: 'loyalty' });

const MIN_ORDER_TO_EARN = 20000;
const DEFAULT_MAX_CASHBACK_PER_TX = 50000;
const DEFAULT_TIER = 'bronze';

export async function processOrderLoyalty(orderId: string, env: Record<string, unknown>) {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<Record<string, unknown>>();
  if (!order) { return { ok: false, reason: 'order_not_found' }; }

  if (!order.customer_phone) {
    log.info('Order skip loyalty (no phone)', { order_id: orderId });
    return { ok: false, reason: 'no_customer' };
  }

  const existingEarn = await db.prepare(
    'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1'
  ).bind(orderId).first<{ id: string }>();
  if (existingEarn) {
    return { ok: false, reason: 'already_processed', existing_id: existingEarn.id };
  }

  const total = (order.total_amount || order.total || 0) as number;
  if (total < MIN_ORDER_TO_EARN) {
    return { ok: false, reason: 'below_min_order', min: MIN_ORDER_TO_EARN };
  }

  const customer = await db.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
  ).bind(order.customer_phone).first<Customer>();
  if (!customer) { return { ok: false, reason: 'customer_not_found' }; }

  const tier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?')
    .bind(customer.loyalty_tier || DEFAULT_TIER).first<LoyaltyTier>();
  if (!tier) { return { ok: false, reason: 'tier_not_found' }; }

  const now = nowSqlTimestamp();
  const campaign = await getActiveCampaign(db);

  const multiplier = campaign?.cashback_multiplier ?? 1.0;
  const maxCap = (campaign as BonusCampaign)?.max_cap_per_customer_vnd ?? DEFAULT_MAX_CASHBACK_PER_TX;

  const cbUsed = (order.cashback_used || 0) as number;
  const baseRate = tier.cashback_rate;
  const rawCashback = Math.round((total - cbUsed) * baseRate * multiplier);
  const cashback = Math.min(rawCashback, maxCap);

  const points = Math.floor(total / 10000 * (tier.point_multiplier || 1));

  const expiresAt = calcExpiresAt(tier);

  let wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(customer.id).first<CashbackWallet>();
  if (!wallet) {
    const wid = genId('wal_');
    await db.prepare(
      'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
    ).bind(wid, customer.id, now, now).run();
    wallet = { id: wid, customer_id: customer.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = (wallet.balance || 0) + cashback;
  const newPoints = (customer.loyalty_points || 0) + points;
  const newLifetimePoints = (customer.lifetime_points || 0) + points;

  try {
    await db.batch([
      db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE customer_id = ?').bind(newBalance, cashback, now, customer.id),
      db.prepare('INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, multiplier_applied, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(genId('cbt_'), wallet.id, customer.id, orderId, 'earn', cashback, newBalance, expiresAt, multiplier, campaign?.id || null, 'Cashback d?n #' + orderId.slice(0, 8) + (multiplier > 1 ? ' (x' + multiplier + ')' : ''), now),
      db.prepare('UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?').bind(newPoints, newLifetimePoints, now, customer.id),
      db.prepare('INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(genId('ptl_'), customer.id, orderId, points, 'purchase', newPoints, 'Tich di?m d?n #' + orderId.slice(0, 8), now),
      db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(customer.id, 'cashback_earn', cashback, orderId, JSON.stringify({ tier: tier.tier_name, base_rate: tier.cashback_rate, multiplier, campaign: campaign?.code || null, raw_cashback: rawCashback, capped: cashback < rawCashback, cap_used: maxCap }), now),
      db.prepare('UPDATE orders SET cashback_earned = ?, points_earned = ? WHERE id = ?').bind(cashback, points, orderId),
    ]);
  } catch (err) {
    const errMsg = (err as Error).message || '';
    if (errMsg.includes('UNIQUE') || errMsg.includes('constraint')) {
      log.info('processOrderLoyalty: UNIQUE constraint, idempotent skip', { order_id: orderId });
      return { ok: false, reason: 'already_processed' };
    }
    log.error('processOrderLoyalty batch error:', { message: errMsg });
    throw err;
  }

  try {
    const { processReferralOnFirstOrder } = await import('../../routes/referrals');
    await processReferralOnFirstOrder(db, customer.id);
  } catch (refErr) {
    log.error('Error processing referral on first order:', { message: (refErr as Error).message });
  }

  let tierUpgraded = false;
  let newTierName = customer.loyalty_tier;

  const nextTier = await db.prepare('SELECT tier_name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1').bind(newLifetimePoints).first<{ tier_name: string }>();
  if (nextTier && nextTier.tier_name !== customer.loyalty_tier) {
    newTierName = nextTier.tier_name;
    tierUpgraded = true;
    await db.prepare('UPDATE customers SET loyalty_tier = ?, updated_at = ? WHERE id = ?').bind(newTierName, now, customer.id).run();
    await db.batch([
      db.prepare('INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(genId('ptl_'), customer.id, 0, 'tier_upgrade', newPoints, 'Nang hang len ' + newTierName, now),
      db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(customer.id, 'tier_upgrade', null, orderId, JSON.stringify({ from: customer.loyalty_tier, to: newTierName, reason: 'points_threshold', points: newPoints, lifetime_points: newLifetimePoints }), now),
    ]);
  }

  const { notifyMember } = await import('../../routes/zalo.js');
  notifyMember(env as Record<string, unknown>, {
    customer_id: customer.id,
    template_key: 'cashback_earned',
    data: { amount: cashback, balance: newBalance, order_id: orderId },
  }).catch(() => {});

  if (tierUpgraded) {
    const upgradedTier = await db.prepare('SELECT * FROM loyalty_tiers WHERE tier_name = ?').bind(newTierName).first<Record<string, unknown>>().catch(() => null);
    const tierData = upgradedTier || {};
    notifyMember(env as Record<string, unknown>, {
      customer_id: customer.id,
      template_key: 'tier_upgrade',
      data: {
        new_tier_vi: (tierData.display_name_vi as string | undefined) || newTierName,
        new_rate: (tierData.cashback_rate as number | undefined) || 0,
      },
    }).catch(() => {});

    (async () => {
      try {
        const mapping = await db.prepare('SELECT erpnext_id FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1').bind('customer', customer.id).first<{ erpnext_id: string }>();
        if (!mapping) { return; }
        const consent = await db.prepare('SELECT consent_erpnext_sync FROM customers WHERE id = ? AND consent_erpnext_sync = 1 LIMIT 1').bind(customer.id).first<{ consent_erpnext_sync: number }>();
        if (!consent) { return; }
        const { createErpnextCrmClient } = await import('../../clients/erpnext-crm-client.js');
        const crm = createErpnextCrmClient(env);
        if (!crm) { return; }
        const TIER_TAGS: Record<string, string> = { bronze: 'Loyalty_Bronze', silver: 'Loyalty_Silver', gold: 'Loyalty_Gold', platinum: 'Loyalty_Platinum' };
        const oldTag = TIER_TAGS[customer.loyalty_tier];
        const newTag = TIER_TAGS[newTierName];
        if (oldTag && oldTag !== newTag) { await crm.removeTag(mapping.erpnext_id, oldTag); }
        if (newTag) { await crm.addTag(mapping.erpnext_id, newTag); }
      } catch (e) {
        log.error('ERPNext tier-tag sync:', { message: (e as Error).message });
      }
    })();
  }

  return {
    cashback, points, wallet_balance: newBalance, total_points: newPoints,
    lifetime_points: newLifetimePoints, tier: newTierName, tier_upgraded: tierUpgraded,
    multiplier_applied: multiplier, campaign_code: campaign?.code || null, expires_at: expiresAt,
  };
}
