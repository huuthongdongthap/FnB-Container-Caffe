/**
 * Lookup Handler - GET /api/loyalty/lookup
 * POS lookup customer by phone with wallet balance, tier progress, expiring cashback.
 */
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { Customer, CashbackWallet } from '../../types/models';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { StaffSessionError, isStaffRole, staffTenant } from '../../lib/staff-session';
import { resolvePilotStore, PilotStoreError } from '../../lib/pilot-store';

const DEFAULT_TIER = 'bronze';
const TIER_VI_MAP: Record<string, string> = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };
const POS_LOOKUP_ROLES = new Set(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']);

export async function handleLookup(c: Context<{ Bindings: Env }>) {
  let tenantId = 'default';
  try {
    tenantId = resolvePilotStore(c.env);
  } catch (err) {
    if (err instanceof PilotStoreError) {
      return c.json({ ok: false, code: err.code, error: err.message }, 503);
    }
    throw err;
  }

  let callerCustomerId: string | null = null;
  if (c.req.raw) {
    try {
      const session = await authenticateRequest(c.req.raw, c.env);
      if (!session) {
        return c.json({ ok: false, error: 'Chưa đăng nhập' }, 401);
      }
      if ('blocked' in session) {
        return c.json({ ok: false, error: session.blocked }, 403);
      }
      if (session.account) {
        const acctRole = String(session.account.role || '');
        const acctTenant = staffTenant(session.account);
        if (!isStaffRole(acctRole) || !POS_LOOKUP_ROLES.has(acctRole)) {
          return c.json({ ok: false, error: 'Không đủ quyền truy cập' }, 403);
        }
        if (acctTenant !== tenantId) {
          return c.json({ ok: false, error: 'Không đủ quyền truy cập cửa hàng này' }, 403);
        }
      } else if (session.payload.role === 'customer') {
        callerCustomerId = String(session.payload.id || (session.payload as unknown as Record<string, unknown>).sub || '');
        if (!callerCustomerId) {
          return c.json({ ok: false, error: 'Không đủ quyền truy cập' }, 403);
        }
      } else {
        return c.json({ ok: false, error: 'Không đủ quyền truy cập' }, 403);
      }
    } catch (err) {
      if (err instanceof StaffSessionError) {
        return c.json({ ok: false, code: err.code, error: err.message }, err.status);
      }
      return c.json({ ok: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời gián đoạn' }, 503);
    }
  }

  // Normalize to digits so "0901 234 567" and "0901234567" match the same row
  const phone = (c.req.query('phone') || '').replace(/\D/g, '');
  if (phone.length < 9 || phone.length > 12) {
    return c.json({ ok: false, error: 'Số điện thoại không hợp lệ' }, 400);
  }

  const db = c.env.AURA_DB;
  let customer: Customer | null = null;
  try {
    customer = await db.prepare(
      "SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?"
    ).bind(phone, tenantId).first<Customer>();
  } catch {
    try {
      customer = await db.prepare(
        'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
      ).bind(phone).first<Customer>();
    } catch {
      customer = await db.prepare(
        'SELECT id, email, name, phone, loyalty_points, loyalty_points AS lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
      ).bind(phone).first<Customer>();
    }
    const rowTenant = (customer as unknown as Record<string, unknown> | null)?.tenant_id;
    if (typeof rowTenant === 'string' && rowTenant.trim() !== '' && rowTenant !== tenantId) {
      customer = null;
    }
  }
  if (!customer) {
    return c.json({ ok: false, error: 'Không tìm thấy thành viên' }, 200);
  }
  if (callerCustomerId && String(customer.id) !== callerCustomerId) {
    return c.json({ ok: false, error: 'Không đủ quyền truy cập hồ sơ khách hàng khác' }, 403);
  }

  const wallet = await db.prepare('SELECT * FROM cashback_wallets WHERE customer_id = ?').bind(customer.id).first<CashbackWallet>();
  const balance = wallet?.balance || 0;

  let lifetimeRow: { total: number } | null = null;
  try {
    lifetimeRow = await db.prepare(
      'SELECT COALESCE(SUM(ct.amount), 0) as total FROM cashback_transactions ct JOIN cashback_wallets cw ON cw.id = ct.wallet_id WHERE cw.customer_id = ? AND ct.type IN (\'earn\', \'bonus\')'
    ).bind(customer.id).first<{ total: number }>();
  } catch {
    lifetimeRow = await db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\')'
    ).bind(customer.id).first<{ total: number }>();
  }

  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString();
  let expiringRow: { total: number; cnt: number } | null = null;
  try {
    expiringRow = await db.prepare(
      'SELECT COALESCE(SUM(ct.amount), 0) as total, COUNT(*) as cnt FROM cashback_transactions ct JOIN cashback_wallets cw ON cw.id = ct.wallet_id WHERE cw.customer_id = ? AND ct.type IN (\'earn\', \'bonus\') AND ct.expires_at IS NOT NULL AND ct.expires_at <= ? AND ct.expires_at > datetime(\'now\')'
    ).bind(customer.id, sevenDays).first<{ total: number; cnt: number }>();
  } catch {
    expiringRow = await db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM cashback_transactions WHERE customer_id = ? AND type IN (\'earn\', \'bonus\') AND expires_at IS NOT NULL AND expires_at <= ? AND expires_at > datetime(\'now\')'
    ).bind(customer.id, sevenDays).first<{ total: number; cnt: number }>();
  }

  let nextTierRow: { tier_name: string; min_points: number } | null = null;
  try {
    nextTierRow = await db.prepare(
      'SELECT * FROM loyalty_tiers WHERE min_points > ? ORDER BY min_points ASC LIMIT 1'
    ).bind(customer.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();
  } catch {
    try {
      nextTierRow = await db.prepare(
        'SELECT tier AS tier_name, min_points FROM tier_configs WHERE min_points > ? ORDER BY min_points ASC LIMIT 1'
      ).bind(customer.lifetime_points || 0).first<{ tier_name: string; min_points: number }>();
    } catch {
      nextTierRow = null;
    }
  }

  let tierProgress: Record<string, unknown> | null = null;
  if (nextTierRow && customer.lifetime_points !== undefined) {
    const pts = customer.lifetime_points || 0;
    const needed = nextTierRow.min_points - pts;
    let prevTier: { min_points: number } | null = null;
    try {
      prevTier = await db.prepare(
        'SELECT min_points FROM loyalty_tiers WHERE min_points < ? ORDER BY min_points DESC LIMIT 1'
      ).bind(nextTierRow.min_points).first<{ min_points: number }>();
    } catch {
      try {
        prevTier = await db.prepare(
          'SELECT min_points FROM tier_configs WHERE min_points < ? ORDER BY min_points DESC LIMIT 1'
        ).bind(nextTierRow.min_points).first<{ min_points: number }>();
      } catch {
        prevTier = null;
      }
    }
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
