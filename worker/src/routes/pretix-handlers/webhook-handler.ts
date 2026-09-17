import type { Hono } from 'hono';
import { createLogger } from '../../middleware/logger';
import { pretixWebhookBodySchema, zodErrorResponse } from '../../lib/validators';
import { validateWebhookSignature } from '../../tree/pretix/hmac-validator';
import type { PretixEnv } from './types';

const log = createLogger({ route: 'pretix:webhook' });

export function registerWebhookHandler(router: Hono): void {
  // POST /webhook — receive pretix webhook
  router.post('/webhook', async (c) => {
    const env = c.env as unknown as PretixEnv;
    const db = env.AURA_DB;
    const bodyText = await c.req.text();
    const signature = c.req.header('X-pretix-Signature');

    if (!env.PRETIX_WEBHOOK_SECRET) {
      return c.json({ success: false, error: 'Webhook secret not configured' }, 500);
    }
    if (!signature) {
      return c.json({ success: false, error: 'Missing X-pretix-Signature header' }, 401);
    }
    const isValid = await validateWebhookSignature(bodyText, signature, env.PRETIX_WEBHOOK_SECRET);
    if (!isValid) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const parsed = pretixWebhookBodySchema.safeParse(parsedBody);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const body = parsed.data;

    if (db) {
      try {
        await db.prepare(
          'INSERT INTO pretix_webhook_log (notification_id, organizer, event, code, action, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          body.notification_id || null, body.organizer || '', body.event || '',
          body.code, body.action, bodyText, new Date().toISOString()
        ).run();
      } catch {
        // DB logging is best-effort
      }
    }

    return c.json({ success: true, message: 'Webhook received' });
  });
}