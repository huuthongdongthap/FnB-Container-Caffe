import { describe, it, expect } from 'vitest';
import { createOrder } from '../commands/create-order';

function createMockEnv(tableRow: { id: string; table_number: string } | null = null) {
  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._binds = args;
          return stmt;
        },
        first: async <T = unknown>() => {
          if (sql.includes('FROM cafe_tables WHERE table_number = ?')) {
            const bound = stmt._binds[0];
            if (tableRow && (tableRow.table_number === bound || tableRow.table_number === String(bound).toUpperCase())) {
              return { id: tableRow.id } as T;
            }
            return null as T;
          }
          if (sql.includes('SELECT')) return null as T;
          return null as T;
        },
        run: async () => ({ success: true, changes: 1, lastRowId: 1 }),
        all: async () => ({ results: [], success: true }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async (stmts: unknown[] = []) => stmts.map(() => ({ success: true, changes: 1 })),
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };

  return {
    AURA_DB: db,
    REALTIME_ENABLED: 'false',
  };
}

describe('createOrder - Dine-In Table Validation', () => {
  const baseOrder = {
    items: [{ name: 'Cà phê đen đá', qty: 1, price: 25000 }],
    total: 25000,
    customer_name: 'Nguyen Van A',
    customer_phone: '0901234567',
    payment_method: 'cod',
  };

  it('rejects explicit dine_in order when table_id is missing', async () => {
    const env = createMockEnv({ id: 'tbl_b02', table_number: 'B02' });
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseOrder,
        order_type: 'dine_in',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/table_id|Số bàn là bắt buộc/);
  });

  it('accepts order with omitted order_type when table_id is missing (defaults to takeaway/non-dine_in)', async () => {
    const env = createMockEnv({ id: 'tbl_b02', table_number: 'B02' });
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseOrder,
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('rejects dine_in order when table_id is not found in cafe_tables', async () => {
    // DB returns null for all table lookups
    const env = createMockEnv(null);
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseOrder,
        order_type: 'dine_in',
        table_id: 'NON_EXISTENT_99',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/valid table_id/);
  });

  it('accepts dine_in order with valid table_id and resolves to table UUID', async () => {
    const env = createMockEnv({ id: 'uuid-table-b02', table_number: 'B02' });
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseOrder,
        order_type: 'dine_in',
        table_id: 'B02',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    const order = body.data as Record<string, unknown>;
    expect(order.table_id).toBe('uuid-table-b02');
  });

  it('accepts case-insensitive table code (e.g. b02 -> B02)', async () => {
    const env = createMockEnv({ id: 'uuid-table-b02', table_number: 'B02' });
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseOrder,
        order_type: 'dine_in',
        table_id: 'b02',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    const order = body.data as Record<string, unknown>;
    expect(order.table_id).toBe('uuid-table-b02');
  });

  it('allows takeaway order without table_id', async () => {
    const env = createMockEnv(null);
    const req = new Request('https://test.aura/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseOrder,
        order_type: 'takeaway',
      }),
    });

    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    const order = body.data as Record<string, unknown>;
    expect(order.table_id).toBeNull();
    expect(order.order_type).toBe('takeaway');
  });
});
