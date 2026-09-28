/**
 * Unit tests for order-stream.ts (orderStreamRouter mounted at /api/orders)
 *
 * Validates SSE stream establishment, KV availability checks, 404 handling,
 * and event replay with Last-Event-ID header.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { orderStreamRouter } from '../../routes/order-stream';
import type { Env } from '../../types/env';

function createMockEnv(overrides: Partial<Env> = {}): Env {
  const store = new Map<string, string>();
  const defaultKV = {
    get: async(key: string) => store.get(key) ?? null,
    put: async(key: string, val: string) => { store.set(key, val); },
    delete: async(key: string) => { store.delete(key); },
  };

  const defaultDB: any = {
    prepare: (sql: string) => {
      return {
        bind: (...params: unknown[]) => ({
          first: async() => {
            if (sql.includes('SELECT id FROM orders WHERE id = ?')) {
              const id = params[0];
              if (id === 'non-existent-order') return null;
              return { id };
            }
            if (sql.includes('SELECT * FROM orders WHERE id = ?')) {
              return {
                id: params[0] || 'ord_123',
                customer_name: 'Test Customer',
                customer_phone: '0901234567',
                status: 'pending',
                payment_method: 'payos',
                total: 45000,
                items: '[]',
                created_at: new Date().toISOString()
              };
            }
            return null;
          },
          all: async() => ({ results: [] }),
          run: async() => ({ success: true })
        }),
      };
    }
  };

  return {
    AURA_DB: defaultDB,
    AUTH_KV: defaultKV as any,
    JWT_SECRET: 'test-secret',
    ...overrides
  } as Env;
}

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/api/orders', orderStreamRouter);
  return app;
}

describe('Order Stream SSE Endpoint (/api/orders/:id/events)', () => {
  it('returns 500 if KV namespace is missing from environment', async() => {
    const app = createApp();
    const env = createMockEnv({ AUTH_KV: undefined });
    const res = await app.fetch(
      new Request('https://auracafe.vn/api/orders/ord_123/events'),
      env
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('KV not available');
  });

  it('returns 404 if order does not exist in D1 database', async() => {
    const app = createApp();
    const env = createMockEnv();
    const res = await app.fetch(
      new Request('https://auracafe.vn/api/orders/non-existent-order/events'),
      env
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Order not found');
  });

  it('establishes text/event-stream with appropriate cache headers', async() => {
    const app = createApp();
    const env = createMockEnv();
    const controller = new AbortController();

    const res = await app.fetch(
      new Request('https://auracafe.vn/api/orders/ord_123/events', {
        signal: controller.signal
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');

    // Clean up abort
    controller.abort();
  });

  it('replays historical events from KV when Last-Event-ID is provided', async() => {
    const app = createApp();
    const env = createMockEnv();
    const kv = env.AUTH_KV as any;

    // Seed events log in KV
    const mockEvents = [
      { eventId: '1000', orderId: 'ord_123', type: 'update_order', data: { status: 'pending' }, timestamp: '2026-09-28T09:00:00Z' },
      { eventId: '1001', orderId: 'ord_123', type: 'update_order', data: { status: 'confirmed' }, timestamp: '2026-09-28T09:01:00Z' },
      { eventId: '1002', orderId: 'ord_123', type: 'update_order', data: { status: 'preparing' }, timestamp: '2026-09-28T09:02:00Z' }
    ];
    await kv.put('order_events_log:ord_123', JSON.stringify(mockEvents));

    const controller = new AbortController();
    const res = await app.fetch(
      new Request('https://auracafe.vn/api/orders/ord_123/events', {
        headers: { 'Last-Event-ID': '1000' },
        signal: controller.signal
      }),
      env
    );

    expect(res.status).toBe(200);

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      let accumulated = '';
      for (let i = 0; i < 6; i++) {
        const chunk = await reader.read();
        if (chunk.done) break;
        accumulated += new TextDecoder().decode(chunk.value);
      }
      // Verify replayed events (1001 and 1002)
      expect(accumulated).toContain('id: 1001');
      expect(accumulated).toContain('confirmed');
    }

    controller.abort();
  });
});
