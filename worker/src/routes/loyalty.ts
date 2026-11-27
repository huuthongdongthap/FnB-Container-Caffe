/**
 * Loyalty Routes — /api/loyalty
 * Thin Hono router — handler bodies extracted to tree/loyalty/.
 */

import { Hono, type Context } from 'hono';
import { getAuthToken, verifyJWT } from '../lib/jwt';
import { isStaffRole } from '../lib/staff-session';
import { redeemRewardSchema, zodErrorResponse } from '../lib/validators';
import { resolvePilotStore } from '../lib/pilot-store';
import { getTenantId, matchesTenantRow, resolvePublicTenantId } from '../middleware/tenant';
import type { Env } from '../types/env';
import type { Customer } from '../types/models';

import { redeemRewardAtomically } from './openapi-loyalty-handlers/atomic-reward-redemption';
import { getActiveCampaign } from '../tree/loyalty/campaign';
import { authCustomer } from '../tree/loyalty/auth-middleware';
import { handlePhoneAuth } from '../tree/loyalty/phone-auth-handler';
import { handlePhoneOtpRequest } from '../tree/loyalty/phone-otp-handler';
import { handleSummary } from '../tree/loyalty/summary-handler';
import { handleSpendCashback } from '../tree/loyalty/spend-cashback-handler';
import { handleLookup } from '../tree/loyalty/lookup-handler';
import { rateLimitMiddleware, LOYALTY_REDEEM_RATE_LIMIT, CASHBACK_SPEND_RATE_LIMIT } from '../middleware/rate-limit';

export const loyaltyRouter = new Hono<{ Bindings: Env }>();

const LEGACY_LOYALTY_PATHS = new Set([
  '/active-campaign',
  '/phone-auth',
  '/phone-otp/request',
  '/summary',
  '/spend-cashback',
  '/lookup',
  '/points',
  '/cashback',
  '/redeem',
  '/my-rewards',
  '/tiers',
]);

async function shouldDelegateRewardsListToOpenApi(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const token = getAuthToken(c.req.raw);
  if (!token || !c.env.JWT_SECRET || c.env.JWT_SECRET.length < 16) {
    return false;
  }
  const hasJwtClaimsConfig = c.env.JWT_AUDIENCE !== undefined || c.env.JWT_ISSUER !== undefined;
  const payload = hasJwtClaimsConfig
    ? await verifyJWT(token, c.env.JWT_SECRET, {
        expectedAudience: c.env.JWT_AUDIENCE,
        expectedIssuer: c.env.JWT_ISSUER,
      })
    : await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return false;
  }
  const rawClaims = payload as unknown as { sessionType?: string };
  return (
    isStaffRole(payload.role) ||
    Boolean(rawClaims.sessionType) ||
    Boolean(payload.role && payload.role !== 'customer')
  );
}

loyaltyRouter.use('/*', async (c, next) => {
  const pathSegments = c.req.path.split('/').filter(Boolean);
  const relPath = pathSegments[0] === 'api' && pathSegments[1] === 'loyalty'
    ? `/${pathSegments.slice(2).join('/')}`
    : `/${pathSegments.join('/')}`;
  if (relPath === '/rewards' && c.req.method === 'GET') {
    const hasAdminPaging =
      c.req.query('limit') !== undefined ||
      c.req.query('page') !== undefined ||
      c.req.query('includeInactive') !== undefined;
    const hasAnyToken = Boolean(c.req.header('Authorization') || (c.req.raw && getAuthToken(c.req.raw)));
    if ((await shouldDelegateRewardsListToOpenApi(c)) || (!hasAnyToken && hasAdminPaging)) {
      await next();
      return;
    }
    return authCustomer(c, next);
  }
  if (!LEGACY_LOYALTY_PATHS.has(relPath)) {
    await next();
    return;
  }
  return authCustomer(c, next);
});

