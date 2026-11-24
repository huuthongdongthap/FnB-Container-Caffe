/**
 * Public Leads / Newsletter Capture Route
 * POST /api/leads — validates email/phone, rate-limits by IP, and persists to KV + D1.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { createLogger } from '../middleware/logger';
import { rateLimitMiddleware, type RateLimitConfig } from '../middleware/rate-limit';
import { resolvePublicTenantId } from '../middleware/tenant';

const log = createLogger({ route: 'leads' });

const LEADS_RATE_LIMIT: RateLimitConfig = {
  max: 10,
  windowSec: 60,
  keyPrefix: 'rl:leads:',
  errorMessage: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.',
};

const emailCheck = z.string().trim().email('Email không hợp lệ').max(254);

const leadSchema = z
  .object({
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(32).optional(),
    source: z.string().trim().max(80).optional().default('promotions_newsletter'),
  })
  .superRefine((val, ctx) => {
    const hasEmail = typeof val.email === 'string' && val.email.length > 0;
    const hasPhone = typeof val.phone === 'string' && val.phone.length > 0;
    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vui lòng nhập email hoặc số điện thoại hợp lệ',
      });
      return;
    }
    if (hasEmail) {
      const res = emailCheck.safeParse(val.email);
      if (!res.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: res.error.issues[0]?.message || 'Email không hợp lệ',
        });
      }
    }
    if (hasPhone) {
      const digits = val.phone!.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phone'],
          message: 'Số điện thoại không hợp lệ',
        });
      }
    }
  });

export const leadsRouter = new Hono<{ Bindings: Env }>();

leadsRouter.post('/', rateLimitMiddleware(LEADS_RATE_LIMIT), async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Dữ liệu JSON không hợp lệ' }, 400);
  }

  const parsed = leadSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Thông tin đăng ký không hợp lệ';
    return c.json({ success: false, error: firstIssue }, 400);
  }

  const normalizedEmail = parsed.data.email ? parsed.data.email.toLowerCase() : undefined;
  const normalizedPhone = parsed.data.phone ? parsed.data.phone.replace(/\D/g, '') : undefined;
  const source = parsed.data.source || 'promotions_newsletter';
  const subscribedAt = new Date().toISOString();
  const rawTenantId = resolvePublicTenantId(c).trim();
  const tenantId =
    rawTenantId &&
    rawTenantId !== '*' &&
    rawTenantId.toLowerCase() !== 'hq' &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(rawTenantId)
      ? rawTenantId
      : 'default';

  const record = {
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
    source,
    tenantId,
    subscribedAt,
  };

  let persisted = false;

  if (c.env.AUTH_KV && typeof c.env.AUTH_KV.put === 'function') {
    try {
      if (normalizedEmail) {
        await c.env.AUTH_KV.put(
          `lead:${tenantId}:${normalizedEmail}`,
          JSON.stringify(record),
          { expirationTtl: 60 * 60 * 24 * 365 },
        );
      }
      if (normalizedPhone) {
        await c.env.AUTH_KV.put(
          `lead:${tenantId}:phone:${normalizedPhone}`,
          JSON.stringify(record),
          { expirationTtl: 60 * 60 * 24 * 365 },
        );
      }
      persisted = true;
    } catch (err) {
      log.error('leads_kv_write_failed', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (c.env.AURA_DB && typeof c.env.AURA_DB.prepare === 'function') {
    const id = `lead_${crypto.randomUUID().slice(0, 12)}`;
    try {
      if (normalizedEmail) {
        await c.env.AURA_DB.prepare(
          `INSERT INTO leads (id, tenant_id, email, phone, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, email) DO UPDATE SET
             phone = COALESCE(excluded.phone, leads.phone),
             source = excluded.source,
             updated_at = excluded.updated_at`,
        )
          .bind(id, tenantId, normalizedEmail, normalizedPhone ?? null, source, subscribedAt, subscribedAt)
          .run();
      } else if (normalizedPhone) {
        await c.env.AURA_DB.prepare(
          `INSERT INTO leads (id, tenant_id, email, phone, source, created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, phone) DO UPDATE SET
             source = excluded.source,
             updated_at = excluded.updated_at`,
        )
          .bind(id, tenantId, normalizedPhone, source, subscribedAt, subscribedAt)
          .run();
      }
      persisted = true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (normalizedEmail && /no such column:\s*(phone|updated_at)/i.test(errMsg)) {
        try {
          await c.env.AURA_DB.prepare(
            `INSERT INTO leads (id, email, source, tenant_id, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(tenant_id, email) DO UPDATE SET source = excluded.source`,
          )
            .bind(id, normalizedEmail, source, tenantId, subscribedAt)
            .run();
          persisted = true;
        } catch (fallbackErr) {
          log.error('leads_d1_fallback_failed', {
            tenantId,
            error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
          });
        }
      } else if (normalizedEmail && normalizedPhone && /unique/i.test(errMsg)) {
        try {
          await c.env.AURA_DB.prepare(
            `UPDATE leads
             SET email = COALESCE(email, ?), source = ?, updated_at = ?
             WHERE tenant_id = ? AND phone = ?`,
          )
            .bind(normalizedEmail, source, subscribedAt, tenantId, normalizedPhone)
            .run();
          persisted = true;
        } catch (conflictErr) {
          log.error('leads_d1_conflict_update_failed', {
            tenantId,
            error: conflictErr instanceof Error ? conflictErr.message : String(conflictErr),
          });
        }
      } else {
        log.error('leads_d1_write_failed', {
          tenantId,
          error: errMsg,
        });
      }
    }
  }

  if (!persisted) {
    return c.json({ success: false, error: 'Không thể lưu thông tin đăng ký. Vui lòng thử lại sau.' }, 503);
  }

  return c.json({ success: true, data: record }, 201);
});

export default leadsRouter;
