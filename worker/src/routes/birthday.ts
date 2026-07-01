/**
 * Birthday Routes — /api/birthday
 * Birthday discount eligibility and redemption.
 */

import { Hono } from 'hono';
import { redeemBirthdaySchema } from '../lib/validators';
import type { Env } from '../types/env';

interface BirthdayEligibility {
  eligible: boolean;
  customer_id?: string;
  customer_name?: string;
  birthday?: string;
  discount_percent?: number;
  reason?: string;
}

interface BirthdayRedemption {
  id: string;
  customer_id: string;
  discount_percent: number;
  order_id?: string;
  redeemed_at: string;
}

export const birthdayRouter = new Hono<{ Bindings: Env }>();

// GET /api/birthday/check — check eligibility
birthdayRouter.get('/check', async (c) => {
  const db = c.env.AURA_DB;
  const customerId = c.req.query('customer_id');
  const phone = c.req.query('phone');

  if (!customerId && !phone) {
    return c.json({ success: false, error: 'customer_id or phone required' }, 400);
  }

  try {
    let customer: { id: string; name: string; phone: string; birthday: string } | null = null;

    if (customerId) {
      customer = await db.prepare(
        'SELECT id, name, phone, birthday FROM customers WHERE id = ?'
      ).bind(customerId).first<{ id: string; name: string; phone: string; birthday: string }>();
    } else if (phone) {
      customer = await db.prepare(
        'SELECT id, name, phone, birthday FROM customers WHERE phone = ?'
      ).bind(phone).first<{ id: string; name: string; phone: string; birthday: string }>();
    }

    if (!customer || !customer.birthday) {
      return c.json({ success: true, data: { eligible: false, reason: 'No birthday on file' } });
    }

    const today = new Date();
    const birthday = new Date(customer.birthday);
    const isBirthdayMonth = today.getMonth() === birthday.getMonth();
    const isBirthdayDay = isBirthdayMonth && today.getDate() === birthday.getDate();

    // Eligible during birthday month (7 days before and after)
    const daysDiff = Math.abs(today.getDate() - birthday.getDate());
    const isEligible = isBirthdayMonth && daysDiff <= 7;

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
          reason: 'Already redeemed this year',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        eligible: isEligible,
        customer_id: customer.id,
        customer_name: customer.name,
        birthday: customer.birthday,
        discount_percent: isEligible ? 15 : 0,
        is_birthday_today: isBirthdayDay,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: msg }, 500);
  }
});

// POST /api/birthday/redeem — redeem birthday discount
birthdayRouter.post('/redeem', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = redeemBirthdaySchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const data = parsed.data;

  const customer = await db.prepare(
    'SELECT id, name, birthday FROM customers WHERE id = ?'
  ).bind(data.customer_id).first<{ id: string; name: string; birthday: string }>();

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

  const id = 'bday_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO birthday_redemptions (id, customer_id, discount_percent, order_id, redeemed_at) VALUES (?, ?, 15, ?, ?)'
  ).bind(id, customer.id, data.order_id || null, now).run();

  return c.json({
    success: true,
    data: { id, customer_id: customer.id, discount_percent: 15, redeemed_at: now },
  }, 201);
});
