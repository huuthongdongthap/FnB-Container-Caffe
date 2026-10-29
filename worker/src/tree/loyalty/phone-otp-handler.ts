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
import type { Env } from '../../types/env';
import { resetOtpClaim, throttle } from './helpers';

const log = createLogger({ route: 'loyalty-otp' });
const OTP_TTL_SECONDS = 300;
const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'staff', 'cashier']);

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

    const phoneRateKey = `rl:otp:phone:${phone}`;
    const phoneAttempts = Number((await c.env.AUTH_KV.get(phoneRateKey)) || 0);
    if (phoneAttempts >= 3) {
      return c.json({ success: false, error: 'Số điện thoại này đã yêu cầu quá nhiều mã OTP. Vui lòng đợi 5 phút.' }, 429);
    }

    let customer: { id: string; name: string; phone: string; tenant_id?: string | null } | null = null;
    try {
      customer = await c.env.AURA_DB.prepare(
        'SELECT id, name, phone, tenant_id FROM customers WHERE phone = ?'
      ).bind(phone).first<{ id: string; name: string; phone: string; tenant_id?: string | null }>();
    } catch {
      customer = await c.env.AURA_DB.prepare(
        'SELECT id, name, phone FROM customers WHERE phone = ?'
      ).bind(phone).first<{ id: string; name: string; phone: string }>();
    }

    if (!customer) {
      return c.json({
        success: true,
        requiresOtp: false,
        message: 'Số điện thoại mới có thể đăng ký trực tiếp.',
      });
    }

    if (customer.tenant_id && customer.tenant_id !== tenantId) {
      return c.json({ success: false, error: 'Tài khoản thuộc cửa hàng khác' }, 403);
    }

    const otp = generateSixDigitOtp();
    const otpKey = `phone_otp:${phone}`;
    resetOtpClaim(c.env.AUTH_KV, otpKey);
    await c.env.AUTH_KV.put(otpKey, otp, { expirationTtl: OTP_TTL_SECONDS });
    await c.env.AUTH_KV.put(phoneRateKey, String(phoneAttempts + 1), { expirationTtl: OTP_TTL_SECONDS });

    if (c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID) {
      const tgUrl = `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const text = `🔐 [AURA OTP] Khách hàng: ${customer.name || 'Thành viên'} (${phone})\nMã xác thực: ${otp} (hiệu lực 5 phút)`;
      safeWaitUntil(
        c,
        fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.env.TELEGRAM_CHAT_ID, text }),
        }).catch(() => {})
      );
    }

    return c.json({
      success: true,
      requiresOtp: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      deliveryChannel: isStaffCaller ? 'staff_pos' : 'store_counter',
      ...(isStaffCaller ? { otp } : {}),
      message: isStaffCaller
        ? 'Đã tạo mã OTP xác thực tại quầy cho khách hàng.'
        : 'Mã OTP đã được tạo (hiệu lực 5 phút). Vui lòng nhận mã xác thực từ nhân viên tại quầy.',
    });
  } catch (err) {
    log.error('phone-otp request error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Lỗi hệ thống' }, 500);
  }
}
