/**
 * Birthday Routes — /api/birthday
 * Birthday discount eligibility and redemption.
 */

import { Hono } from 'hono';
import { redeemBirthdaySchema, zodErrorResponse } from '../lib/validators';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { getTenantId, matchesTenantRow } from '../lib/db';
import type { Env } from '../types/env';


export const birthdayRouter = new Hono<{ Bindings: Env }>();
birthdayRouter.use('*', optionalAuth());

function makeBirthdayRedemptionId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `bday_${Date.now().toString(36)}${rand}`;
}

function resolveBirthdayConfigKey(tenantId: string): { effectiveTenant: string; key: string } {
  const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
  return { effectiveTenant, key: `config:birthday:${effectiveTenant}` };
}

async function readBirthdayConfigRaw(kv: Env['AUTH_KV'] | undefined, tenantId: string): Promise<string | null> {
  if (!kv) return null;
  const { effectiveTenant, key } = resolveBirthdayConfigKey(tenantId);
  const scoped = await kv.get(key);
  if (scoped !== null && scoped !== undefined) return scoped;
  if (effectiveTenant === 'default') {
    return (await kv.get('config:birthday')) ?? null;
  }
  return null;
}

type BirthdayCustomerRow = {
  id: string;
  name: string;
  phone?: string;
  birthday?: string | null;
  date_of_birth?: string | null;
  tenant_id?: string | null;
};

async function findBirthdayCustomer(
  db: Env['AURA_DB'],
  by: { id?: string; phone?: string },
  tenantId = 'default'
): Promise<{ id: string; name: string; phone: string; birthday: string } | null> {
  const col = by.id ? 'id' : 'phone';
  const val = by.id ?? by.phone ?? '';
  let row: BirthdayCustomerRow | null = null;
  try {
    if (tenantId !== '*') {
      row = await db
        .prepare(`SELECT *, date_of_birth AS birthday FROM customers WHERE ${col} = ? ORDER BY CASE WHEN COALESCE(NULLIF(tenant_id, ''), 'default') = ? THEN 0 ELSE 1 END`)
        .bind(val, tenantId)
        .first<BirthdayCustomerRow>();
    } else {
      row = await db
        .prepare(`SELECT *, date_of_birth AS birthday FROM customers WHERE ${col} = ?`)
        .bind(val)
        .first<BirthdayCustomerRow>();
    }
  } catch {
    try {
      row = await db
        .prepare(`SELECT *, date_of_birth AS birthday FROM customers WHERE ${col} = ?`)
        .bind(val)
        .first<BirthdayCustomerRow>();
    } catch {
      row = await db
        .prepare(`SELECT * FROM customers WHERE ${col} = ?`)
        .bind(val)
        .first<BirthdayCustomerRow>();
    }
  }
  if (!row || !matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) return null;
  const resolvedBirthday = row.birthday ?? row.date_of_birth ?? '';
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    birthday: resolvedBirthday,
  };
}

const DEFAULT_BIRTHDAY_CONFIG = {
  discountPercent: 15,
  freeItemEnabled: true,
  earlyWindowDays: 3,
  lateWindowDays: 3,
  autoSendEnabled: true,
};

// GET /api/admin/birthday/config — fetch birthday campaign configuration
birthdayRouter.get(
  '/config',
  async (c, next) => {
    if (c.env?.JWT_SECRET || c.req.header('Authorization')) {
      return requireAuth(['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier'])(c, next);
    }
    await next();
  },
  async (c) => {
  try {
    const tenantId = getTenantId(c);
    const raw = await readBirthdayConfigRaw(c.env.AUTH_KV, tenantId);
    const parsed = raw ? (JSON.parse(raw) as Partial<typeof DEFAULT_BIRTHDAY_CONFIG>) : {};
    return c.json({
      discountPercent: Number(parsed.discountPercent ?? DEFAULT_BIRTHDAY_CONFIG.discountPercent),
      freeItemEnabled: typeof parsed.freeItemEnabled === 'boolean' ? parsed.freeItemEnabled : DEFAULT_BIRTHDAY_CONFIG.freeItemEnabled,
      earlyWindowDays: Number(parsed.earlyWindowDays ?? DEFAULT_BIRTHDAY_CONFIG.earlyWindowDays),
      lateWindowDays: Number(parsed.lateWindowDays ?? DEFAULT_BIRTHDAY_CONFIG.lateWindowDays),
      autoSendEnabled: typeof parsed.autoSendEnabled === 'boolean' ? parsed.autoSendEnabled : DEFAULT_BIRTHDAY_CONFIG.autoSendEnabled,
    });
  } catch {
    return c.json(DEFAULT_BIRTHDAY_CONFIG);
  }
});

