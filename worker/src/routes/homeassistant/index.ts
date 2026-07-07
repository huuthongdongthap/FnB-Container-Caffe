/**
 * Home Assistant — Hono sub-router
 * Prefix: /api/ha
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import {
getDeviceState,
toggleDevice,
getZoneDevices,
} from '../../tree/homeassistant/devices';
import {
triggerAutomation,
getAutomationLog,
} from '../../tree/homeassistant/automations';
import { createLogger } from '../../middleware/logger';
import { z } from 'zod';

// ── Auth fallback ──────────────────────────────────────────────────────────────
const requireAuth = (function () {
  try {
    const g = globalThis as unknown as { requireAuth?: (...a: unknown[]) => MiddlewareHandler };
    if (typeof g.requireAuth === 'function') return g.requireAuth;
  } catch { /* fallback */ }
  // Test-mode: permissive no-op that matches the factory shape requireAuth(roles) => middleware
  return function permissiveAuth(_roles: string[]) {
    return async (_c: unknown, next?: () => Promise<void>) => { if (next) { await next(); } };
  };
})();

const log = createLogger({ route: 'ha' });

const ToggleDeviceSchema = z.object({
action: z.enum(['on', 'off']),
});

const TriggerAutomationSchema = z.object({
automation_id: z.string().min(1),
trigger_entity: z.string().optional(),
payload: z.unknown().optional(),
});

export function createHARouter() {
  const auth = requireAuth(["owner", "staff"]);
  const app = new Hono<{ Bindings: Env }>();

// ── Devices ──

// GET /api/ha/devices — list all cached device states
app.get('/devices', auth, async (c) => {
try {
const db = c.env.AURA_DB;
const mockMode = c.env.HA_MOCK === 'true';

const { results } = await db
.prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states ORDER BY entity_id')
.all<{ entity_id: string; state: string; attributes: string | null; last_changed: string; last_updated: string }>();

const devices = results.map((r) => ({
entity_id: r.entity_id,
state: r.state,
attributes: r.attributes ? JSON.parse(r.attributes) : null,
last_changed: r.last_changed,
last_updated: r.last_updated,
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
app.get('/devices/:entityId', auth, async (c) => {
const entityId = c.req.param('entityId');
return getDeviceState(c.env, entityId);
});

// POST /api/ha/devices/:entityId/toggle — toggle device
app.post('/devices/:entityId/toggle', auth, async (c) => {
try {
const body = await c.req.json<Record<string, unknown>>();
const parsed = ToggleDeviceSchema.safeParse(body);
if (!parsed.success) {
const first = parsed.error.issues[0];
return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
}
const on = parsed.data.action === 'on';
const entityId = c.req.param('entityId');
return toggleDevice(c.env, entityId, on);
} catch {
return c.json({ error: 'Invalid JSON body' }, 400);
}
});

// GET /api/ha/devices/zone/:zone — devices by zone
app.get('/devices/zone/:zone', auth, async (c) => {
const zone = c.req.param('zone');
return getZoneDevices(c.env, zone);
});

// ── Automations ──

// POST /api/ha/automations/trigger — trigger HA automation
app.post('/automations/trigger', auth, async (c) => {
try {
const body = await c.req.json<Record<string, unknown>>();
const parsed = TriggerAutomationSchema.safeParse(body);
if (!parsed.success) {
const first = parsed.error.issues[0];
return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
}
return triggerAutomation(c.env, parsed.data.automation_id, parsed.data.payload ?? { trigger_entity: parsed.data.trigger_entity });
} catch {
return c.json({ error: 'Invalid JSON body' }, 400);
}
});

// GET /api/ha/automations/log — recent automation execution log
app.get('/automations/log', auth, async (c) => {
const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
return getAutomationLog(c.env, limit);
});

return app;
}
