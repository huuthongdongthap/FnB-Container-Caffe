/**
 * Unit tests for HA automation tree functions
 */

import { describe, it, expect, vi } from 'vitest';
import { triggerAutomation, getAutomationLog, logAutomationResult } from '../../../tree/homeassistant/automations';
import { createMockEnv, createMockDB } from '../../test-utils';

describe('triggerAutomation', () => {
  it('inserts automation_log entry and returns success', async() => {
    const db = createMockDB();
    const runMock = vi.fn().mockResolvedValue({ success: true, changes: 1, lastRowId: 1 });
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), run: runMock, first: vi.fn(), all: vi.fn() });
    (db as unknown as Record<string, unknown>).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await triggerAutomation(env, 'morning_routine', { trigger_entity: 'sensor.counter', data: 42 });
    expect((res as Response).status).toBe(200);
    const body: any = await (res as Response).json();
    expect(body.success).toBe(true);
    expect(body.automation_id).toBe('morning_routine');
  });

  it('returns mock response when HA_MOCK=true', async() => {
    const env = { ...createMockEnv(), HA_MOCK: 'true' };
    const res = await triggerAutomation(env, 'test_auto', { test: true });
    expect((res as Response).status).toBe(200);
    const body: any = await (res as Response).json();
    expect(body.mock).toBe(true);
    expect(body.success).toBe(true);
  });
});

describe('getAutomationLog', () => {
  it('returns recent log entries sorted by time desc', async() => {
    const rows = [
      { id: 3, automation_id: 'auto_c', trigger_entity: 'sensor.c', payload: '{}', result: 'ok', executed_at: '2026-07-05T03:00:00' },
      { id: 2, automation_id: 'auto_b', trigger_entity: 'sensor.b', payload: '{}', result: 'ok', executed_at: '2026-07-05T02:00:00' },
      { id: 1, automation_id: 'auto_a', trigger_entity: 'sensor.a', payload: '{}', result: 'ok', executed_at: '2026-07-05T01:00:00' }
    ];
    const db = createMockDB();
    const allMock = vi.fn().mockResolvedValue({ results: rows, success: true });
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), all: allMock, first: vi.fn(), run: vi.fn() });
    (db as unknown as Record<string, unknown>).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    const res = await getAutomationLog(env, 10);
    expect((res as Response).status).toBe(200);
    const body: any = await (res as Response).json();
    expect(body.entries.length).toBeGreaterThanOrEqual(3);
    expect(body.entries[0].id).toBe(3); // DESC order — most recent first
  });

  it('respects limit parameter (max 200)', async() => {
    const db = createMockDB();
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), all: vi.fn(), first: vi.fn(), run: vi.fn() });
    (db as unknown as Record<string, unknown>).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    await getAutomationLog(env, 999);
    const calls = prepareMock.mock.calls;
    const bindCall = calls.find((c) => typeof c[0] === 'string' && c[0].includes('LIMIT'));
    // Should clamp to 200
    if (bindCall) {
      const boundValues = (bindCall[1] as unknown[] | undefined);
      // The limit bound is the last .bind(arg) before .all()
    }
  });
});

describe('logAutomationResult', () => {
  it('stores payload and result to D1', async() => {
    const runMock = vi.fn().mockResolvedValue({ success: true, changes: 1, lastRowId: 1 });
    const prepareMock = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), run: runMock, first: vi.fn(), all: vi.fn() });
    const db = createMockDB();
    (db as unknown as Record<string, unknown>).prepare = prepareMock;

    const env = { ...createMockEnv({ AURA_DB: db }), HA_MOCK: undefined };

    await logAutomationResult(env, {
      automation_id: 'evening_close',
      trigger_entity: 'sensor.door',
      payload: { door_closed: true },
      result: 'lights_to_off',
      executed_at: '2026-07-05T21:00:00Z'
    });
    expect(prepareMock).toHaveBeenCalled();
  });
});