loyaltyRouter.get('/active-campaign', async(c) => {
  const reqCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(reqCandidates).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const headerTenant = reqCandidates[0] || '';
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (headerTenant && headerTenant !== '*' && headerTenant.toLowerCase() !== 'hq' ? headerTenant : 'default');
  const campaign = await getActiveCampaign(c.env.AURA_DB, storeTenant);
  if (!campaign) {
    return c.json({ success: true, campaign: null });
  }
  let slotsLeft: number | null = null;
  if (campaign.signup_bonus_cap) {
    const granted = await c.env.AURA_DB.prepare(
      'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
    ).bind(campaign.id).first<{ count: number }>();
    slotsLeft = Math.max(0, campaign.signup_bonus_cap - (granted?.count || 0));
  }
  return c.json({
    success: true,
    campaign: {
      code: campaign.code,
      name: campaign.name,
      description: campaign.description,
      cashback_multiplier: campaign.cashback_multiplier,
      signup_bonus_vnd: campaign.signup_bonus_vnd,
      signup_bonus_cap: campaign.signup_bonus_cap,
      signup_slots_left: slotsLeft,
      refer_bonus_vnd: campaign.refer_bonus_vnd,
      start_date: campaign.start_date,
      end_date: campaign.end_date
    }
  });
});

loyaltyRouter.post('/phone-auth', handlePhoneAuth);
loyaltyRouter.post('/phone-otp/request', handlePhoneOtpRequest);
loyaltyRouter.get('/summary', handleSummary);
loyaltyRouter.post('/spend-cashback', rateLimitMiddleware(CASHBACK_SPEND_RATE_LIMIT), handleSpendCashback);
loyaltyRouter.get('/lookup', handleLookup);

loyaltyRouter.get('/points', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' && rawCustTenant.toLowerCase() !== 'hq' ? rawCustTenant : 'default');
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') || '20', 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(c.req.query('offset') || '0', 10) || 0, 0);

  const matchesPointRow = (row: unknown): boolean => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as Record<string, unknown>;
    if ('tenant_id' in rec && rec.tenant_id !== undefined) {
      const rowTenant = String(rec.tenant_id ?? '').trim() || 'default';
      return rowTenant === storeTenant;
    }
    return true;
  };

  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      "SELECT id, points_change, reason, balance_after, description, created_at, tenant_id FROM loyalty_point_logs WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(cust.id, storeTenant, limit, offset).all();
    results = (res.results || []).filter(matchesPointRow);
  } catch {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT id, points_change, reason, balance_after, description, created_at, tenant_id FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(cust.id, limit, offset).all();
      results = (res.results || []).filter(matchesPointRow);
    } catch {
      try {
        const res = await c.env.AURA_DB.prepare(
          'SELECT id, points_change, reason, balance_after, description, created_at FROM loyalty_point_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).bind(cust.id, limit, offset).all();
        results = (res.results || []).filter(matchesPointRow);
      } catch {
        results = [];
      }
    }
  }
  if (results.length === 0) {
    try {
      const res = await c.env.AURA_DB.prepare(
        "SELECT id, customer_id, points AS points_change, type AS reason, balance_after, description, created_at, tenant_id FROM loyalty_transactions WHERE (customer_id = ? OR account_id = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(cust.id, `la_${cust.id}`, storeTenant, limit, offset).all();
      results = (res.results || []).filter(matchesPointRow);
    } catch {
      try {
        const res = await c.env.AURA_DB.prepare(
          'SELECT id, customer_id, points AS points_change, type AS reason, balance_after, description, created_at, tenant_id FROM loyalty_transactions WHERE customer_id = ? OR account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).bind(cust.id, `la_${cust.id}`, limit, offset).all();
        results = (res.results || []).filter(matchesPointRow);
      } catch {
        try {
          const res = await c.env.AURA_DB.prepare(
            'SELECT id, customer_id, points AS points_change, type AS reason, balance_after, description, created_at FROM loyalty_transactions WHERE customer_id = ? OR account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
          ).bind(cust.id, `la_${cust.id}`, limit, offset).all();
          results = (res.results || []).filter(matchesPointRow);
        } catch {
          const res = await c.env.AURA_DB.prepare(
            'SELECT id, customer_id, points AS points_change, type AS reason, description, created_at FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
          ).bind(cust.id, limit, offset).all().catch(() => ({ results: [] }));
          results = (res.results || []).filter(matchesPointRow);
        }
      }
    }
  }

  const scopedResults = results.filter(matchesPointRow);

  return c.json({ success: true, data: scopedResults });
});

