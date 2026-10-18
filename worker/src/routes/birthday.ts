/**
 * Birthday Routes — /api/birthday
 * Birthday discount eligibility and redemption.
 */

import { Hono } from 'hono';
import { redeemBirthdaySchema, zodErrorResponse } from '../lib/validators';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';


export const birthdayRouter = new Hono<{ Bindings: Env }>();

type BirthdayCustomerRow = {
  id: string;
  name: string;
  phone?: string;
  birthday?: string | null;
  date_of_birth?: string | null;
};

async function findBirthdayCustomer(
  db: Env['AURA_DB'],
  by: { id?: string; phone?: string }
): Promise<{ id: string; name: string; phone: string; birthday: string } | null> {
  const col = by.id ? 'id' : 'phone';
  const val = by.id ?? by.phone ?? '';
  let row: BirthdayCustomerRow | null = null;
  try {
    row = await db
      .prepare(`SELECT id, name, phone, date_of_birth AS birthday FROM customers WHERE ${col} = ?`)
      .bind(val)
      .first<BirthdayCustomerRow>();
  } catch {
    row = await db
      .prepare(`SELECT id, name, phone, birthday FROM customers WHERE ${col} = ?`)
      .bind(val)
      .first<BirthdayCustomerRow>();
  }
  if (!row) return null;
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
birthdayRouter.get('/config', async (c) => {
  try {
    const raw = await c.env.AUTH_KV?.get('config:birthday');
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
    if (c.env?.JWT_SECRET) {
      return requireAuth(['owner', 'manager', 'admin', 'staff'])(c, next);
    }
    await next();
  },
  async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<typeof DEFAULT_BIRTHDAY_CONFIG>;
  const raw = await c.env.AUTH_KV?.get('config:birthday');
  const prev = raw ? (JSON.parse(raw) as Partial<typeof DEFAULT_BIRTHDAY_CONFIG>) : {};
  const next = {
    discountPercent: typeof body.discountPercent === 'number' ? body.discountPercent : Number(prev.discountPercent ?? DEFAULT_BIRTHDAY_CONFIG.discountPercent),
    freeItemEnabled: typeof body.freeItemEnabled === 'boolean' ? body.freeItemEnabled : Boolean(prev.freeItemEnabled ?? DEFAULT_BIRTHDAY_CONFIG.freeItemEnabled),
    earlyWindowDays: typeof body.earlyWindowDays === 'number' ? body.earlyWindowDays : Number(prev.earlyWindowDays ?? DEFAULT_BIRTHDAY_CONFIG.earlyWindowDays),
    lateWindowDays: typeof body.lateWindowDays === 'number' ? body.lateWindowDays : Number(prev.lateWindowDays ?? DEFAULT_BIRTHDAY_CONFIG.lateWindowDays),
    autoSendEnabled: typeof body.autoSendEnabled === 'boolean' ? body.autoSendEnabled : Boolean(prev.autoSendEnabled ?? DEFAULT_BIRTHDAY_CONFIG.autoSendEnabled),
  };
  await c.env.AUTH_KV?.put('config:birthday', JSON.stringify(next));
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
    const customer = await findBirthdayCustomer(
      db,
      customerId ? { id: customerId } : { phone: phone || '' }
    );

    if (!customer || !customer.birthday) {
      return c.json({ success: true, data: { eligible: false, reason: 'No birthday on file' } });
    }

    let discountPercent = 15;
    let earlyWindowDays = 7;
    let lateWindowDays = 7;
    if (c.env.AUTH_KV) {
      try {
        const rawCfg = await c.env.AUTH_KV.get('config:birthday');
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
    const isBirthdayMonth = today.getMonth() === birthday.getMonth();
    const isBirthdayDay = isBirthdayMonth && today.getDate() === birthday.getDate();

    // Eligible during configured birthday window
    const dayDiff = today.getDate() - birthday.getDate();
    const isEligible = isBirthdayMonth && (dayDiff >= -earlyWindowDays && dayDiff <= lateWindowDays);

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
birthdayRouter.post('/redeem', async(c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemBirthdaySchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  const customer = await findBirthdayCustomer(db, { id: data.customer_id });

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

  let discountPercent = 15;
  if (c.env.AUTH_KV) {
    try {
      const rawCfg = await c.env.AUTH_KV.get('config:birthday');
      if (rawCfg) {
        const cfg = JSON.parse(rawCfg);
        if (typeof cfg.discountPercent === 'number') discountPercent = cfg.discountPercent;
      }
    } catch {
      // Fallback
    }
  }

  const id = `bday_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO birthday_redemptions (id, customer_id, discount_percent, order_id, redeemed_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, customer.id, discountPercent, data.order_id || null, now).run();

  return c.json({
    success: true,
    data: { id, customer_id: customer.id, discount_percent: discountPercent, redeemed_at: now }
  }, 201);
});
