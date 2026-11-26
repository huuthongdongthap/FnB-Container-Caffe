// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { issueStaffSession } from '../lib/staff-session';
import { createFrigateRoutes } from '../routes/integrations/frigate';
import { createHARouter } from '../routes/homeassistant';
import { handleHAWebhook } from '../tree/homeassistant/presence';
import { FrigateClient, FRIGATE_FETCH_TIMEOUT_MS } from '../clients/frigate-client';
import { getFrigateEvents, syncFrigateEvents } from '../tree/integrations/frigate/sync';

const JWT_SECRET = 'frigate-ha-tenant-hardening-jwt-secret-32!';
const HA_SECRET = 'ha-webhook-shared-secret';

type SqlGuard = (sql: string) => 'throw' | 'empty-first' | undefined;

/** Wraps node:sqlite in the D1 surface; `guard` lets a test sabotage selected statements. */
function createD1(sqlite: DatabaseSync, guard?: SqlGuard): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(): Promise<T | null> {
        const verdict = guard?.(sql);
        if (verdict === 'throw') throw new Error('simulated D1 failure');
        if (verdict === 'empty-first') return null;
        return (sqlite.prepare(sql).get(...(params as never[])) ?? null) as T | null;
      },
      async all<T = Record<string, unknown>>() {
        if (guard?.(sql) === 'throw') throw new Error('simulated D1 failure');
        return { results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[], success: true, meta: {} };
      },
      async run() {
        if (guard?.(sql) === 'throw') throw new Error('simulated D1 failure');
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return { success: true, results: [], meta: { changes: Number(info.changes ?? 0) } };
      }
    };
    return stmt;
  };
  return { prepare } as unknown as D1Database;
}

const USERS_DDL = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT,
    tenant_id TEXT DEFAULT 'default', is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1
  );
  INSERT INTO users (id, name, phone, role, tenant_id) VALUES
    ('staff_a', 'Staff A', '0900000001', 'staff', 'store-a'),
    ('staff_def', 'Staff Default', '0900000002', 'staff', 'default'),
    ('hq_owner', 'HQ', '0900000003', 'owner', 'hq');
`;

const FRIGATE_DDL = `
  CREATE TABLE frigate_events (
    id TEXT PRIMARY KEY, camera TEXT, label TEXT, start_time REAL, end_time REAL,
    score REAL, payload TEXT, received_at TEXT, tenant_id TEXT
  );
`;

const HA_DDL = `
  CREATE TABLE ha_device_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL,
    attributes TEXT, tenant_id TEXT NOT NULL DEFAULT 'default', last_changed TEXT, last_updated TEXT
  );
  CREATE TABLE ha_automation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id TEXT, trigger_entity TEXT, payload TEXT,
    result TEXT, executed_at TEXT, tenant_id TEXT
  );
