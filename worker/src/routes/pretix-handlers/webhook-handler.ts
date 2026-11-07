import type { Hono } from 'hono';
import { pretixWebhookBodySchema, zodErrorResponse } from '../../lib/validators';
import { resolvePilotStore } from '../../middleware/tenant';
import { validateWebhookSignature } from '../../tree/pretix/hmac-validator';
import type { PretixEnv } from './types';


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

    const rawHeaderTenant = (
      c.req.header('X-Tenant-ID') ||
      c.req.header('x-tenant-id') ||
      c.req.header('X-Store-ID') ||
      c.req.header('x-store-id') ||
      ''
    ).trim();
    if (
      rawHeaderTenant &&
      (rawHeaderTenant === '*' || rawHeaderTenant.toLowerCase() === 'hq' || !/^[a-zA-Z0-9_-]{1,64}$/.test(rawHeaderTenant))
    ) {
      return c.json({ success: false, error: 'Invalid X-Tenant-ID header' }, 400);
    }
    const configuredWebhookTenant = typeof (env as unknown as Record<string, unknown>).PRETIX_WEBHOOK_TENANT === 'string'
      ? String((env as unknown as Record<string, unknown>).PRETIX_WEBHOOK_TENANT).trim()
      : '';
    if (configuredWebhookTenant && rawHeaderTenant && rawHeaderTenant !== configuredWebhookTenant) {
      return c.json({ success: false, error: 'Cross-tenant webhook rejected' }, 403);
    }
    let activeTenant = configuredWebhookTenant || (rawHeaderTenant ? rawHeaderTenant : '');
    if (!activeTenant) {
      try {
        activeTenant = resolvePilotStore(c.env as unknown as Parameters<typeof resolvePilotStore>[0]);
      } catch {
        activeTenant = 'default';
      }
    }

    if (db) {
      const now = new Date().toISOString();
      const effectiveTenant = !activeTenant || activeTenant === '*' ? 'default' : activeTenant;
      const fallbackOrganizer = effectiveTenant === 'default' ? (body.organizer || '') : `${effectiveTenant}:${body.organizer || ''}`;
      if (body.notification_id != null) {
        try {
          let existingLog: { notification_id?: number | null; organizer?: string | null; action?: string | null } | null = null;
          try {
            existingLog = await db
              .prepare(
                "SELECT notification_id FROM pretix_webhook_log WHERE notification_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
              )
              .bind(body.notification_id, effectiveTenant)
              .first<{ notification_id?: number | null; organizer?: string | null; action?: string | null }>();
            if (
              existingLog &&
              typeof existingLog.organizer === 'string' &&
              existingLog.organizer.trim() !== '' &&
              existingLog.organizer !== (body.organizer || '')
            ) {
              existingLog = null;
            }
          } catch {
            existingLog = await db
              .prepare('SELECT notification_id FROM pretix_webhook_log WHERE notification_id = ? AND organizer = ? LIMIT 1')
              .bind(body.notification_id, fallbackOrganizer)
              .first<{ notification_id?: number | null; organizer?: string | null }>();
          }
          if (existingLog) {
            return c.json({ success: true, message: 'Webhook received', duplicate: true });
          }
        } catch {
          // Proceed with insert when deduplication lookup is unavailable
        }
      } else if (body.code && body.action) {
        try {
          let existingActionLog: { code?: string | null } | null = null;
          try {
            existingActionLog = await db
              .prepare(
                "SELECT code FROM pretix_webhook_log WHERE code = ? AND action = ? AND organizer = ? AND event = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
              )
              .bind(body.code, body.action, body.organizer || '', body.event || '', effectiveTenant)
              .first<{ code?: string | null }>();
          } catch {
            existingActionLog = await db
              .prepare(
                'SELECT code FROM pretix_webhook_log WHERE code = ? AND action = ? AND organizer = ? AND event = ? LIMIT 1'
              )
              .bind(body.code, body.action, fallbackOrganizer, body.event || '')
              .first<{ code?: string | null }>();
          }
          if (existingActionLog) {
            return c.json({ success: true, message: 'Webhook received', duplicate: true });
          }
        } catch {
          // Proceed with insert when action-level deduplication lookup is unavailable
        }
      }
      try {
        try {
          await db.prepare(
            'INSERT INTO pretix_webhook_log (notification_id, organizer, event, code, action, payload, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            body.notification_id || null, body.organizer || '', body.event || '',
            body.code, body.action, bodyText, effectiveTenant, now
          ).run();
        } catch {
          await db.prepare(
            'INSERT INTO pretix_webhook_log (notification_id, organizer, event, code, action, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            body.notification_id || null, fallbackOrganizer, body.event || '',
            body.code, body.action, bodyText, now
          ).run();
        }
      } catch {
        // DB logging is best-effort
      }
    }

    return c.json({ success: true, message: 'Webhook received' });
  });
}
