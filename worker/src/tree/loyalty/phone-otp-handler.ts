/**
 * Phone OTP Request Handler — POST /api/loyalty/phone-otp/request
 * Generates a 6-digit one-time verification code in AUTH_KV (phone_otp:${phone}, 300s TTL)
 * for existing customers re-authenticating on a new device.
 * Anonymous responses never expose the OTP value; authenticated Staff callers and
 * the store Telegram channel receive the code for in-store verification.
 */
import type { Context } from 'hono';
import { createLogger } from '../../middleware/logger';
import { verifyJWT } from '../../lib/jwt';
import { phoneAuthSchema } from '../../lib/validators';
import { resolvePilotStore, PilotStoreError } from '../../lib/pilot-store';
import { StaffSessionError, isStaffIdentity, staffTenant, validateStaffSession, type StaffSession } from '../../lib/staff-session';
import { sendSMS } from '../../lib/speedsms-client';
import type { Env } from '../../types/env';
import { persistOtpChallenge, resetOtpClaim, throttle } from './helpers';

const log = createLogger({ route: 'loyalty-otp' });
const OTP_TTL_SECONDS = 300;
const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff', 'cashier']);

function isErasedCustomerRecord(
  row: { name?: unknown; phone?: unknown; anonymized_at?: unknown; is_active?: unknown } | null | undefined,
): boolean {
  if (!row) return false;
  if (row.is_active === 0 || row.is_active === false) return true;
  if (typeof row.anonymized_at === 'string' ? row.anonymized_at.trim() !== '' : Boolean(row.anonymized_at)) {
    return true;
  }
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name === '[ERASED]') return true;
  const phone = typeof row.phone === 'string' ? row.phone.trim().toLowerCase() : '';
  if (phone.startsWith('erased_')) return true;
  return false;
}

async function isCustomerErasedInDb(
  db: Env['AURA_DB'] | undefined,
  customerId: string,
  row?: { name?: unknown; phone?: unknown; anonymized_at?: unknown } | null,
): Promise<boolean> {
  if (isErasedCustomerRecord(row)) return true;
  if (!db?.prepare || !customerId) return false;

  const userRow = await db
    .prepare('SELECT id, is_active, name, phone FROM users WHERE id = ? LIMIT 1')
    .bind(customerId)
    .first<{ id?: string | null; is_active?: number | boolean | null; name?: string | null; phone?: string | null }>()
    .catch(() => null);
  if (userRow && (!userRow.id || String(userRow.id) === customerId) && isErasedCustomerRecord(userRow)) {
    return true;
  }

  const eraseEvent = await db
    .prepare("SELECT event_type FROM customer_events WHERE customer_id = ? AND event_type = 'CustomerDataErased' LIMIT 1")
    .bind(customerId)
    .first<{ event_type?: string | null }>()
    .catch(() => null);
  if (eraseEvent?.event_type === 'CustomerDataErased') {
    return true;
  }

  return false;
}

function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = 100000 + (buf[0] % 900000);
  return String(code);
}

function safeWaitUntil(c: Context<{ Bindings: Env }>, p: Promise<unknown>): void {
  try {
    c.executionCtx?.waitUntil?.(p);
  } catch {
    p.catch(err => log.warn('OTP notification background task failed', { message: (err as Error).message }));
  }
}

