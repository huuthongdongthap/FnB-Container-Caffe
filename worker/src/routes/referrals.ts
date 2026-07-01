/**
 * Referral Routes — "Gi?i thieu ban be"
 * Converted from routes/referrals.js with TypeScript.
 * v3: flat 10,000d cashback on first order >= 20k. Legacy v1 (100 points) preserved.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { verifyJWT } from '../lib/jwt';
import { referralApplySchema } from '../lib/validators';
import type { Env } from '../types/env';
import type { Customer, ReferralCode, Referral, CashbackWallet } from '../types/models';
import type { D1Database } from '@cloudflare/workers-types';

export const referralRouter = new Hono<{ Bindings: Env }>();

function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function genReferralCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FNB-';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const requireCustomer: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const payload = await verifyJWT(auth.substring(7), c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const customer = await c.env.AURA_DB.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE email = ?'
  ).bind(payload.email).first<Customer>();
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  c.set('customer', customer as unknown as Record<string, unknown>);
  await next();
}

referralRouter.use('/*', requireCustomer);

referralRouter.get('/code', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  let rc = await db.prepare('SELECT * FROM referral_codes WHERE customer_id = ?').bind(cust.id).first<ReferralCode>();

  if (!rc) {
    let code: string, attempts = 0;
    do {
      code = genReferralCode();
      const exists = await db.prepare('SELECT id FROM referral_codes WHERE code = ?').bind(code).first<{ id: string }>();
      if (!exists) { break; }
      attempts++;
    } while (attempts < 5);

    let codeId = genId('refc_');
    const now = new Date().toISOString();
    let inserted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.prepare('INSERT INTO referral_codes (id, customer_id, code, times_used, total_points_earned, created_at) VALUES (?, ?, ?, 0, 0, ?)').bind(attempt === 0 ? codeId : codeId + attempt, cust.id, code, now).run();
        inserted = true;
        break;
      } catch (e) {
        if ((e as Error).message && (e as Error).message!.includes('UNIQUE')) {
          codeId = genId('refc_');
          continue;
        }
        throw e;
      }
    }
    if (!inserted) {
      return c.json({ success: false, error: 'Không thể tạo mã giới thiệu. Vui lòng thử lại sau.' }, 500);
    }
    rc = { id: codeId, customer_id: cust.id, code, times_used: 0, total_points_earned: 0, created_at: now };
  }

  return c.json({
    success: true,
    data: {
      code: rc.code,
      times_used: rc.times_used,
      total_points_earned: rc.total_points_earned,
      created_at: rc.created_at,
    },
  });
});

referralRouter.post('/apply', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = referralApplySchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const { code } = parsed.data;

  const normalized = code.trim().toUpperCase();

  const rc = await db.prepare('SELECT * FROM referral_codes WHERE code = ?').bind(normalized).first<ReferralCode>();
  if (!rc) {
    return c.json({ success: false, error: 'M? gi?i thi?u khong t?n t?i' }, 404);
  }
  if (rc.customer_id === cust.id) {
    return c.json({ success: false, error: 'Không thể tự giới thiệu chính mình' }, 400);
  }

  const existing = await db.prepare('SELECT id FROM referrals WHERE referred_customer_id = ?').bind(cust.id).first<{ id: string }>();
  if (existing) {
    return c.json({ success: false, error: 'B?n d? s? d?ng m? gi?i thi?u tru?c d?y' }, 409);
  }

  const referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string }>();
  if (!referrer) {
    return c.json({ success: false, error: 'Người giới thiệu không tồn tại' }, 404);
  }

  const REFERRER_CASHBACK_VND = 10000;
  const MIN_ORDER_REQUIRED = 20000;
  const now = new Date().toISOString();
  const refId = genId('ref_');

  const newIp = c.req.header('CF-Connecting-IP');
  if (newIp) {
    const referrerIpRow = await db.prepare('SELECT last_ip FROM customers WHERE id = ?').bind(referrer.id).first<{ last_ip: string }>();
    if (referrerIpRow?.last_ip && referrerIpRow.last_ip === newIp) {
      return c.json({ success: false, error: 'Không thể tự giới thiệu chính mình' }, 400);
    }
  }

  await db.prepare(
    `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, created_at)
     VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
  ).bind(refId, referrer.id, cust.id, normalized, REFERRER_CASHBACK_VND, 'pending', now).run();

  await db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?').bind(rc.id).run();

  return c.json({
    success: true,
    data: {
      referrer_cashback_pending: REFERRER_CASHBACK_VND,
      min_order_required: MIN_ORDER_REQUIRED,
      message: 'Da ghi nh?n! Ngu?i gi?i thi?u s? nh?n 10.000d vao vi khi b?n c? d?n d?u >= 20.000d.',
    },
  });
});

referralRouter.get('/stats', async (c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;

  const rc = await db.prepare('SELECT * FROM referral_codes WHERE customer_id = ?').bind(cust.id).first<ReferralCode>();

  const { results: refCount } = await db.prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?').bind(cust.id).all<{ cnt: number }>();

  const { results: recentRefs } = await db.prepare(
    `SELECT r.*, c.name as referred_name, c.phone as referred_phone
     FROM referrals r LEFT JOIN customers c ON r.referred_customer_id = c.id
     WHERE r.referrer_id = ? ORDER BY r.created_at DESC LIMIT 20`
  ).bind(cust.id).all();

  const { results: cashbackEarned } = await db.prepare(
    'SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ?'
  ).bind(cust.id, 'completed').all<{ total: number }>();

  return c.json({
    success: true,
    data: {
      referral_code: rc?.code || null,
      total_referrals: refCount[0]?.cnt || 0,
      total_cashback_earned_vnd: cashbackEarned[0]?.total || 0,
      total_points_earned_legacy: rc?.total_points_earned || 0,
      code_usage: rc?.times_used || 0,
      recent_referrals: recentRefs || [],
    },
  });
});

export async function applyReferralForNewCustomer(db: D1Database, newCustomerId: string, referralCode: string): Promise<Record<string, unknown>> {
  if (!referralCode) { return { success: false, reason: 'no_code' }; }

  const normalized = referralCode.trim().toUpperCase();
  const rc = await db.prepare('SELECT * FROM referral_codes WHERE code = ?').bind(normalized).first<ReferralCode>();
  if (!rc) { return { success: false, reason: 'invalid_code' }; }
  if (rc.customer_id === newCustomerId) { return { success: false, reason: 'self_referral' }; }

  const pending = await db.prepare('SELECT id, bonus_type FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(newCustomerId, 'pending').first<{ id: string; bonus_type: string | null }>();
  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }
  if (pending.bonus_type === 'points') { return { success: false, reason: 'already_processed_points' }; }

  const referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string }>();
  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const REFERRER_CASHBACK_VND = 10000;
  const now = new Date().toISOString();
  const refId = genId('ref_');

  await db.prepare(
    `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, created_at)
     VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
  ).bind(refId, referrer.id, newCustomerId, normalized, REFERRER_CASHBACK_VND, 'pending', now).run();

  await db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?').bind(rc.id).run();
  return { success: true, referrer_cashback_pending: REFERRER_CASHBACK_VND };
}

export async function processReferralOnFirstOrder(db: D1Database, customerId: string): Promise<Record<string, unknown>> {
  const pending = await db.prepare('SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(customerId, 'pending').first<Referral>();
  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }

  const referrer = await db.prepare('SELECT id, loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = ?').bind(pending.referrer_id).first<Customer>();
  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const POINTS = pending.points_awarded || 100;
  const now = new Date().toISOString();
  const newPoints = (referrer.loyalty_points || 0) + POINTS;
  const newLifetimePoints = (referrer.lifetime_points || 0) + POINTS;

  await db.prepare('UPDATE customers SET loyalty_points = ?, lifetime_points = ?, updated_at = ? WHERE id = ?').bind(newPoints, newLifetimePoints, now, referrer.id).run();
  await db.prepare(
    'INSERT INTO loyalty_point_logs (id, customer_id, points_change, reason, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(genId('ptl_'), referrer.id, POINTS, 'referral', newPoints, 'Gi?i thi?u b?n: +' + POINTS + ' di?m (legacy)', now).run();

  await db.prepare('UPDATE referrals SET status = ?, bonus_type = ? WHERE id = ?').bind('completed', 'points', pending.id).run();
  await db.prepare('UPDATE referral_codes SET total_points_earned = total_points_earned + ? WHERE code = ?').bind(POINTS, pending.referral_code).run();

  return { success: true, points_awarded: POINTS, new_balance: newPoints, new_lifetime_balance: newLifetimePoints };
}

export async function processReferralCashbackOnFirstOrder(db: D1Database, customerId: string, orderId: string, orderAmount: number): Promise<Record<string, unknown>> {
  const MIN_ORDER_AMOUNT = 20000;
  const REFERRER_CASHBACK_VND = 10000;

  if (orderAmount < MIN_ORDER_AMOUNT) {
    return { success: false, reason: 'order_below_min', min_required: MIN_ORDER_AMOUNT };
  }

  const pending = await db.prepare('SELECT * FROM referrals WHERE referred_customer_id = ? AND status = ?').bind(customerId, 'pending').first<Referral>();
  if (!pending) { return { success: false, reason: 'no_pending_referral' }; }

  if (pending.bonus_type === 'points') { return { success: false, reason: 'already_processed_points' }; }

  const referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(pending.referrer_id).first<{ id: string }>();
  if (!referrer) { return { success: false, reason: 'referrer_not_found' }; }

  const now = new Date().toISOString();
  let wallet = await db.prepare('SELECT id, balance, total_earned FROM cashback_wallets WHERE customer_id = ?').bind(referrer.id).first<CashbackWallet>();
  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(walletId, referrer.id, now));
    wallet = { id: walletId, customer_id: referrer.id, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = (wallet.balance || 0) + REFERRER_CASHBACK_VND;
  const txId = genId('cbt_');

  batch.push(db.prepare('UPDATE cashback_wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(REFERRER_CASHBACK_VND, REFERRER_CASHBACK_VND, now, wallet.id));
  batch.push(db.prepare(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
     VALUES (?, ?, ?, 'bonus', ?, ?, ?, datetime('now', '+90 days'), ?)`
  ).bind(txId, wallet.id, referrer.id, REFERRER_CASHBACK_VND, newBalance, 'Gi?i thi?u b?n (referral_id=' + pending.id + '): +' + REFERRER_CASHBACK_VND + 'd cashback', now));
  batch.push(db.prepare(
    `UPDATE referrals SET status = 'completed', cashback_awarded_vnd = ?, first_order_id = ?, first_order_amount = ?, reward_paid_at = ? WHERE id = ?`
  ).bind(REFERRER_CASHBACK_VND, orderId, orderAmount, now, pending.id));
  batch.push(db.prepare(
    `INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at)
     VALUES (?, 'referral_cashback', ?, ?, ?, ?)`
  ).bind(referrer.id, REFERRER_CASHBACK_VND, orderId, JSON.stringify({ referral_id: pending.id, referred_customer_id: customerId, order_amount: orderAmount }), now));

  await db.batch(batch);

  return { success: true, referrer_id: referrer.id, cashback_awarded_vnd: REFERRER_CASHBACK_VND, new_balance: newBalance };
}

export async function reverseReferralCashback(db: D1Database, referralId: string): Promise<Record<string, unknown>> {
  const referral = await db.prepare('SELECT * FROM referrals WHERE id = ? AND status = ?').bind(referralId, 'completed').first<Referral>();
  if (!referral || !referral.cashback_awarded_vnd) {
    return { success: false, reason: 'not_applicable' };
  }

  const DEBIT_VND = referral.cashback_awarded_vnd;
  const referrerId = referral.referrer_id;
  const now = new Date().toISOString();

  let wallet = await db.prepare('SELECT id, balance FROM cashback_wallets WHERE customer_id = ?').bind(referrerId).first<CashbackWallet>();
  const batch: ReturnType<typeof db.prepare>[] = [];

  if (!wallet) {
    const walletId = genId('cbw_');
    batch.push(db.prepare('INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at) VALUES (?, ?, 0, 0, 0, ?)').bind(walletId, referrerId, now));
    wallet = { id: walletId, customer_id: referrerId, balance: 0, total_earned: 0, total_spent: 0, created_at: now, updated_at: now };
  }

  const newBalance = Math.max(0, (wallet.balance || 0) - DEBIT_VND);
  const txId = genId('cbt_');

  batch.push(db.prepare('UPDATE cashback_wallets SET balance = ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ?').bind(newBalance, DEBIT_VND, now, wallet.id));
  batch.push(db.prepare(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, description, expires_at, created_at)
     VALUES (?, ?, ?, 'debit', ?, ?, ?, NULL, ?)`
  ).bind(txId, wallet.id, referrerId, DEBIT_VND, newBalance, 'Hoan ti?n referral (' + referralId + '): -' + DEBIT_VND + 'd do don hang bi h?y', now));
  batch.push(db.prepare('UPDATE referrals SET status = ?, reward_paid_at = ? WHERE id = ?').bind('reversed', now, referralId));
  batch.push(db.prepare(
    'INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(referrerId, 'referral_reversed', DEBIT_VND, null, JSON.stringify({ referral_id: referralId, reason: 'order_cancelled', debited: DEBIT_VND }), now));

  await db.batch(batch);
  return { success: true, debited_vnd: DEBIT_VND, new_balance: newBalance };
}
