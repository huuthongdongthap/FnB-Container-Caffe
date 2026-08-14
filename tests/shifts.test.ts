/**
 * Shifts Routes Tests — POST /clock-in, POST /clock-out, GET /
 *
 * Tests for shiftsRouter with D1 data and auth middleware.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createMockD1, createTestEnv } from './_test-utils';

// Auth bypass is handled by top-level vi.mock in _test-utils.ts

let shiftsRouter: any;

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountRouter() {
  const mod = await import('../worker/src/routes/shifts');
  shiftsRouter = mod.shiftsRouter;
}

describe('POST /clock-in', () => {
  test('clocks in staff and returns 201', async () => {
    const env = createTestEnv(createMockD1({ shifts: [] }));
    await mountRouter();

    const res = await shiftsRouter.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1', staff_name: 'Staff One' }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.staff_id).toBe('s1');
    expect(body.data.staff_name).toBe('Staff One');
  });

  test('returns 400 on missing staff_id', async () => {
    const env = createTestEnv(createMockD1({ shifts: [] }));
    await mountRouter();

    const res = await shiftsRouter.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_name: 'No ID' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on already clocked in today', async () => {
    const existingShift = {
      id: 'shift_existing',
      staff_id: 's1',
      staff_name: 'Staff One',
      clock_in: new Date().toISOString(),
      clock_out: null,
      date: new Date().toISOString().slice(0, 10),
      notes: null,
    };
    const env = createTestEnv(createMockD1({ shifts: [existingShift] }));
    await mountRouter();

    const res = await shiftsRouter.request('/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1', staff_name: 'Staff One' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already clocked/i);
  });
});

describe('POST /clock-out', () => {
  test('clocks out and returns 200', async () => {
    const activeShift = {
      id: 'shift_active',
      staff_id: 's1',
      staff_name: 'Staff One',
      clock_in: new Date(Date.now() - 3600000).toISOString(),
      clock_out: null,
      date: new Date().toISOString().slice(0, 10),
      notes: null,
    };
    const env = createTestEnv(createMockD1({ shifts: [activeShift] }));
    await mountRouter();

    const res = await shiftsRouter.request('/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 400 on missing staff_id', async () => {
    const env = createTestEnv(createMockD1({ shifts: [] }));
    await mountRouter();

    const res = await shiftsRouter.request('/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 when no active shift', async () => {
    const env = createTestEnv(createMockD1({ shifts: [] }));
    await mountRouter();

    const res = await shiftsRouter.request('/clock-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: 's1' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no active shift/i);
  });
});

describe('GET /', () => {
  test('returns shifts list', async () => {
    const env = createTestEnv(createMockD1({
      shifts: [
        { id: 's1', staff_id: 's1', staff_name: 'Staff One', clock_in: '2026-07-01T08:00:00Z', clock_out: '2026-07-01T17:00:00Z', hours_worked: 9, date: '2026-07-01', notes: null },
      ],
    }));
    await mountRouter();

    const res = await shiftsRouter.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].staff_id).toBe('s1');
  });

  test('returns empty array when no shifts', async () => {
    const env = createTestEnv(createMockD1({ shifts: [] }));
    await mountRouter();

    const res = await shiftsRouter.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  test('accepts query parameters without error', async () => {
    const env = createTestEnv(createMockD1({ shifts: [] }));
    await mountRouter();

    const res = await shiftsRouter.request('/?from=2026-07-01&to=2026-07-31&staff_id=s1', { method: 'GET' }, env);
    expect(res.status).toBe(200);
  });
});
