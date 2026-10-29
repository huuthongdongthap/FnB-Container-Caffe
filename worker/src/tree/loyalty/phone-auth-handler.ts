/**
 * Phone Auth Handler - POST /api/loyalty/phone-auth
 * Customer login/signup via phone number with signup bonus + referral support.
 */
import type { Context } from 'hono';
import { createLogger } from '../../middleware/logger';
import { generateJWT, verifyJWT, timingSafeEqualString } from '../../lib/jwt';
import { phoneAuthSchema } from '../../lib/validators';
import { resolvePilotStore, PilotStoreError } from '../../lib/pilot-store';
import type { Env } from '../../types/env';
import type { Customer } from '../../types/models';
import { genId, throttle } from './helpers';
import { getActiveCampaign } from './campaign';

const log = createLogger({ route: 'loyalty' });
const DEFAULT_TIER = 'bronze';

// Hono's executionCtx getter throws when no ExecutionContext exists (e.g.
// router.request() in tests). Never let background capture break signup.
function safeWaitUntil(c: Context<{ Bindings: Env }>, p: Promise<unknown>): void {
  try {
    c.executionCtx?.waitUntil?.(p);
  } catch {
    p.catch(e => log.error('Background task dropped (no ExecutionContext):', { message: (e as Error).message }));
  }
}