`;

const openDbs: DatabaseSync[] = [];
function newSqlite(...ddl: string[]): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  for (const d of ddl) sqlite.exec(d);
  openDbs.push(sqlite);
  return sqlite;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  while (openDbs.length) openDbs.pop()?.close();
});

async function sessionToken(id: string, role: string, tenantId: string): Promise<string> {
  const { token } = await issueStaffSession(
    { JWT_SECRET },
    { id, name: id, phone: '0900000000', role, tenant_id: tenantId, is_active: 1, auth_version: 1 },
    { sessionType: 'staff-web' }
  );
  return token;
}

function frigateApp(db: D1Database, extraEnv: Record<string, unknown> = {}) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    c.env = { AURA_DB: db, JWT_SECRET, ...extraEnv } as unknown as Env;
    await next();
  });
  app.route('/api/integrations/frigate', createFrigateRoutes());
  return app;
}

const LIVE_FRIGATE = { FRIGATE_SYNC_ENABLED: 'true', FRIGATE_URL: 'https://frigate.local' };

function snapshotFetch() {
  return vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'HEAD' ? new Response(null, { status: 200 }) : new Response('jpeg-bytes', { status: 200 })
  );
}

function timeoutError(): DOMException {
  return new DOMException('The operation timed out.', 'TimeoutError');
}

const OWNED_CAMERA_ROW = "INSERT INTO frigate_events (id, camera, label, tenant_id) VALUES ('e1', 'cam_a', 'person', 'store-a')";

describe('Frigate snapshot tenant ownership fails closed', () => {
  async function snapshot(app: Hono<{ Bindings: Env }>, token: string, camera = 'cam_a') {
    return app.request(`http://localhost/api/integrations/frigate/camera/${camera}/snapshot`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  it('serves a camera the tenant has events for', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    sqlite.exec(OWNED_CAMERA_ROW);
    vi.stubGlobal('fetch', snapshotFetch());
    const res = await snapshot(frigateApp(createD1(sqlite), LIVE_FRIGATE), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('denies a concrete tenant when the events table is empty', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    const fetchSpy = snapshotFetch();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await snapshot(frigateApp(createD1(sqlite), LIVE_FRIGATE), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('denies a camera that only another tenant has events for', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    sqlite.exec("INSERT INTO frigate_events (id, camera, label, tenant_id) VALUES ('e1', 'cam_a', 'person', 'store-b')");
    const res = await snapshot(frigateApp(createD1(sqlite), LIVE_FRIGATE), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(403);
  });

  it('denies when the ownership query throws', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    sqlite.exec(OWNED_CAMERA_ROW);
    const db = createD1(sqlite, (sql) => (/FROM frigate_events/i.test(sql) ? 'throw' : undefined));
    const fetchSpy = snapshotFetch();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await snapshot(frigateApp(db, LIVE_FRIGATE), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('denies when the events table is missing entirely', async () => {
    const sqlite = newSqlite(USERS_DDL);
    const res = await snapshot(frigateApp(createD1(sqlite), LIVE_FRIGATE), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(403);
  });

  it('attributes rows with a blank tenant_id to the default tenant only', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    sqlite.exec("INSERT INTO frigate_events (id, camera, label, tenant_id) VALUES ('e1', 'cam_a', 'person', '  ')");
    vi.stubGlobal('fetch', snapshotFetch());
    const app = frigateApp(createD1(sqlite), LIVE_FRIGATE);
    expect((await snapshot(app, await sessionToken('staff_def', 'staff', 'default'))).status).toBe(200);
    expect((await snapshot(app, await sessionToken('staff_a', 'staff', 'store-a'))).status).toBe(403);
  });

  it('allows HQ to snapshot any camera even with no stored events', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    vi.stubGlobal('fetch', snapshotFetch());
    const res = await snapshot(frigateApp(createD1(sqlite), LIVE_FRIGATE), await sessionToken('hq_owner', 'owner', 'hq'));
    expect(res.status).toBe(200);
  });

  it('still returns the static mock response for an owned camera when Frigate is unconfigured', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    sqlite.exec(OWNED_CAMERA_ROW);
    const res = await snapshot(frigateApp(createD1(sqlite)), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mock: true });
  });

  it('keeps denying unowned cameras when Frigate is unconfigured', async () => {
    const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
    const res = await snapshot(frigateApp(createD1(sqlite)), await sessionToken('staff_a', 'staff', 'store-a'));
    expect(res.status).toBe(403);
  });

  describe('upstream timeouts', () => {
    function ownedApp() {
      const sqlite = newSqlite(USERS_DDL, FRIGATE_DDL);
      sqlite.exec(OWNED_CAMERA_ROW);
      return frigateApp(createD1(sqlite), LIVE_FRIGATE);
    }

    it('returns 504 when the availability probe times out and bounds the request with a signal', async () => {
      const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => {
        throw timeoutError();
      });
      vi.stubGlobal('fetch', fetchSpy);
      const res = await snapshot(ownedApp(), await sessionToken('staff_a', 'staff', 'store-a'));
      expect(res.status).toBe(504);
      expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('returns 504 when the snapshot download times out', async () => {
      const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'HEAD') return new Response(null, { status: 200 });
        throw timeoutError();
      });
      vi.stubGlobal('fetch', fetchSpy);
      const res = await snapshot(ownedApp(), await sessionToken('staff_a', 'staff', 'store-a'));
      expect(res.status).toBe(504);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('keeps non-timeout upstream failures as 500', async () => {
      vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'HEAD') return new Response(null, { status: 200 });
        throw new TypeError('fetch failed');
      }));
      const res = await snapshot(ownedApp(), await sessionToken('staff_a', 'staff', 'store-a'));
      expect(res.status).toBe(500);
    });
  });
});