loyaltyRouter.get('/cashback', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' && rawCustTenant.toLowerCase() !== 'hq' ? rawCustTenant : 'default');
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') || '20', 10) || 20, 1), 100);
  const offset = Math.max(Number.parseInt(c.req.query('offset') || '0', 10) || 0, 0);
  const type = c.req.query('type');

  let wallet: { id: string; tenant_id?: string | null } | null = null;
  try {
    wallet = await c.env.AURA_DB.prepare(
      "SELECT id FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    )
      .bind(cust.id, storeTenant).first<{ id: string; tenant_id?: string | null }>();
  } catch {
    const fallbackWallet = await c.env.AURA_DB.prepare('SELECT id FROM cashback_wallets WHERE customer_id = ?')
      .bind(cust.id).first<{ id: string; tenant_id?: string | null }>();
    wallet = fallbackWallet && matchesTenantRow(fallbackWallet as unknown as Record<string, unknown>, storeTenant)
      ? fallbackWallet
      : null;
  }
  if (wallet && 'tenant_id' in wallet && wallet.tenant_id !== undefined && !matchesTenantRow(wallet as unknown as Record<string, unknown>, storeTenant)) {
    wallet = null;
  }

  if (!wallet) {
    return c.json({ success: true, data: [] });
  }

  const buildCashbackSql = (cols: string, whereCol: 'wallet_id' | 'customer_id', bindId: string): [string, unknown[]] => {
    let sql = `SELECT ${cols} FROM cashback_transactions WHERE ${whereCol} = ?`;
    const sqlParams: unknown[] = [bindId];
    if (type) {
      sql += ' AND type = ?';
      sqlParams.push(type);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    sqlParams.push(limit, offset);
    return [sql, sqlParams];
  };

  const filterCashbackRow = (row: unknown, enforceTenant: boolean): boolean => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as Record<string, unknown>;
    if (enforceTenant) {
      return matchesTenantRow(rec, storeTenant);
    }
    return 'tenant_id' in rec && rec.tenant_id !== undefined ? matchesTenantRow(rec, storeTenant) : true;
  };

  let results: unknown[] = [];
  try {
    const [qFull, pFull] = buildCashbackSql(
      'id, type, amount, balance_after, order_id, expires_at, description, created_at',
      'wallet_id',
      wallet.id
    );
    const res = await c.env.AURA_DB.prepare(qFull).bind(...pFull).all();
    results = (res.results || []).filter((r) => filterCashbackRow(r, false));
  } catch {
    try {
      const [qLegacy, pLegacy] = buildCashbackSql(
        'id, type, amount, balance_after, description, created_at',
        'wallet_id',
        wallet.id
      );
      const res = await c.env.AURA_DB.prepare(qLegacy).bind(...pLegacy).all();
      results = (res.results || []).filter((r) => filterCashbackRow(r, false));
    } catch {
      try {
        const [fbFull, fbFullParams] = buildCashbackSql(
          'id, type, amount, balance_after, order_id, expires_at, description, created_at',
          'customer_id',
          cust.id
        );
        const res = await c.env.AURA_DB.prepare(fbFull).bind(...fbFullParams).all();
        results = (res.results || []).filter((r) => filterCashbackRow(r, true));
      } catch {
        const [fbLegacy, fbLegacyParams] = buildCashbackSql(
          'id, type, amount, balance_after, description, created_at',
          'customer_id',
          cust.id
        );
        const res = await c.env.AURA_DB.prepare(fbLegacy).bind(...fbLegacyParams).all();
        results = (res.results || []).filter((r) => filterCashbackRow(r, true));
      }
    }
  }
  return c.json({ success: true, data: results });
});

