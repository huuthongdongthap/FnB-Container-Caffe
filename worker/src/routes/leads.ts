/**
 * Public Leads / Newsletter Capture Route
 * POST /api/leads — validates email, rate-limits by IP, and persists to KV (with D1 fallback).
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { createLogger } from '../middleware/logger';
import { rateLimitMiddleware, type RateLimitConfig } from '../middleware/rate-limit';

const log = createLogger({ route: 'leads' });

const LEADS_RATE_LIMIT: RateLimitConfig = {
  max: 10,
  windowSec: 60,
  keyPrefix: 'rl:leads:',
  errorMessage: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.',
};

const leadSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(254),
  source: z.string().trim().max(80).optional().default('promotions_newsletter'),
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
    const firstIssue = parsed.error.issues[0]?.message || 'Email không hợp lệ';
    return c.json({ success: false, error: firstIssue }, 400);
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const source = parsed.data.source || 'promotions_newsletter';
  const subscribedAt = new Date().toISOString();
  const tenantId = (c.req.header('X-Tenant-ID') || 'default').trim() || 'default';

  const record = {
    email: normalizedEmail,
    source,
    tenantId,
    subscribedAt,
  };

  let persisted = false;

  if (c.env.AUTH_KV && typeof c.env.AUTH_KV.put === 'function') {
    try {
      await c.env.AUTH_KV.put(
        `lead:${tenantId}:${normalizedEmail}`,
        JSON.stringify(record),
        { expirationTtl: 60 * 60 * 24 * 365 },
      );
      persisted = true;
    } catch (err) {
      log.error('leads_kv_write_failed', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (c.env.AURA_DB && typeof c.env.AURA_DB.prepare === 'function') {
    try {
      await c.env.AURA_DB.prepare(
        `INSERT INTO leads (id, email, source, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET source = excluded.source`,
      )
        .bind(`lead_${crypto.randomUUID().slice(0, 12)}`, normalizedEmail, source, tenantId, subscribedAt)
        .run();
      persisted = true;
    } catch (err) {
      log.error('leads_d1_write_failed', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!persisted) {
    return c.json({ success: false, error: 'Không thể lưu thông tin đăng ký. Vui lòng thử lại sau.' }, 503);
  }

  return c.json({ success: true, data: record }, 201);
});

export default leadsRouter;
