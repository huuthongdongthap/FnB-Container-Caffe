/**
 * Home Assistant — Device state management (tree layer)
 * Handles device state caching, toggling, and zone queries.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'ha-devices' });

export interface DeviceState {
entity_id: string;
state: string;
attributes: Record<string, unknown> | null;
last_changed: string;
last_updated: string;
}

export interface ToggleResult {
entity_id: string;
state: string;
attributes: Record<string, unknown> | null;
}

export async function getDeviceState(env: Record<string, unknown>, entityId: string): Promise<Response> {
try {
const mockMode = env.HA_MOCK === 'true';
const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

if (mockMode) {
return jsonResponse({
mock: true,
device: {
entity_id: entityId,
state: 'unknown',
attributes: null,
last_changed: '',
last_updated: '',
},
});
}

const row = await db
.prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states WHERE entity_id = ?')
.bind(entityId)
.first<DeviceState>();

if (!row) {
return errorResponse('Device not found', 404);
}

const device: DeviceState = {
entity_id: row.entity_id,
state: row.state,
attributes: row.attributes ? JSON.parse(row.attributes as string) : null,
last_changed: row.last_changed,
last_updated: row.last_updated,
};

return jsonResponse({ device });
} catch (err) {
log.error('getDeviceState error', { message: (err as Error).message, entityId });
return errorResponse('Failed to fetch device state', 500);
}
}

export async function toggleDevice(env: Record<string, unknown>, entityId: string, on: boolean): Promise<Response> {
try {
const mockMode = env.HA_MOCK === 'true';
const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
const newState = on ? 'on' : 'off';

if (mockMode) {
return jsonResponse({
mock: true,
result: {
entity_id: entityId,
state: newState,
attributes: null,
} satisfies ToggleResult,
});
}

await db
.prepare('UPDATE ha_device_states SET state = ?, last_updated = datetime("now") WHERE entity_id = ?')
.bind(newState, entityId)
.run();

const row = await db
.prepare('SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states WHERE entity_id = ?')
.bind(entityId)
.first<{ entity_id: string; state: string; attributes: string | null }>();

if (!row) {
return errorResponse('Device not found', 404);
}

const result: ToggleResult = {
entity_id: row.entity_id,
state: row.state,
attributes: row.attributes ? JSON.parse(row.attributes as string) : null,
};

return jsonResponse({ result });
} catch (err) {
log.error('toggleDevice error', { message: (err as Error).message, entityId, on });
return errorResponse('Failed to toggle device', 500);
}
}

export async function getZoneDevices(env: Record<string, unknown>, zone: string): Promise<Response> {
try {
const mockMode = env.HA_MOCK === 'true';
const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

if (mockMode) {
return jsonResponse({ mock: true, zone, devices: [] });
}

const likePattern = `%.${zone}%`;

const { results } = await db
.prepare("SELECT entity_id, state, attributes, last_changed, last_updated FROM ha_device_states WHERE entity_id LIKE ?")
.bind(likePattern)
.all<DeviceState>();

const devices = results.map((r) => ({
entity_id: r.entity_id,
state: r.state,
attributes: r.attributes ? JSON.parse(r.attributes as string) : null,
last_changed: r.last_changed,
last_updated: r.last_updated,
}));

return jsonResponse({ zone, devices });
} catch (err) {
log.error('getZoneDevices error', { message: (err as Error).message, zone });
return errorResponse('Failed to fetch zone devices', 500);
}
}

export async function cacheDeviceState(env: Record<string, unknown>, device: DeviceState): Promise<void> {
try {
const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
await db
.prepare(
'INSERT OR REPLACE INTO ha_device_states (entity_id, state, attributes, last_changed, last_updated) VALUES (?, ?, ?, ?, datetime("now"))'
)
.bind(
device.entity_id,
device.state,
JSON.stringify(device.attributes ?? {}),
device.last_changed
)
.run();
} catch (err) {
log.error('cacheDeviceState error', { message: (err as Error).message, entity_id: device.entity_id });
}
}