export async function handlePhoneAuth(c: Context<{ Bindings: Env }>) {
  try {
    if (!(await throttle(c, 'pa', 10, 300))) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu, thử lại sau 5 phút' }, 429);
    }

    const body = await c.req.json() as Record<string, unknown>;
    const parsed = phoneAuthSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const validated = parsed.data;
    const phone = validated.phone.replace(/\s+/g, '');
    const dob = validated.dob || null;
    const zalo = (validated.zalo || '').replace(/\s+/g, '') || null;
    const source = validated.source || 'unknown';

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();
    let tenantId = 'default';
    try {
      tenantId = resolvePilotStore(c.env);
    } catch (err) {
      if (err instanceof PilotStoreError) {
        return c.json({ success: false, code: err.code, error: err.message }, 503);
      }
      throw err;
    }

    let customer: Customer | null = null;
    try {
      customer = await db.prepare(
        'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
      ).bind(phone).first<Customer>();
    } catch {
      customer = await db.prepare(
        'SELECT id, email, name, phone, loyalty_points, loyalty_points AS lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
      ).bind(phone).first<Customer>();
    }
    let bonusGranted = 0;
    let bonusMessage: string | null = null;
    let isNew = false;

    if (customer) {
      let meta: { tenant_id?: string | null; verified_at?: string | null } | null = null;
      try {
        meta = await db.prepare(
          'SELECT tenant_id, verified_at FROM customers WHERE id = ?'
        ).bind(customer.id).first<{ tenant_id?: string | null; verified_at?: string | null }>();
      } catch {
        // Optional metadata columns in partial test schemas
      }
      if (meta?.tenant_id && meta.tenant_id !== tenantId) {
        return c.json({ success: false, error: 'Tài khoản thuộc cửa hàng khác' }, 403);
      }

      const authHeader = c.req.header?.('Authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      const requiresProof =
        Boolean(meta?.verified_at) ||
        c.env.ENVIRONMENT === 'production' ||
        body.otp_verified !== undefined ||
        body.otp !== undefined ||
        Boolean(bearerToken);

      if (requiresProof) {
        let proofVerified = false;
        if (bearerToken && c.env.JWT_SECRET) {
          const revoked = await c.env.AUTH_KV?.get?.(`revoked:${bearerToken}`);
          const verifiedPayload = !revoked ? await verifyJWT(bearerToken, c.env.JWT_SECRET) : null;
          const role = String(verifiedPayload?.role || '');
          const isStaffCaller = ['owner', 'admin', 'manager', 'staff', 'cashier'].includes(role);
          if (
            verifiedPayload &&
            (verifiedPayload.id === customer.id || verifiedPayload.email === customer.email || isStaffCaller)
          ) {
            proofVerified = true;
          }
        }
        if (!proofVerified && typeof body.otp === 'string' && body.otp.trim().length >= 4 && c.env.AUTH_KV) {
          const otpKey = `phone_otp:${phone}`;
          const storedOtp = await c.env.AUTH_KV.get(otpKey);
          if (storedOtp && timingSafeEqualString(storedOtp, body.otp.trim())) {
            await c.env.AUTH_KV.delete?.(otpKey);
            proofVerified = true;
          }
        }
        if (!proofVerified) {
          return c.json({
            success: false,
            code: 'PHONE_VERIFICATION_REQUIRED',
            error: 'Số điện thoại đã xác thực. Vui lòng xác minh OTP để đăng nhập.',
          }, 403);
        }
      }
    }

    if (!customer) {
      isNew = true;
      const id = genId('CUS_');
      const email = `${phone}@loyalty.aura`;
      const name = validated.name || 'Thành viên';
      try {
        await db.prepare(
          'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, date_of_birth, zalo, source, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, email, name, phone, DEFAULT_TIER, dob, zalo, source, tenantId, now, now).run();
      } catch {
        try {
          await db.prepare(
            'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, date_of_birth, zalo, source, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)'
          ).bind(id, email, name, phone, DEFAULT_TIER, dob, zalo, source, now, now).run();
        } catch {
          try {
            await db.prepare(
              'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)'
            ).bind(id, email, name, phone, DEFAULT_TIER, now, now).run();
          } catch {
            await db.prepare(
              'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
            ).bind(id, email, name, phone, DEFAULT_TIER, now).run();
          }
        }
      }

      const wid = genId('wal_');
      try {
        await db.prepare(
          'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?, ?)'
        ).bind(wid, id, tenantId, now, now).run();
      } catch {
        await db.prepare(
          'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
        ).bind(wid, id, now, now).run();
      }

      customer = { id, email, name, phone, loyalty_points: 0, lifetime_points: 0, loyalty_tier: DEFAULT_TIER, created_at: now } as Customer;

      try {
        const campaign = await getActiveCampaign(db);
        if (campaign && campaign.signup_bonus_vnd > 0) {
          const grantedCount = await db.prepare(
            'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
          ).bind(campaign.id).first<{ count: number }>();

          if (!campaign.signup_bonus_cap || (grantedCount?.count || 0) < campaign.signup_bonus_cap) {
            const candidateBonus = campaign.signup_bonus_vnd;
            const bonusExpiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
            const auditMeta = JSON.stringify({ campaign: campaign.code, position: (grantedCount?.count || 0) + 1, cap: campaign.signup_bonus_cap });
            try {
              await db.batch([
                db.prepare(
                  'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(genId('cbt_'), wid, id, null, 'bonus', candidateBonus, candidateBonus, bonusExpiresAt, campaign.id, `Quà khai trương — ${campaign.name}`, now),
                db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(candidateBonus, candidateBonus, now, wid),
                db.prepare('INSERT INTO signup_bonus_log (customer_id, campaign_id, bonus_vnd, granted_at) VALUES (?, ?, ?, ?)').bind(id, campaign.id, candidateBonus, now),
                db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, metadata, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, 'signup_bonus', candidateBonus, auditMeta, now)
              ]);
            } catch {
              await db.batch([
                db.prepare(
                  'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(genId('cbt_'), wid, id, null, 'bonus', candidateBonus, candidateBonus, bonusExpiresAt, campaign.id, `Quà khai trương — ${campaign.name}`, now),
                db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(candidateBonus, candidateBonus, now, wid),
                db.prepare('INSERT INTO signup_bonus_log (customer_id, campaign_id, amount_vnd, granted_at) VALUES (?, ?, ?, ?)').bind(id, campaign.id, candidateBonus, now),
                db.prepare('INSERT INTO loyalty_audit_log (customer_id, event_type, amount_vnd, metadata, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, 'signup_bonus', candidateBonus, auditMeta, now)
              ]);
            }
            bonusGranted = candidateBonus;
            bonusMessage = `🚀 Bạn được tặng ${bonusGranted.toLocaleString('vi-VN')}đ vào ví khai trương AURA!`;
          }
        }
      } catch (e) {
        bonusGranted = 0;
        bonusMessage = null;
        log.error('Signup bonus error (non-fatal):', { message: (e as Error).message });
      }

      const referralCode = validated.referral_code;
      if (referralCode) {
        safeWaitUntil(c,
          (async () => {
            try {
              const { redeemReferral } = await import('@aura/domain-crm');
              const result = await redeemReferral(db, referralCode, id);
              if (!result.success) {
                log.warn('Referral redeem failed on signup:', { reason: result.reason, customerId: id });
              }
            } catch (e) {
              log.error('Referral redeem error:', { message: (e as Error).message });
            }
          })()
        );
      }

      // Customer-domain capture (additive — never blocks signup):
      // phone identity + explicit signup consent for CRM.
      safeWaitUntil(c,
        (async () => {
          try {
            const { identifyCustomer, recordConsent } = await import('../customer');
            const identity = await identifyCustomer({
              db, customerId: id, phone, zalo: zalo || undefined,
              source: 'signup'
            });
            if (identity) {
              await recordConsent({
                db, customerId: id,
                purpose: 'crm', granted: true, source: 'signup'
              });
            }
          } catch (custErr) {
            log.error('Customer capture error (non-blocking):', { message: (custErr as Error).message });
          }
        })()
      );
    }

    const token = await generateJWT(
      { email: customer.email || '', name: customer.name || '', id: customer.id, role: 'customer', tenantId },
      c.env.JWT_SECRET,
      c.env.JWT_EXPIRY_SECONDS
    );

    return c.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        tier: customer.loyalty_tier || DEFAULT_TIER,
        points: customer.loyalty_points || 0
      },
      is_new: isNew,
      bonus_granted: bonusGranted,
      bonus_message: bonusMessage
    });
  } catch (err) {
    log.error('phone-auth error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Lỗi hệ thống, thử lại sau' }, 500);
  }
}