export async function handlePhoneOtpRequest(c: Context<{ Bindings: Env }>) {
  try {
    if (!(await throttle(c, 'otp_ip', 5, OTP_TTL_SECONDS))) {
      return c.json({ success: false, error: 'Quá nhiều yêu cầu mã OTP, vui lòng thử lại sau 5 phút' }, 429);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = phoneAuthSchema.pick({ phone: true }).safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }

    const phone = parsed.data.phone.replace(/\s+/g, '');
    if (phone.toLowerCase().startsWith('erased_')) {
      return c.json({ success: false, error: 'Tài khoản đã bị xóa hoặc vô hiệu hóa' }, 403);
    }

    let tenantId = 'default';
    try {
      tenantId = resolvePilotStore(c.env);
    } catch (err) {
      if (err instanceof PilotStoreError) {
        return c.json({ success: false, code: err.code, error: err.message }, 503);
      }
      throw err;
    }

    if (!c.env.AUTH_KV) {
      return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ OTP tạm thời gián đoạn' }, 503);
    }

    let isStaffCaller = false;
    const authHeader = c.req.header?.('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (bearerToken) {
      if (!c.env.JWT_SECRET) {
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Thiếu cấu hình xác thực' }, 503);
      }
      let revoked: string | null = null;
      try {
        revoked = await c.env.AUTH_KV.get(`revoked:${bearerToken}`);
      } catch {
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời gián đoạn' }, 503);
      }
      const verifiedPayload = !revoked
        ? await verifyJWT(bearerToken, c.env.JWT_SECRET, {
          expectedAudience: c.env.JWT_AUDIENCE,
          expectedIssuer: c.env.JWT_ISSUER,
        })
        : null;
      if (!verifiedPayload) {
        return c.json({ success: false, code: 'STAFF_SESSION_REVOKED', error: 'Phiên đăng nhập không hợp lệ hoặc đã thu hồi' }, 401);
      }
      if (!isStaffIdentity(verifiedPayload as Partial<StaffSession>)) {
        return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
      }
      try {
        const account = await validateStaffSession(c.env.AURA_DB, verifiedPayload as Partial<StaffSession>);
        if (!STAFF_ROLES.has(account.role) || staffTenant(account) !== tenantId) {
          return c.json({ success: false, error: 'Không đủ quyền truy cập cửa hàng này' }, 403);
        }
        isStaffCaller = true;
      } catch (err) {
        if (err instanceof StaffSessionError) {
          return c.json({ success: false, code: err.code, error: err.message }, err.status);
        }
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời gián đoạn' }, 503);
      }
    }

    const phoneRateKey = `rl:otp:phone:${tenantId}:${phone}`;
    const phoneAttempts = Number((await c.env.AUTH_KV.get(phoneRateKey)) || 0);
    if (phoneAttempts >= 3) {
      return c.json({ success: false, error: 'Số điện thoại này đã yêu cầu quá nhiều mã OTP. Vui lòng đợi 5 phút.' }, 429);
    }

    let customer: { id: string; name: string; phone: string; tenant_id?: string | null; anonymized_at?: string | null } | null = null;
    try {
      customer = await c.env.AURA_DB.prepare(
        "SELECT id, name, phone, tenant_id, anonymized_at FROM customers WHERE phone = ? ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END LIMIT 1"
      ).bind(phone, tenantId).first<{ id: string; name: string; phone: string; tenant_id?: string | null; anonymized_at?: string | null }>();
    } catch {
      try {
        customer = await c.env.AURA_DB.prepare(
          "SELECT id, name, phone, tenant_id FROM customers WHERE phone = ? ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END LIMIT 1"
        ).bind(phone, tenantId).first<{ id: string; name: string; phone: string; tenant_id?: string | null }>();
      } catch {
        if (tenantId === 'default') {
          try {
            customer = await c.env.AURA_DB.prepare(
              'SELECT id, name, phone, tenant_id FROM customers WHERE phone = ?'
            ).bind(phone).first<{ id: string; name: string; phone: string; tenant_id?: string | null }>();
          } catch {
            customer = await c.env.AURA_DB.prepare(
              'SELECT id, name, phone FROM customers WHERE phone = ?'
            ).bind(phone).first<{ id: string; name: string; phone: string }>();
          }
        }
      }
    }

    const forceNewSignupOtp =
      body.forceOtp === true ||
      body.force_otp === true ||
      body.purpose === 'signup_verify' ||
      isStaffCaller;

    if (!customer && !forceNewSignupOtp) {
      return c.json({
        success: true,
        requiresOtp: false,
        message: 'Số điện thoại mới có thể đăng ký trực tiếp.',
      });
    }

    if (customer && 'tenant_id' in customer && customer.tenant_id !== undefined) {
      const custTenant = (customer.tenant_id && String(customer.tenant_id).trim()) || 'default';
      if (custTenant !== tenantId) {
        return c.json({ success: false, error: 'Tài khoản thuộc cửa hàng khác' }, 403);
      }
    }

    if (customer && await isCustomerErasedInDb(c.env.AURA_DB, customer.id, customer)) {
      return c.json({ success: false, error: 'Tài khoản đã bị xóa hoặc vô hiệu hóa' }, 403);
    }

    const otp = generateSixDigitOtp();
    const otpKey = `phone_otp:${tenantId}:${phone}`;
    const legacyOtpKey = `phone_otp:${phone}`;
    resetOtpClaim(c.env.AUTH_KV, otpKey);
    if (tenantId === 'default') {
      resetOtpClaim(c.env.AUTH_KV, legacyOtpKey);
    }
    try {
      await c.env.AUTH_KV.put(otpKey, otp, { expirationTtl: OTP_TTL_SECONDS });
      if (tenantId === 'default') {
        await c.env.AUTH_KV.put(legacyOtpKey, otp, { expirationTtl: OTP_TTL_SECONDS });
      }
      const persisted = await persistOtpChallenge(c.env.AURA_DB, otpKey, tenantId, phone, otp, OTP_TTL_SECONDS);
      if (!persisted) {
        await c.env.AUTH_KV.delete?.(otpKey).catch(() => {});
        if (tenantId === 'default') {
          await c.env.AUTH_KV.delete?.(legacyOtpKey).catch(() => {});
        }
        return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ OTP tạm thời gián đoạn' }, 503);
      }
      await c.env.AUTH_KV.put(phoneRateKey, String(phoneAttempts + 1), { expirationTtl: OTP_TTL_SECONDS });
    } catch {
      return c.json({ success: false, code: 'AUTH_STATE_UNAVAILABLE', error: 'Dịch vụ OTP tạm thời gián đoạn' }, 503);
    }

    let remoteChannel: 'zalo_zns' | 'sms' | null = null;
    if (!isStaffCaller) {
      const zaloToken = String(
        c.env.ZALO_OA_ACCESS_TOKEN || c.env.ZALO_ACCESS_TOKEN || c.env.ZALO_OA_TOKEN || ''
      ).trim();
      const rawZaloTpl = String(c.env.ZALO_OTP_TEMPLATE_ID || c.env.ZALO_ZNS_TEMPLATE_OTP || '').trim();
      const zaloTemplateId = rawZaloTpl && !rawZaloTpl.startsWith('YOUR_') ? rawZaloTpl : 'otp_verification';

      if (zaloToken) {
        try {
          const normalizedZaloPhone = `84${phone.replace(/^\+?84/, '').replace(/^0/, '')}`;
          const zaloRes = await fetch('https://business.openapi.zalo.me/message/template', {
            method: 'POST',
            headers: {
              access_token: zaloToken,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
            body: JSON.stringify({
              phone: normalizedZaloPhone,
              template_id: zaloTemplateId,
              template_data: { otp },
              tracking_id: `aura_otp_${crypto.randomUUID()}`,
            }),
          });
          if (zaloRes.ok) {
            const zaloJson = (await zaloRes.json().catch(() => null)) as { error?: number } | null;
            if (!zaloJson || zaloJson.error === undefined || zaloJson.error === 0) {
              remoteChannel = 'zalo_zns';
            }
          }
        } catch (err) {
          log.warn('Zalo ZNS OTP delivery failed, trying fallback', { message: (err as Error).message });
        }
      }

      if (!remoteChannel) {
        const smsWebhookUrl = String(c.env.SMS_WEBHOOK_URL || '').trim();
        if (smsWebhookUrl) {
          try {
            const smsSecret = String(c.env.SMS_WEBHOOK_SECRET || '').trim();
            const smsRes = await fetch(smsWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(smsSecret ? { Authorization: `Bearer ${smsSecret}` } : {}),
              },
              signal: AbortSignal.timeout(8000),
              body: JSON.stringify({
                phone,
                otp,
                expiresInSeconds: OTP_TTL_SECONDS,
                tenantId,
                message: `[AURA CAFE] Ma xac thuc OTP cua ban la ${otp} (hieu luc 5 phut).`,
              }),
            });
            if (smsRes.ok) {
              remoteChannel = 'sms';
            }
          } catch (err) {
            log.warn('SMS webhook OTP delivery failed, trying fallback', { message: (err as Error).message });
          }
        }
      }

      if (!remoteChannel && c.env.SPEEDSMS_API_KEY && c.env.SPEEDSMS_API_SECRET) {
        const smsOut = await sendSMS(
          { SPEEDSMS_API_KEY: c.env.SPEEDSMS_API_KEY, SPEEDSMS_API_SECRET: c.env.SPEEDSMS_API_SECRET },
          { phone, message: `[AURA CAFE] Ma xac thuc OTP cua ban la ${otp} (hieu luc 5 phut).` }
        );
        if (smsOut.success) {
          remoteChannel = 'sms';
        }
      }
    }

    if (c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID) {
      const tgUrl = `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const text = `🔐 [AURA OTP] Khách hàng: ${customer?.name || 'Thành viên mới'} (${phone})\nMã xác thực: ${otp} (hiệu lực 5 phút)`;
      safeWaitUntil(
        c,
        fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.env.TELEGRAM_CHAT_ID, text }),
        }).catch(() => {})
      );
    }

    const deliveryChannel = isStaffCaller
      ? 'staff_pos'
      : (remoteChannel ?? 'store_counter');
    const message = isStaffCaller
      ? 'Đã tạo mã OTP xác thực tại quầy cho khách hàng.'
      : deliveryChannel === 'zalo_zns'
        ? 'Mã OTP 6 số đã được gửi qua Zalo ZNS (hiệu lực 5 phút).'
        : deliveryChannel === 'sms'
          ? 'Mã OTP 6 số đã được gửi qua tin nhắn SMS (hiệu lực 5 phút).'
          : 'Mã OTP đã được tạo (hiệu lực 5 phút). Vui lòng nhận mã xác thực từ nhân viên tại quầy.';

    return c.json({
      success: true,
      requiresOtp: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      deliveryChannel,
      ...(isStaffCaller ? { otp } : {}),
      message,
    });
  } catch (err) {
    log.error('phone-otp request error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Lỗi hệ thống' }, 500);
  }
}