describe('Frigate client bounds every request with a timeout', () => {
  const client = new FrigateClient({ url: 'https://frigate.local', apiKey: 'k', isMock: false });

  it('passes an AbortSignal to events, event and snapshot requests', async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
    vi.stubGlobal('fetch', fetchSpy);
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    await client.getRecentEvents();
    await client.getEvent('evt');
    await client.getCameraSnap('cam');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    for (const call of fetchSpy.mock.calls) {
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(timeoutSpy).toHaveBeenCalledTimes(3);
    expect(timeoutSpy).toHaveBeenCalledWith(FRIGATE_FETCH_TIMEOUT_MS);
  });

  it('propagates timeouts instead of reporting an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw timeoutError();
    }));
    await expect(client.getRecentEvents()).rejects.toMatchObject({ name: 'TimeoutError' });
    await expect(client.getEvent('evt')).rejects.toMatchObject({ name: 'TimeoutError' });
    await expect(client.getCameraSnap('cam')).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('syncFrigateEvents reports ok:false when Frigate times out', async () => {
    const sqlite = newSqlite(FRIGATE_DDL);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw timeoutError();
    }));
    const result = await syncFrigateEvents(
      { AURA_DB: createD1(sqlite), ...LIVE_FRIGATE },
      { tenantId: 'store-a' }
    );
    expect(result.ok).toBe(false);
    expect(result.synced).toBe(0);
  });
});

describe('getFrigateEvents never serves unscoped rows to a non-default tenant', () => {
  const LEGACY_DDL = `
    CREATE TABLE frigate_events (
      id TEXT PRIMARY KEY, camera TEXT, label TEXT, start_time REAL, end_time REAL,
      score REAL, payload TEXT, received_at TEXT
    );
    INSERT INTO frigate_events (id, camera, label, start_time) VALUES ('legacy-1', 'cam_a', 'person', 100);
  `;

  it('returns no rows for a non-default tenant when the tenant-scoped query fails', async () => {
    const db = createD1(newSqlite(LEGACY_DDL));
    const { events } = await getFrigateEvents({ AURA_DB: db }, { tenantId: 'store-a' });
    expect(events).toEqual([]);
  });

  it('still serves legacy rows to the default tenant on a schema without tenant_id', async () => {
    const db = createD1(newSqlite(LEGACY_DDL));
    const { events } = await getFrigateEvents({ AURA_DB: db }, { tenantId: 'default' });
    expect(events.map((e) => e.id)).toEqual(['legacy-1']);
  });

  it('does not mask unrelated database failures as an unscoped read', async () => {
    const sqlite = newSqlite(FRIGATE_DDL);
    const db = createD1(sqlite, (sql) => (/FROM frigate_events/i.test(sql) ? 'throw' : undefined));
    await expect(getFrigateEvents({ AURA_DB: db }, { tenantId: 'default' })).rejects.toThrow('simulated D1 failure');
  });
});

