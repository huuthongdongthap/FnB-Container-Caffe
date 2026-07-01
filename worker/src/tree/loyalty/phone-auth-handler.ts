/**
 * Phone Auth Handler - POST /api/loyalty/phone-auth
 * Customer login/signup via phone number with signup bonus + referral support.
 */
import type { Context } from 'hono';
import { createLogger } from '../../middleware/logger';
import { generateJWT } from '../../lib/jwt';
import { phoneAuthSchema } from '../../lib/validators';
import type { Env } from '../../types/env';
import type { Customer } from '../../types/models';
import { genId, throttle } from './helpers';
import { getActiveCampaign } from './campaign';

const log = createLogger({ route: 'loyalty' });
const DEFAULT_TIER = 'bronze';

export async function handlePhoneAuth(c: Context<{ Bindings: Env }>) {
  try {
    if (!(await throttle(c, 'pa', 10, 300))) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu, thử lại sau 5 phút' }, 429);
    }

    const body = await c.req.json() as Record<string, unknown>;
    const parsed = phoneAuthSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const validated = parsed.data;
    const phone = validated.phone.replace(/\s+/g, '');
    const dob = validated.dob || null;
    const zalo = (validated.zalo || '').replace(/\s+/g, '') || null;
    const source = validated.source || 'unknown';

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();

    let customer = await db.prepare(
      'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE phone = ?'
    ).bind(phone).first<Customer>();
    let bonusGranted = 0;
    let bonusMessage: string | null = null;
    let isNew = false;

    if (!customer) {
      isNew = true;
      const id = genId('CUS_');
      const email = phone + '@loyalty.aura';
      const name = validated.name || 'Thành viên';
      await db.prepare(
        'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, date_of_birth, zalo, source, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)'
      ).bind(id, email, name, phone, DEFAULT_TIER, dob, zalo, source, now, now).run();

      const wid = genId('wal_');
      await db.prepare(
        'INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 0, 0, ?, ?)'
      ).bind(wid, id, now, now).run();

      customer = { id, email, name, phone, loyalty_points: 0, lifetime_points: 0, loyalty_tier: DEFAULT_TIER, created_at: now } as Customer;

      try {
        const campaign = await getActiveCampaign(db);
        if (campaign && campaign.signup_bonus_vnd > 0) {
          const grantedCount = await db.prepare(
            'SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?'
          ).bind(campaign.id).first<{ count: number }>();

          if (!campaign.signup_bonus_cap || (grantedCount?.count || 0) < campaign.signup_bonus_cap) {
            bonusGranted = campaign.signup_bonus_vnd;
            const bonusExpiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
            await db.batch([
              db.prepare(
                'INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, campaign_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(genId('cbt_'), wid, id, null, 'bonus', bonusGranted, bonusGranted, bonusExpiresAt, campaign.id, 'Quà khai truong — ' + campaign.name, now),
              db.prepare('UPDATE cashback_wallets SET balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?').bind(bonusGranted, bonusGranted, now, wid),
              db.prepare('INSERT INTO signup_bonus_log (customer_id, campaign_id, bonus_vnd, granted_at) VALUES (?, ?, ?, ?)').bind(id, campaign.id, bonusGranted, now),
              db.prepare('INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, metadata, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, 'signup_bonus', bonusGranted, JSON.stringify({ campaign: campaign.code, position: (grantedCount?.count || 0) + 1, cap: campaign.signup_bonus_cap }), now),
            ]);
            bonusMessage = '🚀 B?n duoc t?ng ' + bonusGranted.toLocaleString('vi-VN') + 'd vao vi khai truong AURA!';
          }
        }
      } catch (e) {
        log.error('Signup bonus error (non-fatal):', { message: (e as Error).message });
      }

      if (validated.referral_code) {
        const { applyReferralForNewCustomer } = await import('../../routes/referrals');
        c.executionCtx?.waitUntil?.(
          applyReferralForNewCustomer(db, id, validated.referral_code).catch(e =>
            log.error('Referral apply error:', { message: (e as Error).message })
          )
        );
      }
    }

    const token = await generateJWT(
      { email: customer.email || '', name: customer.name || '', id: customer.id, role: 'customer' },
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
        points: customer.loyalty_points || 0,
      },
      is_new: isNew,
      bonus_granted: bonusGranted,
      bonus_message: bonusMessage,
    });
  } catch (err) {
    log.error('phone-auth error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Lỗi hệ thống, thử lại sau' }, 500);
  }
}
