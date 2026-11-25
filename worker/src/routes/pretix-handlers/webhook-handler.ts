import type { Hono } from 'hono';
import { pretixWebhookBodySchema, zodErrorResponse } from '../../lib/validators';
import { createLogger } from '../../middleware/logger';
import { resolvePilotStore } from '../../middleware/tenant';
import { AuditLogger } from '../../lib/audit-logger';
import { recordMetric } from '../../lib/metrics-collector';
import { sendPushToStaff, type PushEnv } from '../../tree/push/notifier';
import { getPretixClient } from '../../tree/pretix/client-factory';
import { validateWebhookSignature } from '../../tree/pretix/hmac-validator';
import type { PretixEnv } from './types';

const log = createLogger({ route: 'pretix-webhook' });

type TicketOrderStatus = 'placed' | 'paid' | 'canceled' | 'expired' | 'refunded' | 'checked_in' | 'ignored';

function mapPretixActionToStatus(action: string): TicketOrderStatus {
  const norm = String(action || '').trim().toLowerCase();
  if (norm === 'pretix.event.order.placed' || norm.endsWith('.order.placed')) return 'placed';
  if (norm === 'pretix.event.order.paid' || norm.endsWith('.order.paid')) return 'paid';
  if (norm === 'pretix.event.order.canceled' || norm === 'pretix.event.order.cancelled' || norm.endsWith('.order.canceled')) {
    return 'canceled';
  }
  if (norm === 'pretix.event.order.expired' || norm.endsWith('.order.expired')) return 'expired';
  if (norm.includes('refund')) return 'refunded';
  if (norm.includes('checkin')) return 'checked_in';
  return 'ignored';
}


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

    const effectiveTenant = !activeTenant || activeTenant === '*' ? 'default' : activeTenant;
    const syncedStatus = mapPretixActionToStatus(body.action);
    let orderDetails: Record<string, unknown> | null = null;

    if (syncedStatus !== 'ignored') {
      const client = getPretixClient(env);
      if (client && body.organizer && body.event && body.code) {
        try {
          orderDetails = await client.getOrder(body.organizer, body.event, body.code);
        } catch (fetchErr) {
          log.warn('pretix_webhook_order_fetch_skipped', {
            organizer: body.organizer,
            event: body.event,
            code: body.code,
            error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          });
        }
      }

      if (db && body.code) {
        const nowIso = new Date().toISOString();
        const totalVal = orderDetails && typeof orderDetails.total === 'string'
          ? Number(orderDetails.total)
          : (orderDetails && typeof orderDetails.total === 'number' ? orderDetails.total : 0);
        const buyerEmail = orderDetails && typeof orderDetails.email === 'string' ? orderDetails.email : null;

        // Sync ticket_orders table when explicitly present in schema
        try {
          const ticketOrdersMeta = await db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ticket_orders' LIMIT 1")
            .first<{ name?: string }>()
            .catch(() => null);
          if (ticketOrdersMeta?.name === 'ticket_orders') {
            await db
              .prepare(
                `INSERT INTO ticket_orders (id, organizer, event_slug, order_code, status, email, total_amount, tenant_id, updated_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   status = excluded.status,
                   email = COALESCE(excluded.email, ticket_orders.email),
                   total_amount = CASE WHEN excluded.total_amount > 0 THEN excluded.total_amount ELSE ticket_orders.total_amount END,
                   updated_at = excluded.updated_at`
              )
              .bind(
                `ptx_${effectiveTenant}_${body.organizer || 'org'}_${body.event || 'evt'}_${body.code}`,
                body.organizer || '',
                body.event || '',
                body.code,
                syncedStatus,
                buyerEmail,
                Number.isFinite(totalVal) ? totalVal : 0,
                effectiveTenant,
                nowIso,
                nowIso
              )
              .run();
          }
        } catch {
          // ticket_orders table is optional
        }

        const kv = (env as Record<string, unknown>).AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
        if (kv && typeof kv.put === 'function') {
          await kv
            .put(
              `pretix:ticket_order:${effectiveTenant}:${body.event || 'default'}:${body.code}`,
              JSON.stringify({
                organizer: body.organizer || '',
                event: body.event || '',
                code: body.code,
                status: syncedStatus,
                action: body.action,
                email: buyerEmail,
                total: Number.isFinite(totalVal) ? totalVal : 0,
                updatedAt: nowIso,
              }),
              { expirationTtl: 90 * 86400 }
            )
            .catch(() => {});
        }

        try {
          const auditMeta = await db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_logs' LIMIT 1")
            .first<{ name?: string }>()
            .catch(() => null);
          if (auditMeta?.name === 'audit_logs') {
            let execCtx: import('hono').ExecutionContext | undefined;
            try { execCtx = c.executionCtx; } catch { execCtx = undefined; }
            const auditLogger = new AuditLogger(execCtx as import('hono').ExecutionContext, db);
            await auditLogger.log({
              actor_id: 'system:pretix',
              actor_name: 'Pretix Webhook',
              action: `pretix.ticket.${syncedStatus}`,
              resource_type: 'pretix_order',
              resource_id: body.code,
              tenant_id: effectiveTenant,
              details: JSON.stringify({
                organizer: body.organizer || '',
                event: body.event || '',
                code: body.code,
                pretix_action: body.action,
                status: syncedStatus,
                email: buyerEmail,
                total: Number.isFinite(totalVal) ? totalVal : 0,
              }),
            });
          }
        } catch {
          // Best-effort audit record
        }

        try {
          const metricsMeta = await db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_metrics' LIMIT 1")
            .first<{ name?: string }>()
            .catch(() => null);
          if (metricsMeta?.name === '_metrics') {
            void recordMetric(db, 'pretix_webhook_processed', 1, {
              action: syncedStatus,
              tenant_id: effectiveTenant,
            });
          }
        } catch {
          // Best-effort metric
        }
      }

      if (syncedStatus === 'paid' || syncedStatus === 'canceled') {
        const pushEnv = env as unknown as PushEnv;
        if (pushEnv.VAPID_PUBLIC_KEY && pushEnv.VAPID_PRIVATE_KEY && pushEnv.AURA_DB) {
          await sendPushToStaff(
            pushEnv,
            {
              title: syncedStatus === 'paid' ? 'Vé sự kiện mới đã thanh toán' : 'Vé sự kiện đã hủy',
              body: `Mã vé #${body.code} (${body.event || 'Sự kiện'}) — trạng thái: ${syncedStatus}`,
              data: {
                type: 'pretix_ticket_update',
                code: body.code,
                event: body.event || '',
                status: syncedStatus,
                tenant_id: effectiveTenant,
              },
            },
            'owner',
            [],
            effectiveTenant
          ).catch(() => {});
        }
      }

      log.info('pretix_webhook_synced', {
        tenantId: effectiveTenant,
        organizer: body.organizer,
        event: body.event,
        code: body.code,
        status: syncedStatus,
      });
    }

    return c.json({
      success: true,
      message: 'Webhook received',
      synced_status: syncedStatus,
      code: body.code,
    });
  });
}
