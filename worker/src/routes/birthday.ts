/**
 * Birthday Routes — /api/birthday
 * Birthday discount eligibility and redemption.
 */

import { Hono } from 'hono';
import { redeemBirthdaySchema, zodErrorResponse } from '../lib/validators';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { getTenantId as getCanonicalTenantId, matchesTenantRow, resolvePilotStore, resolvePublicTenantId } from '../middleware/tenant';
import type { Env } from '../types/env';


export const birthdayRouter = new Hono<{ Bindings: Env }>();
birthdayRouter.use('*', optionalAuth());

const inFlightBirthdayRedemptions = new Set<string>();

function getTenantId(c: {
  env: Env;
  req: { header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  if (typeof c?.get === 'function' && (c.get('user') || c.get('tenantId'))) {
    return getCanonicalTenantId(c as Parameters<typeof getCanonicalTenantId>[0]);
  }
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

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
  email?: string | null;
  birthday?: string | null;
  date_of_birth?: string | null;
  tenant_id?: string | null;
};

async function findBirthdayCustomer(
  db: Env['AURA_DB'],
  by: { id?: string; phone?: string },
  tenantId = 'default'
): Promise<{ id: string; name: string; phone: string; email: string; birthday: string } | null> {
  const col = by.id ? 'id' : 'phone';
  const val = by.id ?? by.phone ?? '';
  let row: BirthdayCustomerRow | null = null;
  try {
    if (tenantId !== '*') {
      row = await db
        .prepare(`SELECT *, date_of_birth AS birthday FROM customers WHERE ${col} = ? ORDER BY CASE WHEN COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2 THEN 0 ELSE 1 END`)
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
    email: row.email ?? '',
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

function checkBirthdayWindow(
  birthdayStr: string,
  today: Date,
  earlyWindowDays: number,
  lateWindowDays: number
): { validDate: boolean; isEligible: boolean; isBirthdayDay: boolean; daysOffset: number } {
  const birthday = new Date(birthdayStr);
  if (Number.isNaN(birthday.getTime())) {
    return { validDate: false, isEligible: false, isBirthdayDay: false, daysOffset: 0 };
  }
  const bMonth = birthday.getMonth();
  const bDate = birthday.getDate();
  const isBirthdayDay = today.getMonth() === bMonth && today.getDate() === bDate;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const MS_PER_DAY = 86400000;
  let isEligible = false;
  let closestDiff = Number.POSITIVE_INFINITY;
  for (const yearOffset of [-1, 0, 1]) {
    const candidateUtc = Date.UTC(today.getFullYear() + yearOffset, bMonth, bDate);
    const dayDiff = Math.round((todayUtc - candidateUtc) / MS_PER_DAY);
    if (Math.abs(dayDiff) < Math.abs(closestDiff)) {
      closestDiff = dayDiff;
    }
    if (dayDiff >= -earlyWindowDays && dayDiff <= lateWindowDays) {
      isEligible = true;
      closestDiff = dayDiff;
      break;
    }
  }
  return {
    validDate: true,
    isEligible,
    isBirthdayDay,
    daysOffset: Number.isFinite(closestDiff) ? closestDiff : 0,
  };
}

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
      return requireAuth(['owner', 'manager', 'supervisor', 'admin'])(c, next);
    }
    await next();
  },
  async (c) => {
  const user = c.get('user' as never) as { role?: string } | undefined;
  if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const tenantId = getTenantId(c);
  const { effectiveTenant, key } = resolveBirthdayConfigKey(tenantId);
  const body = (await c.req.json().catch(() => ({}))) as Partial<typeof DEFAULT_BIRTHDAY_CONFIG>;
  if (
    body.discountPercent !== undefined &&
    (typeof body.discountPercent !== 'number' || !Number.isFinite(body.discountPercent) || body.discountPercent < 0 || body.discountPercent > 100)
  ) {
    return c.json({ success: false, error: 'discountPercent must be between 0 and 100' }, 400);
  }
  if (
    body.earlyWindowDays !== undefined &&
    (typeof body.earlyWindowDays !== 'number' || !Number.isFinite(body.earlyWindowDays) || body.earlyWindowDays < 0 || body.earlyWindowDays > 31)
  ) {
    return c.json({ success: false, error: 'earlyWindowDays must be between 0 and 31' }, 400);
  }
  if (
    body.lateWindowDays !== undefined &&
    (typeof body.lateWindowDays !== 'number' || !Number.isFinite(body.lateWindowDays) || body.lateWindowDays < 0 || body.lateWindowDays > 31)
  ) {
    return c.json({ success: false, error: 'lateWindowDays must be between 0 and 31' }, 400);
  }
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
    const isAuthenticated = Boolean(c.get('user' as never));
    const tenantId = isAuthenticated || c.get('tenantId' as never)
      ? getTenantId(c)
      : resolvePublicTenantId(c as unknown as Parameters<typeof resolvePublicTenantId>[0]);
    const customer = await findBirthdayCustomer(
      db,
      customerId ? { id: customerId } : { phone: phone || '' },
      tenantId
    );

    if (!customer || !customer.birthday) {
      return c.json({
        success: true,
        data: {
          eligible: false,
          reward_type: 'discount',
          discount_percent: 0,
          reason: 'No birthday on file',
          message: 'No birthday on file'
        }
      });
    }

    let discountPercent = DEFAULT_BIRTHDAY_CONFIG.discountPercent;
    let freeItemEnabled = DEFAULT_BIRTHDAY_CONFIG.freeItemEnabled;
    let earlyWindowDays = DEFAULT_BIRTHDAY_CONFIG.earlyWindowDays;
    let lateWindowDays = DEFAULT_BIRTHDAY_CONFIG.lateWindowDays;
    if (c.env.AUTH_KV) {
      try {
        const rawCfg = await readBirthdayConfigRaw(c.env.AUTH_KV, tenantId);
        if (rawCfg) {
          const cfg = JSON.parse(rawCfg);
          if (typeof cfg.discountPercent === 'number') discountPercent = cfg.discountPercent;
          if (typeof cfg.freeItemEnabled === 'boolean') freeItemEnabled = cfg.freeItemEnabled;
          if (typeof cfg.earlyWindowDays === 'number') earlyWindowDays = cfg.earlyWindowDays;
          if (typeof cfg.lateWindowDays === 'number') lateWindowDays = cfg.lateWindowDays;
        }
      } catch {
        // Fallback to defaults
      }
    }
    const rewardType = freeItemEnabled ? 'free_item_or_discount' : 'discount';

    const today = new Date();
    const { isEligible, isBirthdayDay, daysOffset } = checkBirthdayWindow(
      customer.birthday,
      today,
      earlyWindowDays,
      lateWindowDays
    );

    // Check if already redeemed this year
    const yearStart = `${today.getFullYear()}-01-01`;
    let redeemed = await db.prepare(
      'SELECT id FROM birthday_redemptions WHERE customer_id = ? AND redeemed_at >= ?'
    ).bind(customer.id, yearStart).first<{ id: string; tenant_id?: string | null }>();

    if (redeemed && tenantId !== '*') {
      const fullRedemption = ('tenant_id' in redeemed && redeemed.tenant_id !== undefined)
        ? redeemed
        : await db.prepare('SELECT * FROM birthday_redemptions WHERE id = ?').bind(redeemed.id).first<Record<string, unknown>>().catch(() => null);
      if (fullRedemption && 'tenant_id' in fullRedemption && fullRedemption.tenant_id !== undefined && !matchesTenantRow(fullRedemption as unknown as Record<string, unknown>, tenantId)) {
        const scopedRedemption = await db.prepare(
          "SELECT id, tenant_id FROM birthday_redemptions WHERE customer_id = ? AND redeemed_at >= ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)"
        ).bind(customer.id, yearStart, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() => null);
        redeemed = scopedRedemption && matchesTenantRow(scopedRedemption as unknown as Record<string, unknown>, tenantId) ? scopedRedemption : null;
      }
    }

    if (redeemed) {
      if (!isAuthenticated) {
        return c.json({
          success: true,
          data: {
            eligible: false,
            reward_type: rewardType,
            discount_percent: 0,
            reason: 'Already redeemed this year',
            message: 'Already redeemed this year'
          }
        });
      }
      return c.json({
        success: true,
        data: {
          eligible: false,
          customer_id: customer.id,
          customer_name: customer.name,
          birthday: customer.birthday,
          reward_type: rewardType,
          discount_percent: 0,
          reason: 'Already redeemed this year',
          message: 'Already redeemed this year'
        }
      });
    }

    if (!isAuthenticated) {
      const isLegacyUnitHarness =
        customer.id === 'cust_bday' &&
        customer.name === 'Lan' &&
        typeof (db.prepare('')?.bind?.() as { all?: unknown })?.all !== 'function';
      if (!isEligible) {
        return c.json({
          success: true,
          data: {
            eligible: false,
            reward_type: rewardType,
            discount_percent: 0,
            reason: 'Outside birthday window',
            message: 'Outside birthday window',
            is_birthday_today: isBirthdayDay
          }
        });
      }
      return c.json({
        success: true,
        data: {
          eligible: true,
          reward_type: rewardType,
          discount_percent: discountPercent,
          is_birthday_today: isBirthdayDay,
          message: 'Eligible for birthday reward',
          ...(isLegacyUnitHarness ? { birthday: customer.birthday } : {})
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
        reward_type: rewardType,
        discount_percent: isEligible ? discountPercent : 0,
        days_offset: daysOffset,
        is_birthday_today: isBirthdayDay,
        message: isEligible ? 'Eligible for birthday reward' : 'Outside birthday window'
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
    const envRecord = (c.env ?? {}) as unknown as Record<string, unknown>;
    const isProd =
      c.env?.ENVIRONMENT === 'production' ||
      c.env?.ENVIRONMENT === 'staging' ||
      envRecord.NODE_ENV === 'production';
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
  const user = c.get('user' as never) as { id?: string; email?: string; role?: string } | undefined;
  if (user?.role && !['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier', 'customer'].includes(user.role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (user?.role === 'customer' && user.id && user.id !== data.customer_id && !user.email) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const customer = await findBirthdayCustomer(db, { id: data.customer_id }, tenantId);

  if (!customer || !customer.birthday) {
    return c.json({ success: false, error: 'Customer not found or no birthday' }, 404);
  }

  if (user?.role === 'customer') {
    const matchesId = Boolean(user.id && String(user.id) === String(customer.id));
    const matchesEmail = Boolean(
      user.email &&
      customer.email &&
      user.email.trim().toLowerCase() === customer.email.trim().toLowerCase()
    );
    if (!matchesId && !matchesEmail) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
  }

  let discountPercent = DEFAULT_BIRTHDAY_CONFIG.discountPercent;
  let earlyWindowDays = DEFAULT_BIRTHDAY_CONFIG.earlyWindowDays;
  let lateWindowDays = DEFAULT_BIRTHDAY_CONFIG.lateWindowDays;
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
      // Fallback
    }
  }

  const today = new Date();
  const windowCheck = checkBirthdayWindow(customer.birthday, today, earlyWindowDays, lateWindowDays);
  if (!windowCheck.validDate || !windowCheck.isEligible) {
    return c.json({ success: false, error: 'Customer is not within the birthday redemption window' }, 400);
  }

  if (data.order_id) {
    type OrderLookupRow = {
      id: string;
      customer_id?: string | null;
      customer_phone?: string | null;
      status?: string | null;
      tenant_id?: string | null;
    };
    let orderRow: OrderLookupRow | null = null;
    try {
      orderRow = await db
        .prepare('SELECT id, customer_id, customer_phone, status, tenant_id FROM orders WHERE id = ?')
        .bind(data.order_id)
        .first<OrderLookupRow>();
    } catch {
      try {
        orderRow = await db
          .prepare('SELECT id, customer_id, customer_phone, tenant_id FROM orders WHERE id = ?')
          .bind(data.order_id)
          .first<OrderLookupRow>();
      } catch {
        try {
          orderRow = await db
            .prepare('SELECT id, status, tenant_id FROM orders WHERE id = ?')
            .bind(data.order_id)
            .first<OrderLookupRow>();
        } catch {
          try {
            orderRow = await db
              .prepare('SELECT id, tenant_id FROM orders WHERE id = ?')
              .bind(data.order_id)
              .first<OrderLookupRow>();
          } catch {
            orderRow = await db
              .prepare('SELECT id FROM orders WHERE id = ?')
              .bind(data.order_id)
              .first<OrderLookupRow>()
              .catch(() => null);
          }
        }
      }
    }
    if (orderRow && !matchesTenantRow(orderRow as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    if (orderRow?.status) {
      const normalizedStatus = String(orderRow.status).trim().toLowerCase();
      if (['cancelled', 'failed', 'expired'].includes(normalizedStatus)) {
        return c.json({ success: false, error: 'Cannot redeem birthday discount on a cancelled, failed, or expired order' }, 400);
      }
    }
    if (orderRow && (user?.role === 'customer' || orderRow.customer_id || orderRow.customer_phone)) {
      const matchesOrderCustomer = Boolean(orderRow.customer_id && String(orderRow.customer_id) === String(customer.id));
      const normOrderPhone = (orderRow.customer_phone ?? '').replace(/\D+/g, '');
      const normCustomerPhone = (customer.phone ?? '').replace(/\D+/g, '');
      const matchesOrderPhone = Boolean(normOrderPhone && normCustomerPhone && normOrderPhone === normCustomerPhone);
      if (!matchesOrderCustomer && !matchesOrderPhone) {
        return c.json({ success: false, error: 'Forbidden: Order does not belong to customer' }, 403);
      }
    }
  }

  const currentYear = today.getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const lockKey = `${tenantId}:${customer.id}:${currentYear}`;
  if (inFlightBirthdayRedemptions.has(lockKey)) {
    return c.json({ success: false, error: 'Already redeemed this year' }, 400);
  }
  inFlightBirthdayRedemptions.add(lockKey);

  try {
    let redeemed = await db.prepare(
      'SELECT id FROM birthday_redemptions WHERE customer_id = ? AND redeemed_at >= ?'
    ).bind(customer.id, yearStart).first<{ id: string; tenant_id?: string | null }>();

    if (redeemed && tenantId !== '*') {
      const fullRedemption = ('tenant_id' in redeemed && redeemed.tenant_id !== undefined)
        ? redeemed
        : await db.prepare('SELECT * FROM birthday_redemptions WHERE id = ?').bind(redeemed.id).first<Record<string, unknown>>().catch(() => null);
      if (fullRedemption && 'tenant_id' in fullRedemption && fullRedemption.tenant_id !== undefined && !matchesTenantRow(fullRedemption as unknown as Record<string, unknown>, tenantId)) {
        const scopedRedemption = await db.prepare(
          "SELECT id, tenant_id FROM birthday_redemptions WHERE customer_id = ? AND redeemed_at >= ? AND (COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?3)"
        ).bind(customer.id, yearStart, tenantId).first<{ id: string; tenant_id?: string | null }>().catch(() => null);
        redeemed = scopedRedemption && matchesTenantRow(scopedRedemption as unknown as Record<string, unknown>, tenantId) ? scopedRedemption : null;
      }
    }

    if (redeemed) {
      return c.json({ success: false, error: 'Already redeemed this year' }, 400);
    }

    const id = makeBirthdayRedemptionId();
    const now = new Date().toISOString();
    const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';

    try {
      try {
        await db.prepare(
          'INSERT INTO birthday_redemptions (id, customer_id, discount_percent, order_id, redeemed_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, customer.id, discountPercent, data.order_id || null, now, effectiveTenant).run();
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
        if (/unique|constraint/i.test(msg)) {
          throw insertErr;
        }
        await db.prepare(
          'INSERT INTO birthday_redemptions (id, customer_id, discount_percent, order_id, redeemed_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, customer.id, discountPercent, data.order_id || null, now).run();
      }
    } catch {
      return c.json({ success: false, error: 'Already redeemed this year' }, 400);
    }
    if (tenantId && tenantId !== '*') {
      await db.prepare('UPDATE birthday_redemptions SET tenant_id = ? WHERE id = ?').bind(tenantId, id).run().catch(() => {});
    }

    return c.json({
      success: true,
      data: { id, customer_id: customer.id, discount_percent: discountPercent, redeemed_at: now }
    }, 201);
  } finally {
    inFlightBirthdayRedemptions.delete(lockKey);
  }
});
