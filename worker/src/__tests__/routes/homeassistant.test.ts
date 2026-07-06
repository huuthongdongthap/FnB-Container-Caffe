/**
 * Unit tests for Home Assistant route (createHARouter)
 */

import { describe, it, expect, vi } from 'vitest';
import { createHARouter } from '../../routes/homeassistant';
import { createMockEnv, createMockDB } from '../test-utils';

function makeDB(rows?: Record<string, unknown>[], firstRow?: Record<string, unknown> | null) {
const allMock = vi.fn().mockResolvedValue({ results: rows ?? [], success: true });
const firstMock = vi.fn().mockResolvedValue(firstRow ?? null);
const runMock = vi.fn().mockResolvedValue({ success: true, changes: 1, lastRowId: 1 });
const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), all: allMock, first: firstMock, run: runMock });
const db = createMockDB();
(db as unknown as Record<string, unknown>).prepare = prepareMock as unknown as typeof db.prepare;
(db as unknown as Record<string, unknown>)._prepare = prepareMock;
return { db, prepareMock, allMock, firstMock, runMock };
}

function makeHAEnv(db?: ReturnType<typeof makeDB>['db'], overrides: Record<string, unknown> = {}) {
const resolvedDb = db ?? createMockDB();
return {
...createMockEnv({ AURA_DB: resolvedDb }),
HA_MOCK: 'true',
...overrides,
} as any;
}

describe('createHARouter', () => {
const router = createHARouter();

describe('GET /devices', () => {
it('returns 200 with devices array', async () => {
const { db } = makeDB([
{ entity_id: 'light.kitchen', state: 'on', attributes: null, last_changed: '', last_updated: '' },
{ entity_id: 'ac.living_room', state: 'off', attributes: null, last_changed: '', last_updated: '' },
]);
const env = makeHAEnv(db);
const res = await router.fetch(new Request('https://test.aura/devices', { method: 'GET' }), env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(Array.isArray(body.devices)).toBe(true);
expect(body.devices.length).toBe(2);
expect(body.mock).toBe(true);
});
});

describe('GET /devices/:entityId', () => {
it('returns 200 with device data', async () => {
const { db } = makeDB([], { entity_id: 'light.kitchen', state: 'on', attributes: null, last_changed: '', last_updated: '' });
const env = makeHAEnv(db);
const res = await router.fetch(new Request('https://test.aura/devices/light.kitchen', { method: 'GET' }), env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(body.device.entity_id).toBe('light.kitchen');
});
});

describe('POST /devices/:entityId/toggle', () => {
it('returns 200 for valid toggle-on body', async () => {
const env = makeHAEnv();
const req = new Request('https://test.aura/devices/light.kitchen/toggle', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'on' }),
});
const res = await router.fetch(req, env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(body.result.state).toBe('on');
expect(body.mock).toBe(true);
});

it('returns 200 for valid toggle-off body', async () => {
const env = makeHAEnv();
const req = new Request('https://test.aura/devices/ac.living_room/toggle', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'off' }),
});
const res = await router.fetch(req, env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(body.result.state).toBe('off');
});

it('returns 400 for invalid body (missing action)', async () => {
const env = makeHAEnv();
const req = new Request('https://test.aura/devices/light.kitchen/toggle', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({}),
});
const res = await router.fetch(req, env);
expect(res.status).toBe(400);
});
});

describe('GET /devices/zone/:zone', () => {
it('returns devices filtered by zone', async () => {
const { db } = makeDB([
{ entity_id: 'light.kitchen_1', state: 'on', attributes: null, last_changed: '', last_updated: '' },
{ entity_id: 'light.kitchen_2', state: 'off', attributes: null, last_changed: '', last_updated: '' },
]);
const env = makeHAEnv(db);
env.HA_MOCK = 'false';
const res = await router.fetch(new Request('https://test.aura/devices/zone/kitchen', { method: 'GET' }), env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(Array.isArray(body.devices)).toBe(true);
expect(body.devices.length).toBe(2);
expect(body.zone).toBe('kitchen');
});
});

describe('POST /automations/trigger', () => {
it('returns 200 for valid automation trigger', async () => {
const env = makeHAEnv();
const req = new Request('https://test.aura/automations/trigger', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ automation_id: 'morning_routine', trigger_entity: 'sensor.counter' }),
});
const res = await router.fetch(req, env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(body.success).toBe(true);
expect(body.automation_id).toBe('morning_routine');
});

it('returns 400 for missing automation_id', async () => {
const env = makeHAEnv();
const req = new Request('https://test.aura/automations/trigger', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({}),
});
const res = await router.fetch(req, env);
expect(res.status).toBe(400);
});
});

describe('GET /automations/log', () => {
it('returns 200 with recent log entries', async () => {
const env = makeHAEnv();
const res = await router.fetch(new Request('https://test.aura/automations/log?limit=10', { method: 'GET' }), env);
expect(res.status).toBe(200);
const body = (await res.json()) as Record<string, unknown>;
expect(body.entries).toBeDefined();
expect(Array.isArray(body.entries)).toBe(true);
});
});

describe('mock mode behavior', () => {
it('all endpoints return valid responses when HA_MOCK=true', async () => {
const env = makeHAEnv();
const endpoints = [
{ method: 'GET' as const, path: '/devices' },
{ method: 'GET' as const, path: '/devices/light.kitchen' },
{ method: 'POST' as const, path: '/devices/light.kitchen/toggle', body: { action: 'on' } },
{ method: 'GET' as const, path: '/devices/zone/kitchen' },
{ method: 'POST' as const, path: '/automations/trigger', body: { automation_id: 'test' } },
{ method: 'GET' as const, path: '/automations/log' },
];
for (const ep of endpoints) {
const init: RequestInit = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
if (ep.body) {
init.body = JSON.stringify(ep.body);
}
const res = await router.fetch(new Request('https://test.aura' + ep.path, init), env);
expect(res.status).toBeLessThan(400);
}
});
});
});
