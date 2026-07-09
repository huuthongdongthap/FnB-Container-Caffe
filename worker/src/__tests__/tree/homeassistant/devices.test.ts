import { describe, it, expect, vi } from 'vitest';
import { getDeviceState, toggleDevice, getZoneDevices, cacheDeviceState } from '../../../tree/homeassistant/devices';
import { createMockEnv, createMockDB, mockRequest } from '../../test-utils';

function makeDBWithRows(rows: Record<string, unknown>[]) {
  const db = createMockDB();
  const mockStmt: any = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
  };
  if (rows.length > 0) {
    mockStmt.all.mockResolvedValue({ results: rows, success: true });
  }
  if (rows.length > 0) {
    mockStmt.first.mockResolvedValue(rows[0]);
  }
  (db as any).prepare = vi.fn(() => mockStmt);
  return db;
}

describe('getDeviceState', () => {
  it('returns device state from D1', async() => {
    const rows = [{
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: JSON.stringify({ brightness: 255, color_temp: 400 }),
      last_changed: '2026-07-05T10:00:00',
      last_updated: '2026-07-05T10:00:00'
    }];
    const db = makeDBWithRows(rows);
    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await getDeviceState(env, 'light.kitchen');
    expect(res).toBeDefined();
    expect((res as Response).status).toBe(200);
  });

  it('returns 404 when device not found and not mock', async() => {
    const db = createMockDB();
    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await getDeviceState(env, 'light.nonexistent');
    expect((res as Response).status).toBe(404);
  });
});

describe('toggleDevice', () => {
  it('updates device state in D1', async() => {
    const db = createMockDB();
    const runMock = vi.fn().mockResolvedValue({ success: true, changes: 1, lastRowId: 1 });
    const firstMock = vi.fn().mockResolvedValue({
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: 'null',
      last_changed: '2026-07-05T10:00:00',
      last_updated: '2026-07-05T10:00:00'
    });
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), run: runMock, first: firstMock } as any);
    (db as unknown as Record<string, unknown>).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await toggleDevice(env, 'light.kitchen', true);
    expect((res as Response).status).toBe(200);
    expect(prepareMock).toHaveBeenCalled();
  });

  it('returns 404 when device not found on toggle', async() => {
    const db = createMockDB();
    const firstMock = vi.fn().mockResolvedValue(null);
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), run: vi.fn(), first: firstMock } as any);
    (db as unknown as Record<string, unknown>).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await toggleDevice(env, 'light.nonexistent', true);
    expect((res as Response).status).toBe(404);
  });
});

describe('getZoneDevices', () => {
  it('returns devices filtered by zone pattern', async() => {
    const rows = [{
      entity_id: 'light.kitchen_1',
      state: 'on',
      attributes: JSON.stringify({}),
      last_changed: '2026-07-05T10:00:00',
      last_updated: '2026-07-05T10:00:00'
    }, {
      entity_id: 'light.kitchen_2',
      state: 'off',
      attributes: JSON.stringify({}),
      last_changed: '2026-07-05T10:00:00',
      last_updated: '2026-07-05T10:00:00'
    }];
    const db = makeDBWithRows(rows);
    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await getZoneDevices(env, 'kitchen');
    expect((res as Response).status).toBe(200);
    const body = (await (res as Response).json()) as any;
    expect(body.devices.length).toBe(2);
    expect(body.zone).toBe('kitchen');
  });
});

describe('cacheDeviceState', () => {
  it('inserts device state into D1 without throwing', async() => {
    const runMock = vi.fn().mockResolvedValue({ success: true, changes: 1, lastRowId: 1 });
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), run: runMock, first: vi.fn(), all: vi.fn() });
    const db = createMockDB();
    (db as any).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    await expect(cacheDeviceState(env as any, {
      entity_id: 'light.new_device',
      state: 'on',
      attributes: { friendly_name: 'New Device' },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString()
    })).resolves.toBeUndefined();
    expect(prepareMock).toHaveBeenCalled();
  });
});
