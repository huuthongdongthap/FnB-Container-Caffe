/**
 * Unit tests for Home Assistant route (createHARouter)
 *
 * The HA router is a Hono sub-router mounted at /api/ha in the main app.
 * When testing the sub-router directly via router.fetch(), use paths
 * relative to the router (no /api/ha prefix) so Hono can match routes.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createHARouter } from '../../routes/homeassistant';
import { createMockEnv, createMockDB, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

// ── Auth token ────────────────────────────────────────────────────────────────

let authHeader: string;

beforeAll(async () => {
  const token = await generateJWT(
    { id: 'test-user', email: 'test@aura.cafe', name: 'Test User', role: 'owner' },
    TEST_JWT_SECRET,
    '1h'
  );
  authHeader = `Bearer ${token}`;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const router = createHARouter();

function makeDB(rows?: Record<string, unknown>[], firstRow?: Record<string, unknown> | null) {
  const allMock = async () => ({ results: rows ?? [], success: true });
  const firstMock = async () => firstRow ?? null;
  const runMock = async () => ({ success: true, changes: 1, lastRowId: 1 });

  const stmt = () => ({
    bind: () => stmt(),
    all: allMock,
    first: firstMock,
    run: runMock,
  });

  return {
    prepare: stmt as () => ReturnType<typeof createMockDB>['prepare'] extends (sql: string) => infer R ? R : never,
  };
}

// Use createMockDB from test-utils (has correct type shape)
function stubDB(
  rows: Record<string, unknown>[] = [],
  firstRow: Record<string, unknown> | null = null
) {
  const db = createMockDB();
  const results = rows;
  let currentFirst = firstRow;
  let firstIndex = -1;

  const stmt = () => ({
    _sql: '',
    _binds: [] as unknown[],
    bind(...args: unknown[]) {
      stmt()._binds = args;
      return stmt();
    },
    async all() {
      return { results, success: true };
    },
    async first() {
      if (firstRow === null) return null;
      firstIndex++;
      return results[firstIndex] ?? null;
    },
    async run() {
      return { success: true, changes: 1, lastRowId: 1 };
    },
  });

  // Override prepare on the db mock
  (db as unknown as Record<string, unknown>).prepare = () => stmt() as ReturnType<typeof db.prepare>;
  return db;
}

function makeEnv(db?: ReturnType<typeof stubDB>, overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: db ?? stubDB(),
    AUTH_KV: { get: async () => null } as unknown as import('@cloudflare/workers-types').KVNamespace,
    JWT_SECRET: TEST_JWT_SECRET,
    HA_MOCK: 'true',
    ...overrides,
  } as Record<string, unknown>;
}

function authFetch(path: string, init: RequestInit = {}, env: Record<string, unknown>) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', authHeader);
  // Path must be relative to the router (no /api/ha prefix)
  const url = 'https://test.aura' + path;
  return router.fetch(new Request(url, { ...init, headers }), env);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createHARouter', () => {
  describe('GET /devices', () => {
    it('returns 200 with devices array', async () => {
      const db = stubDB([
        { entity_id: 'light.kitchen', state: 'on', attributes: null, last_changed: '', last_updated: '' },
        { entity_id: 'ac.living_room', state: 'off', attributes: null, last_changed: '', last_updated: '' },
      ]);
      const env = makeEnv(db);
      const res = await authFetch('/devices', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(Array.isArray(body.devices)).toBe(true);
      expect(body.devices.length).toBe(2);
    });
  });

  describe('GET /devices/:entityId', () => {
    it('returns 200 with device data', async () => {
      const db = stubDB(
        [],
        { entity_id: 'light.kitchen', state: 'on', attributes: null, last_changed: '', last_updated: '' }
      );
      const env = makeEnv(db);
      const res = await authFetch('/devices/light.kitchen', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.device?.entity_id ?? body.entity_id).toBe('light.kitchen');
    });
  });

  describe('POST /devices/:entityId/toggle', () => {
    it('returns 200 for valid toggle-on body', async () => {
      const env = makeEnv();
      const req = new Request('https://test.aura/devices/light.kitchen/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'on' }),
      });
      const res = await router.fetch(req, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.result?.state ?? body.state).toBe('on');
    });

    it('returns 200 for valid toggle-off body', async () => {
      const env = makeEnv();
      const req = new Request('https://test.aura/devices/ac.living_room/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'off' }),
      });
      const res = await router.fetch(req, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.result?.state ?? body.state).toBe('off');
    });

    it('returns 400 for invalid body (missing action)', async () => {
      const env = makeEnv();
      const req = new Request('https://test.aura/devices/light.kitchen/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({}),
      });
      const res = await router.fetch(req, env);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /devices/zone/:zone', () => {
    it('returns devices filtered by zone', async () => {
      const db = stubDB([
        { entity_id: 'light.kitchen_1', state: 'on', attributes: null, last_changed: '', last_updated: '' },
        { entity_id: 'light.kitchen_2', state: 'off', attributes: null, last_changed: '', last_updated: '' },
      ]);
      const env = makeEnv(db);
      env.HA_MOCK = 'false';
      const res = await authFetch('/devices/zone/kitchen', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(Array.isArray(body.devices)).toBe(true);
      expect(body.devices.length).toBe(2);
    });
  });

  describe('POST /automations/trigger', () => {
    it('returns 200 for valid automation trigger', async () => {
      const env = makeEnv();
      const req = new Request('https://test.aura/automations/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ automation_id: 'morning_routine', trigger_entity: 'sensor.counter' }),
      });
      const res = await router.fetch(req, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.automation_id).toBe('morning_routine');
    });

    it('returns 400 for missing automation_id', async () => {
      const env = makeEnv();
      const req = new Request('https://test.aura/automations/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({}),
      });
      const res = await router.fetch(req, env);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /automations/log', () => {
    it('returns 200 with recent log entries', async () => {
      const env = makeEnv();
      const res = await authFetch('/automations/log?limit=10', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
    });
  });

  describe('mock mode behavior', () => {
    it('all endpoints return valid responses when HA_MOCK=true', async () => {
      const env = makeEnv();
      env.HA_MOCK = 'true';
      const endpoints: { method: string; path: string; body?: Record<string, unknown> }[] = [
        { method: 'GET', path: '/devices' },
        { method: 'GET', path: '/devices/light.kitchen' },
        { method: 'POST', path: '/devices/light.kitchen/toggle', body: { action: 'on' } },
        { method: 'GET', path: '/devices/zone/kitchen' },
        { method: 'POST', path: '/automations/trigger', body: { automation_id: 'test' } },
        { method: 'GET', path: '/automations/log' },
      ];
      for (const ep of endpoints) {
        const init: RequestInit = {
          method: ep.method,
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        };
        if (ep.body) init.body = JSON.stringify(ep.body);
        const url = 'https://test.aura' + ep.path;
        const res = await router.fetch(new Request(url, init), env);
        expect(res.status).toBeLessThan(400);
      }
    });
  });
});
