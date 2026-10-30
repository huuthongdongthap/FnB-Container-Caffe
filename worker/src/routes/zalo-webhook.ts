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
  event_name: z.string().default('user_send_text'),
  app_id: z.string().optional(),
  sender: z.object({
    id: z.string()
  }).optional(),
  recipient: z.object({
    id: z.string()
  }).optional(),
  message: z.object({
    text: z.string().default(''),
    msg_id: z.string().optional()
  }).optional(),
  user_phone: z.string().optional()
});

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

async function verifyZaloSignature(
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
  if (challenge) {
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
  const signatureHeader = c.req.header('X-ZaloOA-Signature') || c.req.header('x-zalooa-signature');

  if (isProd && !zaloSecret) {
    return c.json({ success: false, error: 'Zalo webhook secret is not configured' }, 503);
  }

  if (zaloSecret && (isProd || signatureHeader)) {
    if (!signatureHeader) {
      return c.json({ success: false, error: 'Missing Zalo webhook signature' }, 401);
    }
    const appId = String(body.app_id || envRecord.ZALO_APP_ID || '');
    const timestamp = String(body.timestamp || '');
    const valid = await verifyZaloSignature(rawBody, signatureHeader, zaloSecret, appId, timestamp);
    if (!valid) {
      return c.json({ success: false, error: 'Invalid Zalo webhook signature' }, 401);
    }
  }

  const parsed = zaloWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid Zalo webhook event' }, 400);
  }

  const { event_name, sender, message, user_phone } = parsed.data;
  const userText = message?.text?.trim() || '';

  if (event_name !== 'user_send_text' || !userText) {
    return c.json({ success: true, message: 'Event ignored or empty text' });
  }

  const tenantId = getTenantId(c);
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
    data: {
      user_id: sender?.id,
      received_text: userText,
      reply: result.reply,
      intent: result.intent,
      engine: result.engine
    }
  });
});

// POST /api/webhooks/zalo/simulate — Dev/Test simulation (requires staff auth in production)
zaloWebhookRouter.post(
  '/simulate',
  async (c, next) => {
    const isProd = c.env?.ENVIRONMENT === 'production' || c.env?.NODE_ENV === 'production';
    if (isProd || c.req.header('Authorization')) {
      return requireAuth(['owner', 'manager', 'staff', 'admin'])(c, next);
    }
    return next();
  },
  async (c) => {
    const body = await c.req.json().catch(() => ({})) as { text?: string; phone?: string; user_id?: string };
    const tenantId = getTenantId(c);
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
        data: {
          reply: result.reply,
          intent: result.intent,
          engine: result.engine
        }
      });
    } catch (err) {
      log.error('Zalo simulation error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Failed to simulate Zalo message' }, 500);
    }
  }
);
