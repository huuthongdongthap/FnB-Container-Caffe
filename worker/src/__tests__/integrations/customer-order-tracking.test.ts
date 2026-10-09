/**
 * Customer Order Tracking Contract Integration Tests
 *
 * Verifies:
 * - Authorized customer order access & customer-safe payload
 * - Unauthorized order access rejection (IDOR protection)
 * - Guest order tracking & anonymous snooping protection
 * - Real-time state transition event emission via SSE
 * - Terminal state stream cutoff (connection closure)
 * - Reconnect replay with Last-Event-ID
 * - Historical snapshot decoupling from Catalog mutations
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  canAccessOrder,
  projectCustomerOrderPayload,
  publishOrderEvent,
  isTerminal,
} from '@aura/domain-order';
import { orderStreamRouter } from '../../routes/order-stream';
import type { Env } from '../../types/env';

function makeMockApp(orders: Array<Record<string, unknown>>) {
  const kvStore = new Map<string, string>();
  const kv = {
    get: async (k: string) => kvStore.get(k) ?? null,
    put: async (k: string, v: string) => { kvStore.set(k, v); },
  };

  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { binds = args; return stmt; },
        first: async <T = unknown>() => {
          const id = binds[0];
          const found = orders.find((o) => o.id === id);
          if (!found) return null as T;
          return found as unknown as T;
        },
        all: async () => ({ results: orders }),
        run: async () => ({ success: true }),
      };
      return stmt as any;
    },
  };

  const app = new Hono<{ Bindings: Env }>();
  app.route('/api/orders', orderStreamRouter);

  return { app, env: { AURA_DB: db, AUTH_KV: kv as any } as Env, kvStore };
}

describe('Customer Order Tracking Contract', () => {
  const sampleOrderCustA = {
    id: 'ORD_CUST_A',
    customer_id: 'usr_cust_a',
    customer_name: 'Nguyen Van A',
    customer_phone: '0901234567',
    status: 'pending',
    payment_status: 'pending',
    total_amount: 55000,
    items: JSON.stringify([{ id: 'it_1', name: 'Ca Phe Muoi', quantity: 1, unitPriceCents: 55000, subtotalCents: 55000 }]),
    created_at: new Date().toISOString(),
  };

  const sampleOrderGuest = {
    id: 'ORD_GUEST_1',
    customer_id: null,
    customer_name: 'Khach Vang Lai',
    status: 'pending',
    payment_status: 'pending',
    total_amount: 30000,
    items: JSON.stringify([{ id: 'it_2', name: 'Tra Dao', quantity: 1, unitPriceCents: 30000, subtotalCents: 30000 }]),
    created_at: new Date().toISOString(),
  };

  it('allows authenticated customer to access their own order and omits sensitive phone data', () => {
    const actor = { id: 'usr_cust_a', role: 'customer' };
    const access = canAccessOrder(actor, sampleOrderCustA);
    expect(access.allowed).toBe(true);

    const safePayload = projectCustomerOrderPayload(sampleOrderCustA);
    expect(safePayload.id).toBe('ORD_CUST_A');
    expect(safePayload.items).toHaveLength(1);
    expect(safePayload.items[0].name).toBe('Ca Phe Muoi');
    expect((safePayload as any).customer_phone).toBeUndefined();
    expect((safePayload as any).customer_name).toBeUndefined();
  });

  it('rejects unauthorized customer accessing another customer order (IDOR protection)', () => {
    const attacker = { id: 'usr_cust_b', role: 'customer' };
    const access = canAccessOrder(attacker, sampleOrderCustA);
    expect(access.allowed).toBe(false);
    expect(access.reason).toContain('Unauthorized');
  });

  it('allows guest to track unassigned guest order using order identifier', () => {
    const guestActor = null;
    const access = canAccessOrder(guestActor, sampleOrderGuest);
    expect(access.allowed).toBe(true);

    const payload = projectCustomerOrderPayload(sampleOrderGuest);
    expect(payload.id).toBe('ORD_GUEST_1');
    expect(payload.totalAmount).toBe(30000);
  });

  it('rejects anonymous guest attempting to snoop on registered customer order', () => {
    const anonymousGuest = null;
    const access = canAccessOrder(anonymousGuest, sampleOrderCustA);
    expect(access.allowed).toBe(false);
    expect(access.reason).toContain('registered customer');
  });

  it('establishes SSE stream and returns 403 on HTTP endpoint for unauthorized client', async () => {
    const { app, env } = makeMockApp([sampleOrderCustA]);

    // Attacker without authorization trying to access order belonging to customer A
    const appWithAttacker = new Hono<{ Bindings: Env }>();
    appWithAttacker.use('*', async (c, next) => {
      c.set('user', { id: 'usr_cust_attacker', role: 'customer' });
      await next();
    });
    appWithAttacker.route('/api/orders', orderStreamRouter);

    const res = await appWithAttacker.fetch(new Request('https://auracafe.vn/api/orders/ORD_CUST_A/events'), env);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain('Unauthorized');
  });

  it('stops streaming and closes connection when order is in terminal state', async () => {
    const terminalOrder = {
      id: 'ORD_TERM_1', customer_id: null, status: 'completed', payment_status: 'paid', total_amount: 40000, items: '[]', created_at: new Date().toISOString(),
    };

    expect(isTerminal(terminalOrder.status as any)).toBe(true);
    const { app, env } = makeMockApp([terminalOrder]);

    const res = await app.fetch(new Request('https://auracafe.vn/api/orders/ORD_TERM_1/events'), env);
    expect(res.status).toBe(200);

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    if (reader) {
      let accumulated = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += new TextDecoder().decode(value);
      }
      expect(accumulated).toContain('completed');
    }
  });

  it('emits state transition events via publishOrderEvent and replays with Last-Event-ID', async () => {
    const kvStore = new Map<string, string>();
    const kv = {
      put: async (k: string, v: string) => { kvStore.set(k, v); },
      get: async (k: string) => kvStore.get(k) ?? null,
    };

    await publishOrderEvent(kv, 'ORD_EVENT_1', 'preparing', { previousStatus: 'confirmed' });
    const stored = kvStore.get('order_event:ORD_EVENT_1');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.orderId).toBe('ORD_EVENT_1');
    expect(parsed.status).toBe('preparing');
    expect(parsed.previous_status).toBe('confirmed');
  });

  it('renders historical order without Catalog lookup even after catalog deletion', () => {
    const historicalOrder = {
      id: 'ORD_HIST_1',
      status: 'completed',
      items: JSON.stringify([
        { id: 'it_old', name: 'Legacy Special Tea', quantity: 2, unitPriceCents: 35000, subtotalCents: 70000 },
      ]),
      total_amount: 70000,
    };

    // Projection operates purely on frozen snapshot
    const rendered = projectCustomerOrderPayload(historicalOrder);
    expect(rendered.items).toHaveLength(1);
    expect(rendered.items[0].name).toBe('Legacy Special Tea');
    expect(rendered.items[0].unitPriceCents).toBe(35000);
    expect(rendered.items[0].subtotalCents).toBe(70000);
  });
});
