/**
 * Zalo OA Webhook Bridge Router
 * Ingests inbound Zalo Official Account messages and dispatches to AI Assistant.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { getTenantId } from '../middleware/tenant';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';
import { processCustomerQuery } from './customer-assistant';

const log = createLogger({ route: 'zalo-webhook' });

export const zaloWebhookRouter = new Hono<{ Bindings: Env }>();

const zaloWebhookSchema = z.object({
  event_name: z.string().max(64).default('user_send_text'),
  app_id: z.string().max(64).optional(),
  timestamp: z.union([z.string().max(32), z.number()]).optional(),
  sender: z.object({
    id: z.string().max(64)
  }).optional(),
  recipient: z.object({
    id: z.string().max(64)
  }).optional(),
  message: z.object({
    text: z.string().max(1000).default(''),
    msg_id: z.string().max(64).optional()
  }).optional(),
  user_phone: z.string().max(20).optional()
});

const zaloSimulateSchema = z.object({
  text: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  user_id: z.string().max(64).optional()
});

const ZALO_CHALLENGE_RE = /^[A-Za-z0-9._-]{1,128}$/;

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export async function verifyZaloSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  appId = '',
  timestamp = ''
): Promise<boolean> {
  const normalizedSig = signatureHeader.replace(/^mac=/i, '').trim().toLowerCase();
  const enc = new TextEncoder();

  // Standard HMAC-SHA256 over raw body
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const hmacDigest = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(rawBody));
  const hmacHex = Array.from(new Uint8Array(hmacDigest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (constantTimeEqual(hmacHex, normalizedSig)) {
    return true;
  }

  // Zalo OA SHA-256 digest: sha256(appId + data + timestamp + OAsecretKey)
  const shaDigest = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(`${appId}${rawBody}${timestamp}${secret}`)
  );
  const shaHex = Array.from(new Uint8Array(shaDigest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return constantTimeEqual(shaHex, normalizedSig);
}

// GET /api/webhooks/zalo — Webhook verification challenge
zaloWebhookRouter.get('/', (c) => {
  const challenge = c.req.query('challenge');
  if (challenge !== undefined) {
    if (!ZALO_CHALLENGE_RE.test(challenge)) {
      return c.json({ success: false, error: 'Invalid challenge' }, 400);
    }
    c.header('X-Content-Type-Options', 'nosniff');
    return c.text(challenge);
  }
  return c.json({ success: true, status: 'Zalo webhook active' });
});

// POST /api/webhooks/zalo — Inbound Zalo message event
zaloWebhookRouter.post('/', async (c) => {
  const rawBody = await c.req.text().catch(() => '{}');
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  const envRecord = (c.env || {}) as unknown as Record<string, unknown>;
  const zaloSecret = (envRecord.ZALO_OA_SECRET || envRecord.ZALO_APP_SECRET) as string | undefined;
  const isProd = c.env?.ENVIRONMENT === 'production' || c.env?.NODE_ENV === 'production';
  const allowUnsignedDev = !isProd && (
    envRecord.ALLOW_UNSIGNED_ZALO_WEBHOOK === 'true' ||
    c.env?.ENVIRONMENT === 'development' ||
    c.env?.ENVIRONMENT === 'test'
  );
  const signatureHeader = c.req.header('X-ZaloOA-Signature') || c.req.header('x-zalooa-signature');

  const timestampRaw = body.timestamp !== undefined ? String(body.timestamp).trim() : '';
  if (!zaloSecret) {
    if (!allowUnsignedDev) {
      return c.json({ success: false, error: 'Zalo webhook secret is not configured' }, 503);
    }
  } else {
    if (!signatureHeader) {
      return c.json({ success: false, error: 'Missing Zalo webhook signature' }, 401);
    }
    const appId = String(body.app_id || envRecord.ZALO_APP_ID || '');
    const valid = await verifyZaloSignature(rawBody, signatureHeader, zaloSecret, appId, timestampRaw);
    if (!valid) {
      return c.json({ success: false, error: 'Invalid Zalo webhook signature' }, 401);
    }
    const tsNum = Number(timestampRaw);
    if (Number.isFinite(tsNum) && tsNum > 1000000000000 && Math.abs(Date.now() - tsNum) > 10 * 60 * 1000) {
      return c.json({ success: false, error: 'Stale Zalo webhook timestamp' }, 401);
    }
  }

  const parsed = zaloWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid Zalo webhook event' }, 400);
  }

  const { event_name, sender, message, user_phone } = parsed.data;
  const rawTenant = c.get('user' as never)
    ? getTenantId(c)
    : (
        c.req.query('tenant_id') ||
        c.req.header('X-Tenant-ID') ||
        c.req.header('x-tenant-id') ||
        String(envRecord.PILOT_TENANT_ID || envRecord.DEFAULT_TENANT_ID || '')
      ).trim();
  const tenantId = !rawTenant || rawTenant === '*' ? 'default' : rawTenant;

  const msgId = message?.msg_id?.trim() || '';
  const authKv = c.env?.AUTH_KV as
    | { get(_k: string): Promise<string | null>; put(_k: string, _v: string, _opts?: { expirationTtl?: number }): Promise<void> }
    | undefined;
  if (msgId && authKv && typeof authKv.get === 'function') {
    const dedupKey = tenantId === 'default' ? `zalo_msg:${msgId}` : `zalo_msg:${tenantId}:${msgId}`;
    const alreadyProcessed = await authKv.get(dedupKey).catch(() => null);
    if (alreadyProcessed) {
      return c.json({ success: true, deduplicated: true, message: 'Duplicate message ignored' });
    }
    if (typeof authKv.put === 'function') {
      await authKv.put(dedupKey, '1', { expirationTtl: 86400 }).catch(() => {});
    }
  }

  const userText = message?.text?.trim() || '';

  if (event_name !== 'user_send_text' || !userText) {
    return c.json({ success: true, message: 'Event ignored or empty text' });
  }

  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const aiBinding = (c.env as Record<string, unknown>).AI;

  let result: { intent: string; reply: string; engine: string };
  try {
    result = await processCustomerQuery(db, aiBinding, tenantId, {
      query: userText,
      phone: user_phone,
      channel: 'zalo'
    });
  } catch (err) {
    log.error('Zalo webhook query processing error:', { message: (err as Error).message });
    return c.json({ success: false, error: 'Failed to process Zalo message' }, 500);
  }

  // Outbound push via Zalo OA message API if token is present
  const zaloToken = (c.env as Record<string, unknown>).ZALO_ACCESS_TOKEN as string | undefined;
  if (zaloToken && sender?.id) {
    try {
      await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: zaloToken
        },
        body: JSON.stringify({
          recipient: { user_id: sender.id },
          message: { text: result.reply }
        }),
        signal: AbortSignal.timeout(4000)
      });
    } catch { /* non-blocking outbound webhook error */ }
  }

  return c.json({
    success: true,
    data: { user_id: sender?.id, received_text: userText, reply: result.reply, intent: result.intent, engine: result.engine }
  });
});