loyaltyRouter.get('/rewards', async(c, next) => {
  const cust = c.get('customer') as unknown as Customer | undefined;
  const hasAdminPaging =
    c.req.query('limit') !== undefined ||
    c.req.query('page') !== undefined ||
    c.req.query('includeInactive') !== undefined;
  if (!cust && (hasAdminPaging || (await shouldDelegateRewardsListToOpenApi(c)))) {
    await next();
    return;
  }
  const reqCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(reqCandidates).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const headerTenant = reqCandidates[0] || '';
  if (headerTenant === '*' || headerTenant.toLowerCase() === 'hq') {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const custRecord = cust as unknown as Record<string, unknown> | undefined;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  if (
    rawCustTenant &&
    rawCustTenant !== '*' &&
    rawCustTenant.toLowerCase() !== 'hq' &&
    headerTenant &&
    headerTenant !== rawCustTenant
  ) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  let storeTenant: string;
  if (c.env.PILOT_TENANT_ID) {
    storeTenant = resolvePilotStore(c.env as unknown as Record<string, unknown>);
    if (headerTenant && headerTenant !== storeTenant) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    if (
      rawCustTenant &&
      rawCustTenant !== '*' &&
      rawCustTenant.toLowerCase() !== 'hq' &&
      rawCustTenant !== storeTenant
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  } else if (rawCustTenant && rawCustTenant !== '*' && rawCustTenant.toLowerCase() !== 'hq') {
    storeTenant = rawCustTenant;
  } else if (headerTenant) {
    storeTenant = headerTenant;
  } else {
    storeTenant = resolvePublicTenantId(c);
  }
  const db = c.env.AURA_DB;

  const filterTenantReward = (r: { id: string; title: string; point_cost: number }) => {
    const rec = r as unknown as Record<string, unknown>;
    if ('is_active' in rec && rec.is_active !== undefined && Number(rec.is_active) === 0) {
      return false;
    }
    if ('tenant_id' in rec && rec.tenant_id !== undefined) {
      const rowTenant = String(rec.tenant_id ?? '').trim() || 'default';
      return rowTenant === storeTenant;
    }
    return true;
  };

  let allRewards: Array<{ id: string; title: string; point_cost: number }> = [];
  try {
    const res = await db.prepare(
      "SELECT * FROM rewards WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY point_cost ASC"
    ).bind(storeTenant).all<{ id: string; title: string; point_cost: number }>();
    allRewards = (res.results || []).filter(filterTenantReward);
  } catch {
    allRewards = [];
  }
  if (allRewards.length === 0) {
    try {
      const res = await db.prepare('SELECT * FROM rewards ORDER BY point_cost ASC').all<{ id: string; title: string; point_cost: number }>();
      allRewards = (res.results || []).filter(filterTenantReward);
    } catch {
      allRewards = [];
    }
  }
  if (allRewards.length === 0) {
    try {
      const res = await db.prepare(
        "SELECT id, name AS title, points_cost AS point_cost, description, type AS discount_type, value AS discount_value, is_active, tenant_id FROM loyalty_rewards WHERE is_active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY points_cost ASC"
      ).bind(storeTenant).all<{ id: string; title: string; point_cost: number }>();
      allRewards = (res.results || []).filter(filterTenantReward);
    } catch {
      try {
        const res = await db.prepare(
          'SELECT id, name AS title, points_cost AS point_cost, description, type AS discount_type, value AS discount_value, is_active, tenant_id FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
        ).all<{ id: string; title: string; point_cost: number }>();
        allRewards = (res.results || []).filter(filterTenantReward);
      } catch {
        try {
          const res = await db.prepare(
            'SELECT id, name AS title, points_cost AS point_cost, description, type AS discount_type, value AS discount_value, is_active FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
          ).all<{ id: string; title: string; point_cost: number }>();
          allRewards = (res.results || []).filter(filterTenantReward);
        } catch {
          const res = await db.prepare(
            'SELECT id, name AS title, points_cost AS point_cost, description, reward_type AS discount_type, reward_value AS discount_value, is_active FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_cost ASC'
          ).all<{ id: string; title: string; point_cost: number }>();
          allRewards = (res.results || []).filter(filterTenantReward);
        }
      }
    }
  }

  const tenantRewards = allRewards;

  const pts = cust?.loyalty_points || 0;
  const data = tenantRewards.map(r => ({ ...r, can_redeem: cust ? pts >= r.point_cost : false }));

  return c.json({ success: true, data });
});

loyaltyRouter.post('/redeem', rateLimitMiddleware(LOYALTY_REDEEM_RATE_LIMIT), async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' && rawCustTenant.toLowerCase() !== 'hq' ? rawCustTenant : 'default');
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemRewardSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { reward_id } = parsed.data;

  let fromLegacyRewards = false;
  let reward: { id: string; title: string; point_cost: number } | null = null;
  try {
    reward = await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
    if (reward) fromLegacyRewards = true;
  } catch {
    reward = null;
  }
  if (!reward) {
    try {
      reward = await db.prepare(
        'SELECT id, name AS title, points_cost AS point_cost, max_redemptions, current_redemptions, stock, valid_from, valid_to, min_tier, is_active, tenant_id FROM loyalty_rewards WHERE id = ? AND is_active = 1'
      ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
    } catch {
      try {
        reward = await db.prepare(
          'SELECT id, name AS title, points_cost AS point_cost, max_redemptions, current_redemptions, stock, is_active, tenant_id FROM loyalty_rewards WHERE id = ? AND is_active = 1'
        ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>();
      } catch {
        if (!storeTenant || storeTenant === 'default') {
          reward = await db.prepare(
            'SELECT id, name AS title, points_cost AS point_cost FROM loyalty_rewards WHERE id = ? AND is_active = 1'
          ).bind(reward_id).first<{ id: string; title: string; point_cost: number }>().catch(() => null);
        }
      }
    }
  }
  if (!reward) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }
  const rewardRec = reward as unknown as Record<string, unknown>;
  if ('is_active' in rewardRec && rewardRec.is_active !== undefined && Number(rewardRec.is_active) === 0) {
    return c.json({ success: false, error: 'Reward not found' }, 404);
  }
  if ('tenant_id' in rewardRec && rewardRec.tenant_id !== undefined) {
    const rewardTenant = String(rewardRec.tenant_id ?? '').trim() || 'default';
    if (rewardTenant !== storeTenant) {
      return c.json({ success: false, error: 'Reward not found' }, 404);
    }
  }
  const nowIso = new Date().toISOString();
  if (typeof rewardRec.valid_from === 'string' && rewardRec.valid_from.trim() && nowIso < rewardRec.valid_from.trim()) {
    return c.json({ success: false, error: 'Reward is not yet active' }, 400);
  }
  if (typeof rewardRec.valid_to === 'string' && rewardRec.valid_to.trim() && nowIso > rewardRec.valid_to.trim()) {
    return c.json({ success: false, error: 'Reward has expired' }, 400);
  }
  if (typeof rewardRec.min_tier === 'string' && rewardRec.min_tier.trim()) {
    const tierRank: Record<string, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    const reqRank = tierRank[rewardRec.min_tier.trim().toLowerCase()] ?? 0;
    const custTierRaw = String(cust.loyalty_tier || (custRecord?.tier as string) || 'bronze').trim().toLowerCase();
    const custRank = tierRank[custTierRaw] ?? 1;
    if (reqRank > custRank) {
      return c.json({ success: false, error: 'Tier requirement not met for this reward' }, 403);
    }
  }
  if (typeof rewardRec.stock === 'number' && rewardRec.stock === 0) {
    return c.json({ success: false, error: 'Reward out of stock' }, 409);
  }
  if (
    typeof rewardRec.max_redemptions === 'number' &&
    rewardRec.max_redemptions > 0 &&
    Number(rewardRec.current_redemptions ?? rewardRec.redeemed_count ?? 0) >= rewardRec.max_redemptions
  ) {
    return c.json({ success: false, error: 'Reward redemption limit reached' }, 409);
  }

  const pts = cust.loyalty_points || 0;
  if (pts < reward.point_cost) {
    return c.json({ success: false, error: 'Không du diem', needed: reward.point_cost, current: pts }, 400);
  }

  const now = new Date().toISOString();
  let newPts: number;
  const codeRand = new Uint8Array(3);
  crypto.getRandomValues(codeRand);
  const codeSuffix = Array.from(codeRand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const code = `${reward.title.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${codeSuffix}`;
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  try {
    newPts = await redeemRewardAtomically(db, {
      customerRoute: true, usingCustomersFallback: true, fromRewardsTable: fromLegacyRewards,
      accountId: `la_${cust.id}`, customerId: cust.id, rewardId: reward_id, tenantId: storeTenant,
      pointsCost: reward.point_cost, transactionId: crypto.randomUUID(), voucherCode: code,
      expiresAt, now, rewardName: reward.title, orderId: null, idempotencyKey: null,
    });
  } catch (error) {
    const conflict = /integer overflow|Redemption conflict/i.test(String(error));
    return c.json({ success: false, error: conflict
      ? 'Reward balance or availability changed; retry after refreshing'
      : 'Reward redemption storage unavailable' }, conflict ? 409 : 503);
  }

  return c.json({
    success: true,
    data: {
      code,
      voucherCode: code,
      reward: reward.title,
      points_spent: reward.point_cost,
      points_remaining: newPts,
      expires_at: expiresAt,
      expiresAt,
    }
  });
});

loyaltyRouter.get('/my-rewards', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const custRecord = cust as unknown as Record<string, unknown>;
  const rawCustTenant = String(custRecord?.tenant_id ?? custRecord?.tenantId ?? '').trim();
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' && rawCustTenant.toLowerCase() !== 'hq' ? rawCustTenant : 'default');
  const matchesMyRewardRow = (row: unknown): boolean => {
    if (!row || typeof row !== 'object') return false;
    const rec = row as Record<string, unknown>;
    if ('tenant_id' in rec && rec.tenant_id !== undefined) {
      const rowTenant = String(rec.tenant_id ?? '').trim() || 'default';
      if (rowTenant !== storeTenant) return false;
    }
    const rewardTenantRaw = rec.r_tenant_id ?? rec.lr_tenant_id ?? rec.rw_tenant_id;
    if (rewardTenantRaw !== undefined && rewardTenantRaw !== null) {
      const rewardTenant = String(rewardTenantRaw).trim() || 'default';
      if (rewardTenant !== storeTenant) return false;
    }
    return true;
  };
  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      "SELECT ur.*, COALESCE(r.title, lr.name) AS title, COALESCE(r.discount_type, lr.type) AS discount_type, COALESCE(r.discount_value, lr.value) AS discount_value, r.tenant_id AS r_tenant_id, lr.tenant_id AS lr_tenant_id FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default') LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id AND COALESCE(NULLIF(TRIM(lr.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default') WHERE ur.customer_id = ? AND COALESCE(NULLIF(TRIM(ur.tenant_id), ''), 'default') = ? ORDER BY ur.created_at DESC LIMIT 20"
    ).bind(cust.id, storeTenant).all();
    results = (res.results || []).filter(matchesMyRewardRow);
  } catch {
    try {
      const res = await c.env.AURA_DB.prepare(
        'SELECT ur.*, COALESCE(r.title, lr.name) AS title, COALESCE(r.discount_type, lr.type) AS discount_type, COALESCE(r.discount_value, lr.value) AS discount_value, r.tenant_id AS r_tenant_id, lr.tenant_id AS lr_tenant_id FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
      ).bind(cust.id).all();
      results = (res.results || []).filter(matchesMyRewardRow);
    } catch {
      try {
        const res = await c.env.AURA_DB.prepare(
          'SELECT ur.*, COALESCE(r.title, lr.name) AS title, COALESCE(r.discount_type, lr.type) AS discount_type, COALESCE(r.discount_value, lr.value) AS discount_value FROM user_rewards ur LEFT JOIN rewards r ON ur.reward_id = r.id LEFT JOIN loyalty_rewards lr ON ur.reward_id = lr.id WHERE ur.customer_id = ? ORDER BY ur.created_at DESC LIMIT 20'
        ).bind(cust.id).all();
        results = (res.results || []).filter(matchesMyRewardRow);
      } catch {
        results = [];
      }
    }
  }
  {
    // Canonical-only vouchers have no user_rewards row because its reward FK
    // targets the legacy catalog. Existing legacy vouchers must not hide them.
    const legacyResults = results;
    results = [];
    try {
      const res = await c.env.AURA_DB.prepare(
        "SELECT lr.*, COALESCE(r.name, rw.title) AS title, COALESCE(r.type, rw.discount_type) AS discount_type, COALESCE(r.value, rw.discount_value) AS discount_value, r.tenant_id AS r_tenant_id, rw.tenant_id AS rw_tenant_id FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(lr.tenant_id), ''), 'default') LEFT JOIN rewards rw ON lr.reward_id = rw.id AND COALESCE(NULLIF(TRIM(rw.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(lr.tenant_id), ''), 'default') WHERE lr.customer_id = ? AND COALESCE(NULLIF(TRIM(lr.tenant_id), ''), 'default') = ? ORDER BY lr.created_at DESC LIMIT 20"
      ).bind(cust.id, storeTenant).all();
      results = (res.results || []).filter(matchesMyRewardRow);
    } catch {
      try {
        const res = await c.env.AURA_DB.prepare(
          'SELECT lr.*, COALESCE(r.name, rw.title) AS title, COALESCE(r.type, rw.discount_type) AS discount_type, COALESCE(r.value, rw.discount_value) AS discount_value, r.tenant_id AS r_tenant_id, rw.tenant_id AS rw_tenant_id FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id LEFT JOIN rewards rw ON lr.reward_id = rw.id WHERE lr.customer_id = ? ORDER BY lr.created_at DESC LIMIT 20'
        ).bind(cust.id).all();
        results = (res.results || []).filter(matchesMyRewardRow);
      } catch {
        try {
          const res = await c.env.AURA_DB.prepare(
            'SELECT lr.*, COALESCE(r.name, rw.title) AS title, COALESCE(r.type, rw.discount_type) AS discount_type, COALESCE(r.value, rw.discount_value) AS discount_value FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id LEFT JOIN rewards rw ON lr.reward_id = rw.id WHERE lr.customer_id = ? ORDER BY lr.created_at DESC LIMIT 20'
          ).bind(cust.id).all();
          results = (res.results || []).filter(matchesMyRewardRow);
        } catch {
          const res = await c.env.AURA_DB.prepare(
            'SELECT lr.*, r.name AS title, r.reward_type AS discount_type, r.reward_value AS discount_value FROM loyalty_redemptions lr LEFT JOIN loyalty_rewards r ON lr.reward_id = r.id WHERE lr.customer_id = ? ORDER BY lr.created_at DESC LIMIT 20'
          ).bind(cust.id).all().catch(() => ({ results: [] }));
          results = (res.results || []).filter(matchesMyRewardRow);
        }
      }
    }
    const seenCodes = new Set(legacyResults.map(row => String((row as Record<string, unknown>).code ?? '')).filter(Boolean));
    results = [
      ...legacyResults,
      ...results.filter(row => {
        const code = String((row as Record<string, unknown>).code ?? '');
        return !code || !seenCodes.has(code);
      }),
    ].sort((a, b) => String((b as Record<string, unknown>).created_at ?? '').localeCompare(
      String((a as Record<string, unknown>).created_at ?? ''),
    )).slice(0, 20);
  }

  const scopedResults = results.filter(matchesMyRewardRow);

  return c.json({ success: true, data: scopedResults });
});

