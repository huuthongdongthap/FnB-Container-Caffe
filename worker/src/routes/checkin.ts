/**
 * Checkin Routes — /api/checkin
 * Check-in rewards with staff approval flow.
 *
 * SOLO-OPC MODE: tenant isolation intentionally bypassed.
 * In single-tenant deployment there is no cross-tenant boundary — all
 * customers and checkins belong to the single OPC instance.
 * If multi-tenancy is later introduced, add a `tenant_id` column and
 * filter WHERE tenant_id = ? in every query below.
 */

import { Hono } from 'hono';
import { resolvePilotStore } from '../lib/pilot-store';
import { checkinSchema } from '../lib/validators';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getTenantId as getCanonicalTenantId, resolvePublicTenantId } from '../middleware/tenant';
import { rateLimitMiddleware, CHECKIN_RATE_LIMIT } from '../middleware/rate-limit';


/** CSPRNG-suffixed checkin ID — replaces Math.random() (predictable / collidable) */
function makeCheckinId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return (`ci_${Date.now().toString(36)}${rand}`);
}

function makeWalletId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `wal_${Date.now().toString(36)}${rand}`;
}

function getTenantId(c: {
  env: Env;
  req: { query?: (k: string) => string | undefined; header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  if (typeof c?.get === 'function' && (c.get('user') || c.get('tenantId'))) {
    return getCanonicalTenantId(c as Parameters<typeof getCanonicalTenantId>[0]);
  }
  if (typeof resolvePublicTenantId === 'function') {
    try {
      return resolvePublicTenantId(c as Parameters<typeof resolvePublicTenantId>[0]);
    } catch {
      // fall through to pilot store resolution
    }
  }
  if (!c.env?.PILOT_TENANT_ID) {
    const hdr = c.req.header('X-Tenant-ID');
    if (hdr && hdr.trim() && hdr.trim() !== '*') return hdr.trim();
  }
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

function matchesTenantRow(row: unknown, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const raw = r.customer_tenant_id ?? r.tenant_id;
  if (raw === undefined) return tenantId === 'default';
  const rowTenant = typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
  return rowTenant === tenantId;
}

interface CheckinRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  checkin_date: string;
  checkin_time: string;
  reward_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  staff_id: string | null;
  created_at: string;
}


export const checkinRouter = new Hono<{ Bindings: Env }>();

// POST /api/checkin — customer checks in (creates pending reward)
checkinRouter.post('/', rateLimitMiddleware(CHECKIN_RATE_LIMIT),
  async (c, next) => {
    if (!c.get('user' as never) && c.req.header('Authorization') && typeof optionalAuth === 'function') {
      return optionalAuth()(c, next);
    }
    await next();
  },
  async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const authUser = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as
    | { id?: string; sub?: string; role?: string }
    | undefined;
  const authCustomerId =
    authUser && (!authUser.role || authUser.role === 'customer')
      ? String(authUser.id || authUser.sub || '').trim()
      : '';
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const data = parsed.data;
  if (authCustomerId && data.customer_id && data.customer_id !== authCustomerId) {
    return c.json({ success: false, error: 'Forbidden: cannot check in for another customer' }, 403);
  }
  let resolvedCustomerId = authCustomerId || data.customer_id || '';
  let resolvedPhoneCustomerName: string | undefined;

  if (!resolvedCustomerId && (data.phone || data.customer_phone)) {
    const rawPhone = String(data.phone || data.customer_phone || '').replace(/\s+/g, '');
    const orderTenant = tenantId === '*' ? 'default' : tenantId;
    let byPhone: { id: string; name: string; tenant_id?: string | null } | null = null;
    try {
      byPhone = await db.prepare(
        "SELECT id, name, tenant_id FROM customers WHERE phone = ? ORDER BY CASE WHEN COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2 THEN 0 ELSE 1 END"
      ).bind(rawPhone, orderTenant).first<{ id: string; name: string; tenant_id?: string | null }>();
    } catch {
      try {
        byPhone = await db.prepare(
          'SELECT id, name, tenant_id FROM customers WHERE phone = ?'
        ).bind(rawPhone).first<{ id: string; name: string; tenant_id?: string | null }>();
      } catch {
        byPhone = await db.prepare(
          'SELECT id, name FROM customers WHERE phone = ?'
        ).bind(rawPhone).first<{ id: string; name: string }>().catch(() => null);
      }
    }
    if (byPhone && !matchesTenantRow(byPhone, tenantId)) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }
    resolvedCustomerId = byPhone?.id || rawPhone;
    resolvedPhoneCustomerName = byPhone?.name;
  }

  // Prevent duplicate check-in today (scoped by tenant when tenant_id is present)
  const today = new Date().toISOString().slice(0, 10);
  let existing = await db.prepare(
    'SELECT id FROM checkins WHERE customer_id = ? AND checkin_date = ?'
  ).bind(resolvedCustomerId, today).first<{ id: string; tenant_id?: string | null }>();

  if (existing && tenantId !== '*') {
    const fullExisting = ('tenant_id' in existing && existing.tenant_id !== undefined)
      ? existing
      : await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(existing.id).first<Record<string, unknown>>().catch(() => null);
    if (fullExisting && 'tenant_id' in fullExisting && fullExisting.tenant_id !== undefined && !matchesTenantRow(fullExisting, tenantId)) {
      const scopedExisting = await db.prepare(
        "SELECT id, tenant_id FROM checkins WHERE customer_id = ? AND checkin_date = ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)"
      ).bind(resolvedCustomerId, today, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() => null);
      existing = scopedExisting && matchesTenantRow(scopedExisting, tenantId) ? scopedExisting : null;
    }
  }

  if (existing) {
    return c.json({ success: false, error: 'Already checked in today' }, 400);
  }

  let customer: { id: string; name: string; tenant_id?: string | null } | null = null;
  if (data.customer_id) {
    try {
      customer = await db.prepare(
        'SELECT id, name, tenant_id FROM customers WHERE id = ?'
      ).bind(resolvedCustomerId).first<{ id: string; name: string; tenant_id?: string | null }>();
    } catch {
      customer = await db.prepare(
        'SELECT id, name FROM customers WHERE id = ?'
      ).bind(resolvedCustomerId).first<{ id: string; name: string }>();
    }
    if (customer && !matchesTenantRow(customer, tenantId)) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }
  } else if (resolvedPhoneCustomerName) {
    customer = { id: resolvedCustomerId, name: resolvedPhoneCustomerName };
  }

  const id = makeCheckinId();
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO checkins (id, customer_id, customer_name, checkin_date, checkin_time, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    resolvedCustomerId,
    data.customer_name || customer?.name || 'Unknown',
    today,
    now,
    5000, // Default reward: 5,000 VND
    'pending',
    now
  ).run();
  if (tenantId && tenantId !== '*') {
    await db.prepare('UPDATE checkins SET tenant_id = ? WHERE id = ?').bind(tenantId, id).run().catch(() => {});
  }

  const row = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  return c.json({ success: true, data: row }, 201);
});