// POST /api/webhooks/zalo/simulate — Dev/Test simulation (requires staff auth outside explicit dev/test)
zaloWebhookRouter.post(
  '/simulate',
  async (c, next) => {
    const isProd = c.env?.ENVIRONMENT === 'production' || c.env?.NODE_ENV === 'production';
    const isExplicitDev = !isProd && (c.env?.ENVIRONMENT === 'development' || c.env?.ENVIRONMENT === 'test');
    if (!isExplicitDev || c.req.header('Authorization')) {
      return requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin'])(c, next);
    }
    return next();
  },
  async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const parsed = zaloSimulateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid simulation payload' }, 400);
    }
    const body = parsed.data;
    const tenantId = c.get('user' as never)
      ? getTenantId(c)
      : ((c.req.query('tenant_id') || c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id') || '').trim() || 'default');
    const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
    const aiBinding = (c.env as Record<string, unknown>).AI;

    try {
      const result = await processCustomerQuery(db, aiBinding, tenantId, {
        query: body.text || 'Menu có món gì ngon?',
        phone: body.phone,
        channel: 'zalo'
      });
      return c.json({
        success: true,
        simulation: true,
        data: { reply: result.reply, intent: result.intent, engine: result.engine }
      });
    } catch (err) {
      log.error('Zalo simulation error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Failed to simulate Zalo message' }, 500);
    }
  }
);