loyaltyRouter.get('/tiers', async(c) => {
  const reqCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(reqCandidates).size > 1) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const cust = c.get('customer') as unknown as Record<string, unknown> | undefined;
  const rawCustTenant = String(cust?.tenant_id ?? cust?.tenantId ?? '').trim();
  const headerTenant = reqCandidates[0] || '';
  if (headerTenant === '*' || headerTenant.toLowerCase() === 'hq') {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  if (
    rawCustTenant &&
    rawCustTenant !== '*' &&
    rawCustTenant.toLowerCase() !== 'hq' &&
    headerTenant &&
    headerTenant !== rawCustTenant
  ) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  const fallbackCtxTenant = getTenantId(c).trim();
  const safeFallbackTenant =
    fallbackCtxTenant && fallbackCtxTenant !== '*' && fallbackCtxTenant.toLowerCase() !== 'hq'
      ? fallbackCtxTenant
      : 'default';
  const storeTenant = c.env.PILOT_TENANT_ID
    ? resolvePilotStore(c.env as unknown as Record<string, unknown>)
    : (rawCustTenant && rawCustTenant !== '*' && rawCustTenant.toLowerCase() !== 'hq'
      ? rawCustTenant
      : (headerTenant && headerTenant !== '*' && headerTenant.toLowerCase() !== 'hq' ? headerTenant : safeFallbackTenant));
  let results: unknown[] = [];
  try {
    const res = await c.env.AURA_DB.prepare(
      "SELECT * FROM loyalty_tiers WHERE (COALESCE(tenant_id, 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?1) ORDER BY min_points ASC"
    ).bind(storeTenant).all();
    results = (res.results || []).filter((row) =>
      row && typeof row === 'object' ? matchesTenantRow(row as Record<string, unknown>, storeTenant) : false
    );
  } catch {
    try {
      const res = await c.env.AURA_DB.prepare('SELECT * FROM loyalty_tiers ORDER BY min_points ASC').all();
      results = (res.results || []).filter((row) =>
        row && typeof row === 'object' ? matchesTenantRow(row as Record<string, unknown>, storeTenant) : false
      );
    } catch {
      const res = await c.env.AURA_DB.prepare(
        'SELECT tier AS tier_name, min_points, cashback_rate, points_multiplier, perks FROM tier_configs ORDER BY min_points ASC'
      ).all();
      results = (res.results || []).filter((row) =>
        row && typeof row === 'object' ? matchesTenantRow(row as Record<string, unknown>, storeTenant) : false
      );
    }
  }
  return c.json({ success: true, data: results });
});

// Re-exports for backward compat with orders.ts, refunds.ts, and tests
export { loadPolicy, applyAccrual, reverseAccrual } from '@aura/domain-crm';