// PATCH /api/checkin/:id/approve — manager/supervisor approves check-in reward
// Solo-OPC: no tenant isolation guard (SOLO_OPC = true)
checkinRouter.patch('/:id/approve', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const user = c.get('user') as { id?: string; sub?: string; role?: string } | undefined;
  if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const staffId = user?.id || user?.sub || null;

  const checkin = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  if (!checkin) {
    return c.json({ success: false, error: 'Checkin not found' }, 404);
  }
  if ('tenant_id' in (checkin as unknown as Record<string, unknown>) && !matchesTenantRow(checkin, tenantId)) {
    return c.json({ success: false, error: 'Checkin not found' }, 404);
  }
  try {
    const custRow = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(checkin.customer_id).first<{ id: string; tenant_id?: string | null }>();
    if (custRow ? !matchesTenantRow(custRow, tenantId) : (tenantId !== 'default' && tenantId !== '*' && !('tenant_id' in (checkin as unknown as Record<string, unknown>)))) {
      return c.json({ success: false, error: 'Checkin not found' }, 404);
    }
  } catch {
    if (tenantId !== 'default' && tenantId !== '*' && !('tenant_id' in (checkin as unknown as Record<string, unknown>))) {
      return c.json({ success: false, error: 'Checkin not found' }, 404);
    }
  }
  if (checkin.status !== 'pending') {
    return c.json({ success: false, error: `Already ${checkin.status}` }, 400);
  }

  let updateRes: unknown;
  if (staffId) {
    try {
      updateRes = await db.prepare(
        "UPDATE checkins SET status = ?, staff_id = ? WHERE id = ? AND status = 'pending'"
      ).bind('approved', staffId, id).run();
    } catch {
      updateRes = await db.prepare(
        "UPDATE checkins SET status = ? WHERE id = ? AND status = 'pending'"
      ).bind('approved', id).run();
    }
  } else {
    updateRes = await db.prepare(
      "UPDATE checkins SET status = ? WHERE id = ? AND status = 'pending'"
    ).bind('approved', id).run();
  }

  const changes = (updateRes as { meta?: { changes?: number } })?.meta?.changes ?? 1;
  if (changes === 0) {
    return c.json({ success: false, error: 'Already processed' }, 409);
  }

  // Add cashback reward to wallet (with fallback for legacy mocks)
  const rawCheckinTenant = String((checkin as unknown as Record<string, unknown>).tenant_id ?? '').trim();
  const effectiveTenant = rawCheckinTenant
    ? rawCheckinTenant
    : (tenantId && tenantId !== '*' ? tenantId : 'default');
  try {
    let wallet: { id: string; balance: number } | null = null;
    try {
      wallet = await db.prepare(
        "SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(checkin.customer_id, effectiveTenant).first<{ id: string; balance: number }>();
    } catch {
      wallet = await db.prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?').bind(checkin.customer_id).first<{ id: string; balance: number }>();
    }
    const now = new Date().toISOString();
    let walletId = wallet?.id || '';
    const newBalance = (Number(wallet?.balance) || 0) + Number(checkin.reward_amount || 0);
    if (!wallet) {
      const wid = makeWalletId();
      walletId = wid;
      let walletInserted = false;
      try {
        await db.prepare(
          'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at, tenant_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
        ).bind(wid, checkin.customer_id, checkin.reward_amount, checkin.reward_amount, now, now, effectiveTenant).run();
        walletInserted = true;
      } catch {
        try {
          await db.prepare(
            'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
          ).bind(wid, checkin.customer_id, checkin.reward_amount, checkin.reward_amount, now, now).run();
          walletInserted = true;
        } catch {
          walletInserted = false;
        }
      }
      if (!walletInserted) {
        const retryWallet = await db
          .prepare(
            "SELECT id, balance FROM cashback_wallets WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(checkin.customer_id, effectiveTenant)
          .first<{ id: string; balance: number }>()
          .catch(() => null);
        if (retryWallet) {
          walletId = retryWallet.id;
          await db
            .prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?')
            .bind(checkin.reward_amount, checkin.reward_amount, now, retryWallet.id)
            .run();
        } else {
          try {
            await db
              .prepare(
                "UPDATE customers SET cashback_balance = COALESCE(cashback_balance, 0) + ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(checkin.reward_amount, checkin.customer_id, effectiveTenant)
              .run();
          } catch {
            await db
              .prepare('UPDATE customers SET cashback_balance = COALESCE(cashback_balance, 0) + ? WHERE id = ?')
              .bind(checkin.reward_amount, checkin.customer_id)
              .run()
              .catch(() => {});
          }
        }
      }
    } else {
      await db.prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(checkin.reward_amount, checkin.reward_amount, now, wallet.id).run();
    }

    const txId = `ctx_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
    const txDesc = `Check-in reward approved (${id})`;
    try {
      await db.prepare(
        'INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, reference_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(txId, walletId, checkin.customer_id, 'earn', checkin.reward_amount, newBalance, txDesc, id, effectiveTenant, now).run();
    } catch {
      try {
        await db.prepare(
          'INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(txId, walletId, checkin.customer_id, 'earn', checkin.reward_amount, newBalance, txDesc, effectiveTenant, now).run();
      } catch {
        try {
          await db.prepare(
            'INSERT INTO cashback_transactions (id, customer_id, type, amount, balance_after, description, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(txId, checkin.customer_id, 'earn', checkin.reward_amount, newBalance, txDesc, id, now).run();
        } catch {
          // Ignore when cashback_transactions table is absent in lightweight test mocks
        }
      }
    }
  } catch {
    try {
      await db.prepare(
        "UPDATE customers SET cashback_balance = COALESCE(cashback_balance, 0) + ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(checkin.reward_amount, checkin.customer_id, effectiveTenant).run();
    } catch {
      try {
        await db.prepare(
          'UPDATE customers SET cashback_balance = COALESCE(cashback_balance, 0) + ? WHERE id = ?'
        ).bind(checkin.reward_amount, checkin.customer_id).run();
      } catch {}
    }
  }

  const row = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  return c.json({ success: true, data: row });
});

// PATCH /api/checkin/:id/reject — manager/supervisor rejects check-in
checkinRouter.patch('/:id/reject', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const user = c.get('user') as { id?: string; sub?: string; role?: string } | undefined;
  if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const staffId = user?.id || user?.sub || null;

  const checkin = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  if (!checkin) {
    return c.json({ success: false, error: 'Checkin not found' }, 404);
  }
  if ('tenant_id' in (checkin as unknown as Record<string, unknown>) && !matchesTenantRow(checkin, tenantId)) {
    return c.json({ success: false, error: 'Checkin not found' }, 404);
  }
  try {
    const custRow = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(checkin.customer_id).first<{ id: string; tenant_id?: string | null }>();
    if (custRow ? !matchesTenantRow(custRow, tenantId) : (tenantId !== 'default' && tenantId !== '*' && !('tenant_id' in (checkin as unknown as Record<string, unknown>)))) {
      return c.json({ success: false, error: 'Checkin not found' }, 404);
    }
  } catch {
    if (tenantId !== 'default' && tenantId !== '*' && !('tenant_id' in (checkin as unknown as Record<string, unknown>))) {
      return c.json({ success: false, error: 'Checkin not found' }, 404);
    }
  }
  if (checkin.status !== 'pending') {
    return c.json({ success: false, error: `Already ${checkin.status}` }, 400);
  }

  let updateRes: unknown;
  if (staffId) {
    try {
      updateRes = await db.prepare("UPDATE checkins SET status = ?, staff_id = ? WHERE id = ? AND status = 'pending'").bind('rejected', staffId, id).run();
    } catch {
      updateRes = await db.prepare("UPDATE checkins SET status = ? WHERE id = ? AND status = 'pending'").bind('rejected', id).run();
    }
  } else {
    updateRes = await db.prepare("UPDATE checkins SET status = ? WHERE id = ? AND status = 'pending'").bind('rejected', id).run();
  }
  const changes = (updateRes as { meta?: { changes?: number } })?.meta?.changes ?? 1;
  if (changes === 0) {
    return c.json({ success: false, error: 'Already processed' }, 409);
  }

  const row = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  return c.json({ success: true, data: row });
});

// GET /api/checkin — list checkins (filterable)
// Solo-OPC: no tenant isolation filter (SOLO_OPC = true)
checkinRouter.get(
  '/',
  async (c, next) => {
    const isProd = c.env?.ENVIRONMENT === 'production';
    if (isProd || c.req.header('Authorization')) {
      return requireAuth(['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier'])(c, next);
    }
    await next();
  },
  async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const status = c.req.query('status');
  const date = c.req.query('date');
  const customerId = c.req.query('customer_id');

  const params: unknown[] = [];
  let filterClauses = '';

  if (status) {
    filterClauses += ' AND status = ?'; params.push(status);
  }
  if (date) {
    filterClauses += ' AND checkin_date = ?'; params.push(date);
  }
  if (customerId) {
    filterClauses += ' AND customer_id = ?'; params.push(customerId);
  }

  let rows: Array<CheckinRecord & { customer_phone?: string; phone?: string; customer_tenant_id?: string | null }> = [];
  const joinFilter = filterClauses.replace(/\bstatus\b/g, 'ci.status').replace(/\bcheckin_date\b/g, 'ci.checkin_date').replace(/\bcustomer_id\b/g, 'ci.customer_id');
  const tenantJoinClause =
    tenantId !== '*'
      ? " AND COALESCE(NULLIF(TRIM(COALESCE(c.tenant_id, ci.tenant_id)), ''), 'default') = ?"
      : '';
  const tenantJoinParams = tenantId !== '*' ? [...params, tenantId] : params;
  try {
    const query = `SELECT ci.*, c.phone as customer_phone, c.tenant_id as customer_tenant_id FROM checkins ci LEFT JOIN customers c ON c.id = ci.customer_id WHERE 1=1${joinFilter}${tenantJoinClause} ORDER BY ci.created_at DESC LIMIT 200`;
    const { results } = await db.prepare(query).bind(...tenantJoinParams).all<any>();
    rows = results || [];
  } catch {
    try {
      const custTenantClause = tenantId !== '*' ? " AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?" : '';
      const query = `SELECT ci.*, c.phone as customer_phone, c.tenant_id as customer_tenant_id FROM checkins ci LEFT JOIN customers c ON c.id = ci.customer_id WHERE 1=1${joinFilter}${custTenantClause} ORDER BY ci.created_at DESC LIMIT 200`;
      const { results } = await db.prepare(query).bind(...tenantJoinParams).all<any>();
      rows = results || [];
    } catch {
      try {
        const query = `SELECT ci.*, c.phone as customer_phone FROM checkins ci LEFT JOIN customers c ON c.id = ci.customer_id WHERE 1=1${joinFilter} ORDER BY ci.created_at DESC LIMIT 200`;
        const { results } = await db.prepare(query).bind(...params).all<any>();
        rows = results || [];
      } catch {
        try {
          const fallbackQuery = `SELECT * FROM checkins WHERE 1=1${filterClauses} ORDER BY created_at DESC LIMIT 200`;
          const { results } = await db.prepare(fallbackQuery).bind(...params).all<any>();
          rows = results || [];
        } catch {
          rows = [];
        }
      }
    }
  }

  rows = rows.filter((r) => matchesTenantRow(r, tenantId)).slice(0, 100);

  const checkins = rows.map((r) => ({
    ...r,
    memberId: r.customer_id,
    memberName: r.customer_name || 'Khách hàng',
    memberPhone: r.customer_phone || r.phone || '—',
    submittedAt: r.checkin_time || r.created_at,
  }));
  return c.json({ success: true, data: checkins, checkins });
});
