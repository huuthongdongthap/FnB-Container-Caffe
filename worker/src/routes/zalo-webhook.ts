/**
 * Zalo OA Webhook Bridge Router
 * Ingests inbound Zalo Official Account messages and dispatches to AI Assistant.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { getTenantId } from '../middleware/tenant';
import { processCustomerQuery } from './customer-assistant';

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
  const body = await c.req.json().catch(() => ({}));
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

  const result = await processCustomerQuery(db, aiBinding, tenantId, {
    query: userText,
    phone: user_phone,
    channel: 'zalo'
  });

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

// POST /api/webhooks/zalo/simulate — Dev/Test simulation
zaloWebhookRouter.post('/simulate', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { text?: string; phone?: string; user_id?: string };
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const aiBinding = (c.env as Record<string, unknown>).AI;

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
});