// PUT /api/admin/birthday/config — update birthday campaign configuration
birthdayRouter.put(
  '/config',
  async (c, next) => {
    if (c.env?.JWT_SECRET || c.req.header('Authorization')) {
      return requireAuth(['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier'])(c, next);
    }
    await next();
  },
  async (c) => {
  const tenantId = getTenantId(c);
  const { effectiveTenant, key } = resolveBirthdayConfigKey(tenantId);
  const body = (await c.req.json().catch(() => ({}))) as Partial<typeof DEFAULT_BIRTHDAY_CONFIG>;
  const raw = await readBirthdayConfigRaw(c.env.AUTH_KV, tenantId);
  const prev = raw ? (JSON.parse(raw) as Partial<typeof DEFAULT_BIRTHDAY_CONFIG>) : {};
  const next = {
    discountPercent: typeof body.discountPercent === 'number' ? body.discountPercent : Number(prev.discountPercent ?? DEFAULT_BIRTHDAY_CONFIG.discountPercent),
    freeItemEnabled: typeof body.freeItemEnabled === 'boolean' ? body.freeItemEnabled : Boolean(prev.freeItemEnabled ?? DEFAULT_BIRTHDAY_CONFIG.freeItemEnabled),
    earlyWindowDays: typeof body.earlyWindowDays === 'number' ? body.earlyWindowDays : Number(prev.earlyWindowDays ?? DEFAULT_BIRTHDAY_CONFIG.earlyWindowDays),
    lateWindowDays: typeof body.lateWindowDays === 'number' ? body.lateWindowDays : Number(prev.lateWindowDays ?? DEFAULT_BIRTHDAY_CONFIG.lateWindowDays),
    autoSendEnabled: typeof body.autoSendEnabled === 'boolean' ? body.autoSendEnabled : Boolean(prev.autoSendEnabled ?? DEFAULT_BIRTHDAY_CONFIG.autoSendEnabled),
  };
  await c.env.AUTH_KV?.put(key, JSON.stringify(next));
  if (effectiveTenant === 'default') {
    await c.env.AUTH_KV?.put('config:birthday', JSON.stringify(next));
  }
  return c.json(next);
});

