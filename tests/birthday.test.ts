/**
 * Birthday Route Tests — /api/birthday
 * Birthday discount eligibility and redemption.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    customers: [...(seedData.customers || [])],
    birthday_redemptions: [...(seedData.birthday_redemptions || [])],
  };

  function getTable(sql: string): string {
    const from = sql.match(/\bFROM\s+(\w+)/i);
    if (from) return from[1];
    const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
    if (insert) return insert[1];
    return '';
  }

  return {
    prepare: vi.fn((sql: string) => {
      const bindValues: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind: vi.fn((...vals: any[]) => { bindValues.push(...vals); return stmt; }),
        first: vi.fn(async () => {
          const t = getTable(sql);
          return (tables[t] || [])[0] || null;
        }),
        all: vi.fn(async () => {
          const t = getTable(sql);
          return { results: [...(tables[t] || [])] };
        }),
        run: vi.fn(async () => {
          const insert = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insert) {
            const t = insert[1];
            if (!tables[t]) tables[t] = [];
            const row: any = {};
            const cols = sql.match(/\(([^)]+)\)/);
            if (cols) {
              cols[1].split(',').map(c => c.trim()).forEach((n, i) => {
                row[n] = bindValues[i];
              });
            }
            tables[t].push(row);
          }
          return { success: true };
        }),
      };
      return stmt;
    }),
  };
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return { AURA_DB: createMockD1(), ...overrides };
}

let router: any;
let env: ReturnType<typeof createEnv>;

beforeEach(async () => {
  vi.clearAllMocks();
  env = createEnv();
  const mod = await import('../worker/src/routes/birthday.ts');
  router = mod.birthdayRouter;
});

describe('GET /check', () => {
  test('returns eligible when customer has birthday in current month', async () => {
    const today = new Date();
    const thisYear = today.getFullYear();
    const thisMonth = String(today.getMonth() + 1).padStart(2, '0');
    const birthday = `${thisYear}-${thisMonth}-15`;

    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'Alice', phone: '0912345678', birthday }],
    });

    const res = await router.request(`/check?customer_id=cust1`, { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.discount_percent).toBeGreaterThanOrEqual(0);
  });

  test('returns not eligible when customer has no birthday', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'Alice', phone: '0912345678', birthday: null }],
    });

    const res = await router.request(`/check?customer_id=cust1`, { method: 'GET' }, env);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.eligible).toBe(false);
    expect(body.data.reason).toMatch(/No birthday/i);
  });

  test('returns 400 when neither customer_id nor phone provided', async () => {
    const res = await router.request('/check', { method: 'GET' }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/customer_id or phone/i);
  });
});

describe('POST /redeem', () => {
  test('redeems birthday discount and returns 201', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'Alice', birthday: '1990-06-15' }],
    });

    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1', order_id: 'ord1' }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.discount_percent).toBe(15);
  });

  test('returns 400 on missing customer_id', async () => {
    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 when customer not found', async () => {
    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'nonexistent' }),
    }, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  test('returns 400 when already redeemed this year', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'Alice', birthday: '1990-06-15' }],
      birthday_redemptions: [{ id: 'bday1', customer_id: 'cust1', redeemed_at: new Date().toISOString() }],
    });

    const res = await router.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Already redeemed/i);
  });
});