describe('Home Assistant webhook tenant isolation', () => {
  function haApp(db: D1Database, extraEnv: Record<string, unknown> = {}) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.env = { AURA_DB: db, JWT_SECRET, ENVIRONMENT: 'development', HA_WEBHOOK_SECRET: HA_SECRET, ...extraEnv } as unknown as Env;
      await next();
    });
    app.route('/api/ha', createHARouter());
    return app;
  }

  function webhook(app: Hono<{ Bindings: Env }>, body: Record<string, unknown>, headers: Record<string, string> = {}) {
    return app.request('http://localhost/api/ha/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ha-token': HA_SECRET, ...headers },
      body: JSON.stringify(body)
    });
  }

  function deviceRow(sqlite: DatabaseSync, entity: string) {
    return sqlite.prepare('SELECT state, tenant_id FROM ha_device_states WHERE entity_id = ?').get(entity) as
      | { state: string; tenant_id: string }
      | undefined;
  }

  const OTHER_TENANT_DEVICE = "INSERT INTO ha_device_states (entity_id, state, tenant_id) VALUES ('light.patio', 'off', 'store-b')";
  const OWNERSHIP_LOOKUP = /^SELECT tenant_id FROM ha_device_states/i;

  it('reports 409 with success:false when the entity belongs to another tenant', async () => {
    const sqlite = newSqlite(HA_DDL);
    sqlite.exec(OTHER_TENANT_DEVICE);
    const res = await webhook(haApp(createD1(sqlite)), { entity_id: 'light.patio', state: 'on' }, { 'x-tenant-id': 'store-a' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, action_taken: 'cross_tenant_blocked:light.patio' });
    expect(deviceRow(sqlite, 'light.patio')).toEqual({ state: 'off', tenant_id: 'store-b' });
  });

  it('returns 200 success:true for an owned entity update', async () => {
    const sqlite = newSqlite(HA_DDL);
    sqlite.exec("INSERT INTO ha_device_states (entity_id, state, tenant_id) VALUES ('light.patio', 'off', 'store-a')");
    const res = await webhook(haApp(createD1(sqlite)), { entity_id: 'light.patio', state: 'on' }, { 'x-tenant-id': 'store-a' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, action_taken: 'device_updated:light.patio' });
    expect(deviceRow(sqlite, 'light.patio')).toEqual({ state: 'on', tenant_id: 'store-a' });
  });

  it('ignores a client-supplied body tenant_id for device updates', async () => {
    const sqlite = newSqlite(HA_DDL);
    const app = haApp(createD1(sqlite), { HA_WEBHOOK_TENANT: 'store-a' });
    const res = await webhook(app, { entity_id: 'sensor.temp', state: '21', tenant_id: 'store-b' });
    expect(res.status).toBe(200);
    expect(deviceRow(sqlite, 'sensor.temp')?.tenant_id).toBe('store-a');
  });

  it('ignores a client-supplied body tenant_id for automation feedback', async () => {
    const sqlite = newSqlite(HA_DDL);
    const app = haApp(createD1(sqlite), { HA_WEBHOOK_TENANT: 'store-a' });
    const res = await webhook(app, { automation_id: 'evening_scene', tenant_id: 'store-b' });
    expect(res.status).toBe(200);
    const row = sqlite.prepare('SELECT tenant_id FROM ha_automation_log WHERE automation_id = ?').get('evening_scene') as { tenant_id: string };
    expect(row.tenant_id).toBe('store-a');
  });

  it('falls back to the pilot store, not the body tenant, when no webhook tenant is configured', async () => {
    const sqlite = newSqlite(HA_DDL);
    const app = haApp(createD1(sqlite), { PILOT_TENANT_ID: 'store-a' });
    await webhook(app, { entity_id: 'sensor.temp', state: '21', tenant_id: 'store-b' });
    expect(deviceRow(sqlite, 'sensor.temp')?.tenant_id).toBe('store-a');
  });

  it('cannot take over another tenant entity by naming the owner in the body', async () => {
    const sqlite = newSqlite(HA_DDL);
    sqlite.exec(OTHER_TENANT_DEVICE);
    const app = haApp(createD1(sqlite), { HA_WEBHOOK_TENANT: 'store-a' });
    const res = await webhook(app, { entity_id: 'light.patio', state: 'on', tenant_id: 'store-b' });
    expect(res.status).toBe(409);
    expect(deviceRow(sqlite, 'light.patio')).toEqual({ state: 'off', tenant_id: 'store-b' });
  });

  it('blocks a non-default tenant when the ownership lookup errors', async () => {
    const sqlite = newSqlite(HA_DDL);
    sqlite.exec(OTHER_TENANT_DEVICE);
    const db = createD1(sqlite, (sql) => (OWNERSHIP_LOOKUP.test(sql) ? 'throw' : undefined));
    const result = await handleHAWebhook({ AURA_DB: db }, { entity_id: 'light.patio', state: 'on' }, 'store-a');
    expect(result).toEqual({ success: false, action_taken: 'tenant_lookup_failed:light.patio' });
    expect(deviceRow(sqlite, 'light.patio')).toEqual({ state: 'off', tenant_id: 'store-b' });

    const res = await webhook(haApp(db), { entity_id: 'light.patio', state: 'on' }, { 'x-tenant-id': 'store-a' });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });

  it('does not overwrite a conflicting entity owned by another tenant even if the lookup misses it', async () => {
    const sqlite = newSqlite(HA_DDL);
    sqlite.exec(OTHER_TENANT_DEVICE);
    const db = createD1(sqlite, (sql) => (OWNERSHIP_LOOKUP.test(sql) ? 'empty-first' : undefined));
    const result = await handleHAWebhook({ AURA_DB: db }, { entity_id: 'light.patio', state: 'on' }, 'store-a');
    expect(result).toEqual({ success: false, action_taken: 'cross_tenant_blocked:light.patio' });
    expect(deviceRow(sqlite, 'light.patio')).toEqual({ state: 'off', tenant_id: 'store-b' });
  });

  it('lets the default tenant update a legacy row with a blank tenant_id', async () => {
    const sqlite = newSqlite(HA_DDL);
    sqlite.exec("INSERT INTO ha_device_states (entity_id, state, tenant_id) VALUES ('light.patio', 'off', '')");
    const result = await handleHAWebhook({ AURA_DB: createD1(sqlite) }, { entity_id: 'light.patio', state: 'on' }, 'default');
    expect(result.success).toBe(true);
    expect(deviceRow(sqlite, 'light.patio')?.state).toBe('on');
  });

  describe('schema without a tenant_id column', () => {
    const LEGACY_HA = `
      CREATE TABLE ha_device_states (
        entity_id TEXT PRIMARY KEY, state TEXT, attributes TEXT, last_changed TEXT, last_updated TEXT
      );
      CREATE TABLE ha_automation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id TEXT, trigger_entity TEXT, payload TEXT,
        result TEXT, executed_at TEXT
      );
    `;

    it('keeps working for the default tenant', async () => {
      const sqlite = newSqlite(LEGACY_HA);
      const db = createD1(sqlite);
      expect((await handleHAWebhook({ AURA_DB: db }, { entity_id: 'light.a', state: 'on' }, 'default')).success).toBe(true);
      expect((await handleHAWebhook({ AURA_DB: db }, { automation_id: 'scene' }, 'default')).success).toBe(true);
    });

    it('fails closed for any other tenant', async () => {
      const sqlite = newSqlite(LEGACY_HA);
      const db = createD1(sqlite);
      const device = await handleHAWebhook({ AURA_DB: db }, { entity_id: 'light.a', state: 'on' }, 'store-a');
      expect(device.success).toBe(false);
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ha_device_states').get()).toEqual({ n: 0 });
      await expect(handleHAWebhook({ AURA_DB: db }, { automation_id: 'scene' }, 'store-a')).rejects.toThrow();
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ha_automation_log').get()).toEqual({ n: 0 });
    });
  });
});
