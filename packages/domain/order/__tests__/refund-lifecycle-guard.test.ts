import { describe, expect, it, vi } from 'vitest';
import { transitionOrderStatus, type OrderStatusDb } from '../policies/order-status-transition';
import { updateOrder } from '../commands/update-order';
import { isHeldOutOfKds } from '../../kitchen/policies/kds-hold-policy';

function makeMockDb(orderRow: Record<string, unknown>): OrderStatusDb {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => orderRow),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
        all: vi.fn(async () => ({ results: [] })),
      })),
    })),
  } as unknown as OrderStatusDb;
}

describe('Refunded order lifecycle guards (#172)', () => {
  it('blocks forward status transitions when payment_status is refunded', async () => {
    const db = makeMockDb({
      id: 'ord-ref-1',
      status: 'preparing',
      payment_status: 'refunded',
      payment_method: 'payos',
      order_type: 'dine_in',
      table_id: 't1',
      tenant_id: 'default',
    });

    const res = await transitionOrderStatus(db, 'ord-ref-1', 'ready', 'admin', {
      tenantId: 'default',
    });

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(String(res.error ?? '')).toContain('hoàn tiền');
  });

  it('holds refunded orders out of active KDS queue', () => {
    expect(
      isHeldOutOfKds({
        status: 'preparing',
        payment_method: 'payos',
        payment_status: 'refunded',
        order_type: 'dine_in',
      }),
    ).toBe(true);
  });

  it('blocks switching a delivery order payment_method to cod or cash', async () => {
    let capturedSql = '';
    const db = {
      prepare: vi.fn((sql: string) => {
        if (!capturedSql && sql.includes('SELECT')) capturedSql = sql;
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [
                {
                  id: 'ord-deliv-1',
                  status: 'pending',
                  items: '[]',
                  total: 55000,
                  payment_status: 'unpaid',
                  order_type: 'delivery',
                  customer_name: 'Tester',
                  customer_phone: '0901234567',
                  table_id: null,
                  created_at: '2026-11-24T00:00:00Z',
                  tenant_id: 'default',
                  session_id: null,
                },
              ],
            })),
            first: vi.fn(async () => null),
            run: vi.fn(async () => ({ meta: { changes: 1 } })),
          })),
        };
      }),
    };

    const req = new Request('http://localhost/api/orders/ord-deliv-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: 'cod' }),
    });
    const res = await updateOrder(
      req,
      { AURA_DB: db } as unknown as Parameters<typeof updateOrder>[1],
      'ord-deliv-1',
      'admin',
      'default',
    );

    expect(capturedSql).toContain('order_type');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(String(json.error ?? '')).toContain('PayOS');
  });
});
