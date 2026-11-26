// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { toggleDevice } from '../tree/homeassistant/devices';
import { triggerAutomation } from '../tree/homeassistant/automations';
import { syncFrigateEvents } from '../tree/integrations/frigate/sync';
import { getOccupancyAnalytics } from '../tree/integrations/frigate/occupancy';

function createFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE ha_device_states (
      entity_id TEXT PRIMARY KEY, state TEXT, attributes TEXT, last_changed TEXT,
      last_updated TEXT, tenant_id TEXT
    );
    CREATE TABLE ha_automation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id TEXT, trigger_entity TEXT, payload TEXT,
      result TEXT, executed_at TEXT, tenant_id TEXT
    );
    CREATE TABLE frigate_events (
      id TEXT PRIMARY KEY, camera TEXT, label TEXT, start_time REAL, end_time REAL,
      score REAL, payload TEXT, received_at TEXT, tenant_id TEXT
    );
  `);

  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          params = values;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...(params as never[])) ?? null;
        },
        async all() {
          return { success: true, results: sqlite.prepare(sql).all(...(params as never[])) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(params as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return statement;
    }
  };

  return { sqlite, db };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Issues #244, #245, #246 — Home Assistant & Frigate regressions', () => {
  describe('#244: Home Assistant live toggle & automation dispatch', () => {
    it('dispatches real HA service call on toggle and updates cache only when HA returns 200', async () => {
      const { sqlite, db } = createFixture();
      sqlite
        .prepare('INSERT INTO ha_device_states VALUES (?, ?, ?, ?, ?, ?)')
        .run('light.bar', 'off', '{}', '2026-11-25T04:00:00Z', '2026-11-25T04:00:00Z', 'store-a');

      const fetchSpy = vi.fn(async () => new Response('[]', { status: 200 }));
      vi.stubGlobal('fetch', fetchSpy);

      const res = await toggleDevice(
        { AURA_DB: db, HA_MOCK: 'false', HA_URL: 'https://ha.local', HA_TOKEN: 'secret-token' },
        'light.bar',
        true,
        'store-a'
      );
      const body = (await res.json()) as { result?: { state: string }; dispatched?: boolean };

      expect(res.status).toBe(200);
      expect(body.result?.state).toBe('on');
      expect(body.dispatched).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://ha.local/api/services/light/turn_on');
      const row = sqlite.prepare('SELECT state FROM ha_device_states WHERE entity_id = ?').get('light.bar') as { state: string };
      expect(row.state).toBe('on');
      sqlite.close();
    });

    it('fails closed with 502 on HA toggle upstream error and preserves cached state', async () => {
      const { sqlite, db } = createFixture();
      sqlite
        .prepare('INSERT INTO ha_device_states VALUES (?, ?, ?, ?, ?, ?)')
        .run('light.bar', 'off', '{}', '2026-11-25T04:00:00Z', '2026-11-25T04:00:00Z', 'store-a');

      const fetchSpy = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
      vi.stubGlobal('fetch', fetchSpy);

      const res = await toggleDevice(
        { AURA_DB: db, HA_MOCK: 'false', HA_URL: 'https://ha.local', HA_TOKEN: 'bad-token' },
        'light.bar',
        true,
        'store-a'
      );

      expect(res.status).toBe(502);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const row = sqlite.prepare('SELECT state FROM ha_device_states WHERE entity_id = ?').get('light.bar') as { state: string };
      expect(row.state).toBe('off');
      sqlite.close();
    });

    it('dispatches real HA automation trigger and logs failed status on upstream failure', async () => {
      const { sqlite, db } = createFixture();
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(new Response('[]', { status: 200 }))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));
      vi.stubGlobal('fetch', fetchSpy);

      const okRes = await triggerAutomation(
        { AURA_DB: db, HA_MOCK: 'false', HA_URL: 'https://ha.local', HA_TOKEN: 'secret-token' },
        'lights_close',
        {},
        'store-a'
      );
      const okBody = (await okRes.json()) as { success?: boolean; result?: string };
      expect(okRes.status).toBe(200);
      expect(okBody.success).toBe(true);
      expect(okBody.result).toBe('dispatched to HA');
      expect(fetchSpy.mock.calls[0][0]).toBe('https://ha.local/api/services/automation/trigger');

      const failRes = await triggerAutomation(
        { AURA_DB: db, HA_MOCK: 'false', HA_URL: 'https://ha.local', HA_TOKEN: 'secret-token' },
        'lights_open',
        {},
        'store-a'
      );
      expect(failRes.status).toBe(502);

      const failLog = sqlite
        .prepare('SELECT result, tenant_id FROM ha_automation_log WHERE automation_id = ?')
        .get('lights_open') as { result: string; tenant_id: string };
      expect(failLog.result).toContain('failed:');
      expect(failLog.tenant_id).toBe('store-a');
      sqlite.close();
    });
  });

  describe('#245: Frigate upstream errors fail closed without persisting mock events', () => {
    it('returns ok:false and persists zero rows when Frigate upstream returns 503', async () => {
      const { sqlite, db } = createFixture();
      const fetchSpy = vi.fn(async () => new Response('Unavailable', { status: 503 }));
      vi.stubGlobal('fetch', fetchSpy);

      const result = await syncFrigateEvents(
        { AURA_DB: db as never, FRIGATE_SYNC_ENABLED: 'true', FRIGATE_URL: 'https://frigate.local' },
        { tenantId: 'store-a', limit: 3 }
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
      expect(result.mock).toBe(false);
      expect(result.synced).toBe(0);
      const rows = sqlite.prepare('SELECT * FROM frigate_events').all();
      expect(rows).toHaveLength(0);
      sqlite.close();
    });
  });

  describe('#246: Frigate upsert end_time lifecycle & active occupancy tracking', () => {
    it('updates end_time on repeated poll for same tenant and blocks cross-tenant hijack', async () => {
      const { sqlite, db } = createFixture();
      const startTime = Math.floor(Date.now() / 1000) - 120;
      const event = { id: 'same-person-event', camera: 'bar', label: 'person', start_time: startTime, end_time: undefined };
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(Response.json([event]))
        .mockResolvedValueOnce(Response.json([{ ...event, end_time: startTime + 60, score: 0.95 }]))
        .mockResolvedValueOnce(Response.json([{ ...event, end_time: startTime + 999, camera: 'hijacked' }]));
      vi.stubGlobal('fetch', fetchSpy);

      const env = { AURA_DB: db as never, FRIGATE_SYNC_ENABLED: 'true', FRIGATE_URL: 'https://frigate.local' };

      const first = await syncFrigateEvents(env, { tenantId: 'store-a' });
      expect(first.ok).toBe(true);
      expect(first.synced).toBe(1);

      const second = await syncFrigateEvents(env, { tenantId: 'store-a' });
      expect(second.ok).toBe(true);
      expect(second.synced).toBe(1);

      // Cross-tenant poll with same event ID must NOT overwrite store-a's row
      const crossTenant = await syncFrigateEvents(env, { tenantId: 'store-b' });
      expect(crossTenant.ok).toBe(true);
      expect(crossTenant.synced).toBe(0);

      const row = sqlite
        .prepare('SELECT camera, end_time, score, tenant_id FROM frigate_events WHERE id = ?')
        .get('same-person-event') as { camera: string; end_time: number | null; score: number | null; tenant_id: string };
      expect(row.end_time).toBe(startTime + 60);
      expect(row.score).toBe(0.95);
      expect(row.camera).toBe('bar');
      expect(row.tenant_id).toBe('store-a');
      sqlite.close();
    });

    it('counts ongoing person tracks (end_time IS NULL) and excludes ended events', async () => {
      const { sqlite, db } = createFixture();
      const now = new Date('2026-11-25T04:45:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const epoch = now.getTime() / 1000;

      const put = sqlite.prepare(
        'INSERT INTO frigate_events (id, camera, label, start_time, end_time, received_at, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      put.run('ongoing-person', 'bar', 'person', epoch - 600, null, now.toISOString(), 'store-a');
      put.run('departed-person-1', 'patio', 'person', epoch - 180, epoch - 120, now.toISOString(), 'store-a');
      put.run('departed-person-2', 'patio', 'person', epoch - 90, epoch - 30, now.toISOString(), 'store-a');

      const report = await getOccupancyAnalytics(
        { AURA_DB: db, FRIGATE_SYNC_ENABLED: 'true', FRIGATE_URL: 'https://frigate.local' },
        'store-a'
      );

      expect(report.current_occupancy).toBe(1);
      expect(report.camera_breakdown).toEqual([{ camera: 'bar', active_count: 1, last_seen: now.toISOString() }]);
      sqlite.close();
    });
  });
});
