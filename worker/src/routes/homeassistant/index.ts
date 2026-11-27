/**
 * Home Assistant — Hono sub-router
 * Prefix: /api/ha
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../types/env';
import {
  getDeviceState,
  toggleDevice,
  getZoneDevices,
  matchesHaTenant,
  safeParseJsonObject
} from '../../tree/homeassistant/devices';
import {
  triggerAutomation,
  getAutomationLog
} from '../../tree/homeassistant/automations';
import {
  dispatchDiningPresence,
  handleHAWebhook,
  type DiningPresenceEvent
} from '../../tree/homeassistant/presence';
import { requireAuth as jwtRequireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, resolvePilotStore } from '../../middleware/tenant';
import { createLogger } from '../../middleware/logger';
import { z } from 'zod';

const requireAuth = (roles: string[]): MiddlewareHandler =>
  jwtRequireAuth(roles as Parameters<typeof jwtRequireAuth>[0]);

function hasCrossTenantOverride(c: {
  get: (_k: string) => unknown;
  req: { query: (_k: string) => string | undefined; header: (_k: string) => string | undefined };
}): boolean {
  const user = c.get('user') as { role?: string; tenant_id?: string; tenantId?: string } | undefined;
  if (!user || isHQSuperAdmin(user)) return false;
  const userTenant = (user.tenant_id || user.tenantId || '').trim() || 'default';
  if (userTenant === '*' || userTenant.toLowerCase() === 'hq') return true;
  const candidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  return candidates.some((t) => t === '*' || t.toLowerCase() === 'hq' || t !== userTenant);
}

function resolveHaTenant(c: Parameters<typeof getTenantId>[0]): string {
  const raw = (getTenantId(c) || 'default').trim() || 'default';
  return raw.toLowerCase() === 'hq' ? '*' : raw;
}

const log = createLogger({ route: 'ha' });

const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;
const WEBHOOK_REPLAY_TTL_SECONDS = 600;

function isFreshHaWebhookTimestamp(rawTs: string | undefined | null): boolean {
  if (!rawTs || !rawTs.trim()) return true;
  const trimmed = rawTs.trim();
  let tsSeconds = NaN;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return false;
    tsSeconds = num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const parsedMs = Date.parse(trimmed);
    if (!Number.isFinite(parsedMs) || parsedMs <= 0) return false;
    tsSeconds = Math.floor(parsedMs / 1000);
  } else {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - tsSeconds) <= WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
}

async function isDuplicateHaWebhookReplay(
  env: Env | undefined,
  rawBody: string,
): Promise<boolean> {
  const kv = (env?.AUTH_KV ?? (env as unknown as Record<string, unknown>)?.AURA_KV) as
    | import('@cloudflare/workers-types').KVNamespace
    | undefined;
  if (!kv || typeof kv.get !== 'function') return false;
  // Derive replay key strictly from HMAC-authenticated body bytes; unsigned timestamp headers cannot salt a bypass.
  const input = new TextEncoder().encode(rawBody);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const replayKey = `webhook:replay:ha:${hex}`;
  const existing = await kv.get(replayKey).catch(() => null);
  if (existing) return true;
  if (typeof kv.put === 'function') {
    await kv.put(replayKey, '1', { expirationTtl: WEBHOOK_REPLAY_TTL_SECONDS }).catch(() => {});
  }
  return false;
}

const ToggleDeviceSchema = z.object({
  action: z.enum(['on', 'off'])
});

const TriggerAutomationSchema = z.object({
  automation_id: z.string().min(1),
  trigger_entity: z.string().optional(),
  payload: z.unknown().optional()
});

const DispatchPresenceSchema = z.object({
  event: z.enum(['customer_arrived', 'table_occupied', 'table_cleared']),
  payload: z.record(z.string(), z.unknown()).optional()
});

export function createHARouter() {
  const baseAuth = requireAuth(['owner', 'admin', 'manager', 'supervisor']);
  const auth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
    let crossTenant = false;
    const authRes = await baseAuth(c, async () => {
      if (hasCrossTenantOverride(c as unknown as Parameters<typeof hasCrossTenantOverride>[0])) {
        crossTenant = true;
        return;
      }
      await next();
    });
    if (crossTenant) {
      return c.json({ error: 'Cross-tenant access denied' }, 403);
    }
    return authRes;
  };
  const app = new Hono<{ Bindings: Env }>();

  // ── Devices ──

  // GET /api/ha/devices — list all cached device states
  app.get('/devices', auth, async(c) => {
    try {
      const db = (c.env.AURA_DB ?? c.env.DB) as import('@cloudflare/workers-types').D1Database;
      const mockMode = c.env.HA_MOCK === 'true';

      const tenantId = resolveHaTenant(c);
      let results: Array<{ entity_id: string; state: string; attributes: string | null; last_changed: string; last_updated: string; tenant_id?: string | null }> = [];
      try {
        const res = await db
          .prepare('SELECT entity_id, state, attributes, last_changed, last_updated, tenant_id FROM ha_device_states ORDER BY entity_id')
          .all<{ entity_id: string; state: string; attributes: string | null; last_changed: string; last_updated: string; tenant_id?: string | null }>();
        results = res.results || [];
      } catch {
        const res = await db
          .prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states ORDER BY entity_id')
          .all<{ entity_id: string; state: string; attributes: string | null; last_changed: string; last_updated: string }>();
        results = res.results || [];
      }

      const devices = (results || [])
        .filter((r) => matchesHaTenant(r as unknown as Record<string, unknown>, tenantId))
        .map((r) => ({
          entity_id: r.entity_id,
          state: r.state,
          attributes: r.attributes ? safeParseJsonObject(r.attributes) : null,
          last_changed: r.last_changed,
          last_updated: r.last_updated
        }));

      if (mockMode) {
        return c.json({ mock: true, devices });
      }
      return c.json({ devices });
    } catch (err) {
      log.error('list_devices error', { message: (err as Error).message });
      return c.json({ error: 'Failed to list devices' }, 500);
    }
  });

  // GET /api/ha/devices/:entityId — single device state
  app.get('/devices/:entityId', auth, async(c) => {
    const entityId = c.req.param('entityId');
    return getDeviceState(c.env, entityId, resolveHaTenant(c));
  });

  // POST /api/ha/devices/:entityId/toggle — toggle device
  app.post('/devices/:entityId/toggle', auth, async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = ToggleDeviceSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }
      const on = parsed.data.action === 'on';
      const entityId = c.req.param('entityId');
      return toggleDevice(c.env, entityId, on, resolveHaTenant(c));
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
  });

  // GET /api/ha/devices/zone/:zone — devices by zone
  app.get('/devices/zone/:zone', auth, async(c) => {
    const zone = c.req.param('zone');
    return getZoneDevices(c.env, zone, resolveHaTenant(c));
  });

  // ── Automations ──

  // POST /api/ha/automations/trigger — trigger HA automation
  app.post('/automations/trigger', auth, async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = TriggerAutomationSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }
      return triggerAutomation(
        c.env,
        parsed.data.automation_id,
        parsed.data.payload ?? { trigger_entity: parsed.data.trigger_entity },
        resolveHaTenant(c)
      );
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
  });

  // GET /api/ha/automations/log — recent automation execution log
  app.get('/automations/log', auth, async(c) => {
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    return getAutomationLog(c.env, limit, resolveHaTenant(c));
  });

  // ── Dining Presence ──

  // POST /api/ha/presence/dispatch — trigger presence event (customer_arrived, table_occupied, etc.)
  app.post('/presence/dispatch', auth, async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = DispatchPresenceSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }
      const result = await dispatchDiningPresence(
        c.env as Record<string, unknown>,
        parsed.data.event as DiningPresenceEvent,
        parsed.data.payload ?? {},
        resolveHaTenant(c)
      );
      return c.json({ ...result, success: true });
    } catch (err) {
      log.error('dispatch_presence_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to dispatch presence event' }, 500);
    }
  });

  // ── Inbound Webhook ──

  // POST /api/ha/webhook — receive state updates or automation logs from HA
  app.post('/webhook', async(c) => {
    try {
      const isProd = c.env?.ENVIRONMENT === 'production' || c.env?.NODE_ENV === 'production';
      const allowUnsignedDev = !isProd && (c.env as Record<string, unknown>)?.ALLOW_UNSIGNED_HA_WEBHOOK === 'true';
      const secret = (c.env.HA_WEBHOOK_SECRET ?? '') as string;
      if (!secret && !allowUnsignedDev) {
        return c.json({ error: 'HA webhook secret not configured' }, 503);
      }
      const rawBody = await c.req.text().catch(() => '');
      if (secret) {
        if (c.req.query('token')) {
          return c.json({ error: 'Query token is not supported; pass X-HA-Signature header' }, 401);
        }
        const sig =
          c.req.header('x-ha-signature') ??
          c.req.header('x-webhook-signature') ??
          '';
        if (!sig) {
          return c.json({ error: 'Unauthorized HA webhook signature' }, 401);
        }
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          enc.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const macBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
        const expectedHex = Array.from(new Uint8Array(macBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const normalizedSig = sig.replace(/^sha256=/i, '').trim().toLowerCase();
        const aBytes = enc.encode(normalizedSig);
        const bBytes = enc.encode(expectedHex);
        let diff = aBytes.length === bBytes.length ? 0 : 1;
        if (diff === 0) {
          for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
        }
        if (diff !== 0) {
          return c.json({ error: 'Unauthorized HA webhook signature' }, 401);
        }
      }

      const rawTimestamp =
        c.req.header('x-ha-timestamp') ??
        c.req.header('x-webhook-timestamp') ??
        c.req.header('x-timestamp');
      if (!isFreshHaWebhookTimestamp(rawTimestamp)) {
        return c.json({ error: 'Stale or invalid webhook timestamp' }, 401);
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }

      const rawHeaderTenant = (c.req.header('x-tenant-id') ?? c.req.header('X-Tenant-ID') ?? '').trim();
      const rawWebhookTenant = rawHeaderTenant === '*' ? '' : rawHeaderTenant;
      if (rawWebhookTenant && !/^[a-zA-Z0-9_-]{1,64}$/.test(rawWebhookTenant)) {
        return c.json({ error: 'Invalid tenant identifier' }, 400);
      }
      const configuredWebhookTenant = typeof (c.env as Record<string, unknown>)?.HA_WEBHOOK_TENANT === 'string'
        ? String((c.env as Record<string, unknown>).HA_WEBHOOK_TENANT).trim()
        : '';
      if (configuredWebhookTenant && rawWebhookTenant && rawWebhookTenant !== configuredWebhookTenant) {
        return c.json({ error: 'Cross-tenant webhook target denied' }, 403);
      }
      if (await isDuplicateHaWebhookReplay(c.env, rawBody)) {
        return c.json({ success: false, error: 'Duplicate webhook replay detected' }, 409);
      }
      const webhookTenant = configuredWebhookTenant
        || (secret ? (rawWebhookTenant || undefined) : resolvePilotStore(c.env));
      const result = await handleHAWebhook(c.env as Record<string, unknown>, body, webhookTenant);
      if (result.success) {
        return c.json(result);
      }
      // Ownership conflict is a client error; an unverifiable ownership lookup is retryable.
      return c.json(result, result.action_taken.startsWith('cross_tenant_blocked:') ? 409 : 503);
    } catch (err) {
      log.error('ha_webhook_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to process Home Assistant webhook' }, 500);
    }
  });

  return app;
}