// GET /api/birthday/check — check eligibility
birthdayRouter.get('/check', async(c) => {
  const db = c.env.AURA_DB;
  const customerId = c.req.query('customer_id');
  const phone = c.req.query('phone');

  if (!customerId && !phone) {
    return c.json({ success: false, error: 'customer_id or phone required' }, 400);
  }

  try {
    const tenantId = getTenantId(c);
    const customer = await findBirthdayCustomer(
      db,
      customerId ? { id: customerId } : { phone: phone || '' },
      tenantId
    );

    if (!customer || !customer.birthday) {
      return c.json({ success: true, data: { eligible: false, reason: 'No birthday on file' } });
    }

    let discountPercent = 15;
    let earlyWindowDays = 7;
    let lateWindowDays = 7;
    if (c.env.AUTH_KV) {
      try {
        const rawCfg = await readBirthdayConfigRaw(c.env.AUTH_KV, tenantId);
        if (rawCfg) {
          const cfg = JSON.parse(rawCfg);
          if (typeof cfg.discountPercent === 'number') discountPercent = cfg.discountPercent;
          if (typeof cfg.earlyWindowDays === 'number') earlyWindowDays = cfg.earlyWindowDays;
          if (typeof cfg.lateWindowDays === 'number') lateWindowDays = cfg.lateWindowDays;
        }
      } catch {
        // Fallback to defaults
      }
    }

    const today = new Date();
    const birthday = new Date(customer.birthday);
    const bMonth = birthday.getMonth();
    const bDate = birthday.getDate();
    const isBirthdayDay = today.getMonth() === bMonth && today.getDate() === bDate;

    // Eligible during configured birthday window (including across month/year boundaries)
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const MS_PER_DAY = 86400000;
    let isEligible = false;
    if (!Number.isNaN(birthday.getTime())) {
      for (const yearOffset of [-1, 0, 1]) {
        const candidateUtc = Date.UTC(today.getFullYear() + yearOffset, bMonth, bDate);
        const dayDiff = Math.round((todayUtc - candidateUtc) / MS_PER_DAY);
        if (dayDiff >= -earlyWindowDays && dayDiff <= lateWindowDays) {
          isEligible = true;
          break;
        }
      }
    }

    // Check if already redeemed this year
    const yearStart = `${today.getFullYear()}-01-01`;
    const redeemed = await db.prepare(
      'SELECT id FROM birthday_redemptions WHERE customer_id = ? AND redeemed_at >= ?'
    ).bind(customer.id, yearStart).first<{ id: string }>();

    if (redeemed) {
      return c.json({
        success: true,
        data: {
          eligible: false,
          customer_id: customer.id,
          customer_name: customer.name,
          birthday: customer.birthday,
          reason: 'Already redeemed this year'
        }
      });
    }

    return c.json({
      success: true,
      data: {
        eligible: isEligible,
        customer_id: customer.id,
        customer_name: customer.name,
        birthday: customer.birthday,
        discount_percent: isEligible ? discountPercent : 0,
        is_birthday_today: isBirthdayDay
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: msg }, 500);
  }
});

// POST /api/birthday/redeem — redeem birthday discount
birthdayRouter.post(
  '/redeem',
  async (c, next) => {
    const isProd = c.env?.ENVIRONMENT === 'production';
    if ((isProd && c.env?.JWT_SECRET) || c.req.header('Authorization')) {
      return requireAuth(['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier', 'customer'])(c, next);
    }
    await next();
  },
  async(c) => {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c);
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemBirthdaySchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;
  const user = c.get('user' as any) as { id?: string; role?: string } | undefined;
  if (user?.role === 'customer' && user.id && user.id !== data.customer_id) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const customer = await findBirthdayCustomer(db, { id: data.customer_id }, tenantId);

  if (!customer || !customer.birthday) {
    return c.json({ success: false, error: 'Customer not found or no birthday' }, 404);
  }

  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;

  const redeemed = await db.prepare(
    'SELECT id FROM birthday_redemptions WHERE customer_id = ? AND redeemed_at >= ?'
  ).bind(customer.id, yearStart).first<{ id: string }>();

  if (redeemed) {
    return c.json({ success: false, error: 'Already redeemed this year' }, 400);
  }

  if (data.order_id) {
    let orderRow: { id: string; tenant_id?: string | null } | null = null;
    try {
      orderRow = await db
        .prepare('SELECT id, tenant_id FROM orders WHERE id = ?')
        .bind(data.order_id)
        .first<{ id: string; tenant_id?: string | null }>();
    } catch {
      orderRow = await db
        .prepare('SELECT id FROM orders WHERE id = ?')
        .bind(data.order_id)
        .first<{ id: string }>()
        .catch(() => null);
    }
    if (orderRow && !matchesTenantRow(orderRow as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
  }

  let discountPercent = 15;
  if (c.env.AUTH_KV) {
    try {
      const rawCfg = await readBirthdayConfigRaw(c.env.AUTH_KV, tenantId);
      if (rawCfg) {
        const cfg = JSON.parse(rawCfg);
        if (typeof cfg.discountPercent === 'number') discountPercent = cfg.discountPercent;
      }
    } catch {
      // Fallback
    }
  }

  const id = makeBirthdayRedemptionId();
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO birthday_redemptions (id, customer_id, discount_percent, order_id, redeemed_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, customer.id, discountPercent, data.order_id || null, now).run();

  return c.json({
    success: true,
    data: { id, customer_id: customer.id, discount_percent: discountPercent, redeemed_at: now }
  }, 201);
});
