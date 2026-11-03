/**
 * Referral Routes — "Gi?i thieu ban be"
 * Converted from routes/referrals.js with TypeScript.
 * v3: flat 10,000d cashback on first order >= 20k. Legacy v1 (100 points) preserved.
 */

import { Hono } from 'hono';
import { matchesTenantRow } from '../lib/db';
import { resolvePilotStore } from '../lib/pilot-store';
import { referralApplySchema } from '../lib/validators';
import { authCustomer } from '../tree/loyalty/auth-middleware';
import { rateLimitMiddleware, REFERRAL_CODE_RATE_LIMIT } from '../middleware/rate-limit';
import type { Env } from '../types/env';
import type { Customer, ReferralCode } from '../types/models';

export const referralRouter = new Hono<{ Bindings: Env }>();

function getTenantId(c: {
  env: Env;
  req?: { header?: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  const cust = c.get('customer') as { tenant_id?: string | null } | undefined;
  const user = c.get('user') as { tenantId?: string } | undefined;
  if (cust) {
    if (cust.tenant_id && String(cust.tenant_id).trim()) return String(cust.tenant_id).trim();
    if (user?.tenantId && user.tenantId.trim()) return user.tenantId.trim();
    return 'default';
  }
  if (user?.tenantId && user.tenantId.trim()) return user.tenantId.trim();
  const hdr = c.req?.header?.('X-Tenant-ID');
  if (hdr && hdr.trim()) return hdr.trim();
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

function maskPhone(phone: unknown): string | null {
  if (typeof phone !== 'string' || !phone.trim()) return null;
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return '***';
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`;
}

function genId(prefix: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + hex.slice(0, 4);
}

function genReferralCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let code = 'FNB-';
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

referralRouter.use('/*', authCustomer);

referralRouter.get('/code', rateLimitMiddleware(REFERRAL_CODE_RATE_LIMIT), async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as { env: Env; get: (k: string) => unknown });

  let rc = await db.prepare('SELECT * FROM referral_codes WHERE customer_id = ?').bind(cust.id).first<ReferralCode>();
  if (rc && 'tenant_id' in (rc as unknown as Record<string, unknown>) && (rc as unknown as Record<string, unknown>).tenant_id !== undefined && !matchesTenantRow(rc, tenantId)) {
    const scopedRc = tenantId && tenantId !== '*'
      ? await db.prepare("SELECT * FROM referral_codes WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?").bind(cust.id, tenantId).first<ReferralCode>().catch(() => null)
      : null;
    rc = scopedRc && matchesTenantRow(scopedRc as unknown as Record<string, unknown>, tenantId) ? scopedRc : null;
  }

  if (!rc) {
    let code: string, attempts = 0;
    do {
      code = genReferralCode();
      const exists = await db.prepare('SELECT id FROM referral_codes WHERE code = ?').bind(code).first<{ id: string }>();
      if (!exists) {
        break;
      }
      attempts++;
    } while (attempts < 5);

    let codeId = genId('refc_');
    let finalCodeId = codeId;
    const now = new Date().toISOString();
    let inserted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        finalCodeId = attempt === 0 ? codeId : codeId + attempt;
        await db.prepare('INSERT INTO referral_codes (id, customer_id, code, times_used, total_points_earned, created_at) VALUES (?, ?, ?, 0, 0, ?)').bind(finalCodeId, cust.id, code, now).run();
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
    if (tenantId && tenantId !== '*') {
      await db.prepare('UPDATE referral_codes SET tenant_id = ? WHERE id = ?').bind(tenantId, finalCodeId).run().catch(() => {});
    }
    rc = { id: finalCodeId, customer_id: cust.id, code, times_used: 0, total_points_earned: 0, created_at: now };
  }

  return c.json({
    success: true,
    data: {
      code: rc.code,
      times_used: rc.times_used,
      total_points_earned: rc.total_points_earned,
      created_at: rc.created_at
    }
  });
});

referralRouter.post('/apply', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = referralApplySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const { code } = parsed.data;

  const normalized = code.trim().toUpperCase();

  const rc = await db.prepare('SELECT * FROM referral_codes WHERE code = ?').bind(normalized).first<ReferralCode>();
  if (!rc) {
    return c.json({ success: false, error: 'M? gi?i thi?u khong t?n t?i' }, 404);
  }
  if (rc.customer_id === cust.id) {
    return c.json({ success: false, error: 'Không thể tự giới thiệu chính mình' }, 400);
  }
  const maxUses = (rc as unknown as { max_uses?: number | null }).max_uses;
  if (typeof maxUses === 'number' && maxUses > 0 && Number(rc.times_used ?? 0) >= maxUses) {
    return c.json({ success: false, error: 'Mã giới thiệu đã hết lượt sử dụng' }, 409);
  }

  const tenantId = getTenantId(c as unknown as { env: Env; get: (k: string) => unknown });
  if ('tenant_id' in (rc as unknown as Record<string, unknown>) && (rc as unknown as Record<string, unknown>).tenant_id !== undefined && !matchesTenantRow(rc, tenantId)) {
    return c.json({ success: false, error: 'Người giới thiệu không tồn tại' }, 404);
  }
  let referrer: { id: string; tenant_id?: string | null } | null = null;
  try {
    referrer = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string; tenant_id?: string | null }>();
  } catch {
    referrer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(rc.customer_id).first<{ id: string }>();
  }
  if (!referrer || !matchesTenantRow(referrer, tenantId)) {
    return c.json({ success: false, error: 'Người giới thiệu không tồn tại' }, 404);
  }

  let existing: { id: string; tenant_id?: string | null } | null = null;
  try {
    existing = await db.prepare('SELECT id, tenant_id FROM referrals WHERE referred_customer_id = ?').bind(cust.id).first<{ id: string; tenant_id?: string | null }>();
  } catch {
    existing = await db.prepare('SELECT id FROM referrals WHERE referred_customer_id = ?').bind(cust.id).first<{ id: string }>();
  }
  if (existing && 'tenant_id' in existing && existing.tenant_id !== undefined && !matchesTenantRow(existing, tenantId)) {
    existing = null;
  }
  if (existing) {
    return c.json({ success: false, error: 'B?n d? s? d?ng m? gi?i thi?u tru?c d?y' }, 409);
  }

  const REFERRER_CASHBACK_VND = 10000;
  const MIN_ORDER_REQUIRED = 20000;
  const now = new Date().toISOString();
  const refId = genId('ref_');

  const newIp = c.req.header('CF-Connecting-IP');
  if (newIp) {
    try {
      const referrerIpRow = await db.prepare('SELECT last_ip FROM customers WHERE id = ?').bind(referrer.id).first<{ last_ip: string }>();
      if (referrerIpRow?.last_ip && referrerIpRow.last_ip === newIp) {
        return c.json({ success: false, error: 'Không thể tự giới thiệu chính mình' }, 400);
      }
    } catch {
      // last_ip column is optional in canonical customers schema
    }
  }

  try {
    await db.prepare(
      `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, cashback_awarded_vnd, status, bonus_type, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?)`
    ).bind(refId, referrer.id, cust.id, normalized, REFERRER_CASHBACK_VND, 'pending', now).run();
  } catch {
    await db.prepare(
      `INSERT INTO referrals (id, referrer_id, referred_customer_id, referral_code, points_awarded, status, created_at)
       VALUES (?, ?, ?, ?, 0, 'pending', ?)`
    ).bind(refId, referrer.id, cust.id, normalized, now).run();
  }
  if (tenantId && tenantId !== '*') {
    await db.prepare('UPDATE referrals SET tenant_id = ? WHERE id = ?').bind(tenantId, refId).run().catch(() => {});
  }

  try {
    const usageRes = await db
      .prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ? AND (max_uses IS NULL OR max_uses <= 0 OR COALESCE(times_used, 0) < max_uses)')
      .bind(rc.id)
      .run();
    const changes = Number((usageRes as unknown as { meta?: { changes?: number } })?.meta?.changes ?? 1);
    if (changes === 0) {
      await db.prepare('DELETE FROM referrals WHERE id = ?').bind(refId).run().catch(() => {});
      return c.json({ success: false, error: 'Mã giới thiệu đã hết lượt sử dụng' }, 409);
    }
  } catch {
    await db.prepare('UPDATE referral_codes SET times_used = times_used + 1 WHERE id = ?').bind(rc.id).run();
  }

  return c.json({
    success: true,
    data: {
      referrer_cashback_pending: REFERRER_CASHBACK_VND,
      min_order_required: MIN_ORDER_REQUIRED,
      message: 'Da ghi nh?n! Ngu?i gi?i thi?u s? nh?n 10.000d vao vi khi b?n c? d?n d?u >= 20.000d.'
    }
  });
});

referralRouter.get('/stats', async(c) => {
  const cust = c.get('customer') as unknown as Customer;
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as { env: Env; get: (k: string) => unknown });

  let rc = await db.prepare('SELECT * FROM referral_codes WHERE customer_id = ?').bind(cust.id).first<ReferralCode>();
  if (rc && 'tenant_id' in (rc as unknown as Record<string, unknown>) && (rc as unknown as Record<string, unknown>).tenant_id !== undefined && !matchesTenantRow(rc, tenantId)) {
    const scopedRc = tenantId && tenantId !== '*'
      ? await db.prepare("SELECT * FROM referral_codes WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?").bind(cust.id, tenantId).first<ReferralCode>().catch(() => null)
      : null;
    rc = scopedRc && matchesTenantRow(scopedRc as unknown as Record<string, unknown>, tenantId) ? scopedRc : null;
  }

  let refCount: { cnt: number }[] = [];
  if (tenantId && tenantId !== '*') {
    try {
      const res = await db.prepare(
        "SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(cust.id, tenantId).all<{ cnt: number }>();
      refCount = res.results || [];
    } catch {
      const res = await db.prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?').bind(cust.id).all<{ cnt: number }>();
      refCount = res.results || [];
    }
  } else {
    const res = await db.prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = ?').bind(cust.id).all<{ cnt: number }>();
    refCount = res.results || [];
  }

  const { results: rawRecentRefs } = await db.prepare(
    `SELECT r.*, c.name as referred_name, c.phone as referred_phone
     FROM referrals r LEFT JOIN customers c ON r.referred_customer_id = c.id
     WHERE r.referrer_id = ? ORDER BY r.created_at DESC LIMIT 20`
  ).bind(cust.id).all();
  const recentRefs = ((rawRecentRefs || []) as Record<string, unknown>[]).filter((row) => {
    if ('tenant_id' in row && row.tenant_id !== undefined) {
      return matchesTenantRow(row, tenantId);
    }
    return true;
  });

  let cashbackEarned: { total: number }[] = [];
  if (tenantId && tenantId !== '*') {
    try {
      const res = await db.prepare(
        "SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(cust.id, 'completed', tenantId).all<{ total: number }>();
      cashbackEarned = res.results || [];
    } catch {
      try {
        const res = await db.prepare(
          'SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ?'
        ).bind(cust.id, 'completed').all<{ total: number }>();
        cashbackEarned = res.results || [];
      } catch {
        const res = await db.prepare(
          'SELECT COUNT(*) * 10000 as total FROM referrals WHERE referrer_id = ? AND status = ?'
        ).bind(cust.id, 'completed').all<{ total: number }>().catch(() => ({ results: [{ total: 0 }] }));
        cashbackEarned = res.results || [];
      }
    }
  } else {
    try {
      const res = await db.prepare(
        'SELECT COALESCE(SUM(cashback_awarded_vnd), 0) as total FROM referrals WHERE referrer_id = ? AND status = ?'
      ).bind(cust.id, 'completed').all<{ total: number }>();
      cashbackEarned = res.results || [];
    } catch {
      const res = await db.prepare(
        'SELECT COUNT(*) * 10000 as total FROM referrals WHERE referrer_id = ? AND status = ?'
      ).bind(cust.id, 'completed').all<{ total: number }>().catch(() => ({ results: [{ total: 0 }] }));
      cashbackEarned = res.results || [];
    }
  }

  return c.json({
    success: true,
    data: {
      referral_code: rc?.code || null,
      total_referrals: refCount[0]?.cnt || 0,
      total_cashback_earned_vnd: cashbackEarned[0]?.total || 0,
      total_points_earned_legacy: rc?.total_points_earned || 0,
      code_usage: rc?.times_used || 0,
      recent_referrals: recentRefs.map((row: Record<string, unknown>) => ({
        referred_name: row.referred_name,
        referred_phone: maskPhone(String(row.referred_phone || '')),
        status: row.status,
        created_at: row.created_at,
        cashback_awarded_vnd: row.cashback_awarded_vnd,
        points_awarded: row.points_awarded,
      }))
    }
  });
});

// ── Re-exports for index.ts and dynamic imports from loyalty.ts / tree/ modules ──
export { applyReferralForNewCustomer } from '../tree/referrals/apply-referral';
export { processReferralOnFirstOrder } from '../tree/referrals/process-referral';
export { processReferralCashbackOnFirstOrder } from '../tree/referrals/referral-cashback';
export { reverseReferralCashback } from '../tree/referrals/reverse-cashback';
