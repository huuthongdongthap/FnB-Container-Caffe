/**
 * Unit tests for order-stream.ts (orderStreamRouter mounted at /api/orders)
 *
 * Validates SSE stream establishment, KV availability checks, 404 handling,
 * and event replay with Last-Event-ID header.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { orderStreamRouter } from '../../routes/order-stream';
import { optionalAuth } from '../../middleware/auth';
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
              if (id === 'owned-order') {
                return { id, customer_id: 'cust_other', status: 'pending' };
              }
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
    JWT_SECRET: 'test-jwt-secret-at-least-16-chars',
    ...overrides
  } as Env;
}

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  // Mirrors orders-unified.ts: the route stays reachable for guests, but a token
  // resolves the caller so the handler's ownership check can run.
  app.use('/api/orders/:id/events', optionalAuth());
  app.route('/api/orders', orderStreamRouter);
  return app;
}

/** HMAC-SHA256 JWT, matching the production signing path. */
async function signTestJwt(payload: Record<string, unknown>): Promise<string> {
  const secret = 'test-jwt-secret-at-least-16-chars';
  const encoder = new TextEncoder();
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  // Raw bytes are base64url'd directly — never through JSON.stringify.
  const b64Bytes = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
  return `${data}.${b64Bytes(sig)}`;
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

  describe('stream authorization', () => {
    it('refuses a signed-in customer reading another customer\'s order', async () => {
      const app = createApp();
      const env = createMockEnv();
      const token = await signTestJwt({ id: 'cust_me', role: 'customer' });

      const res = await app.fetch(
        new Request('https://auracafe.vn/api/orders/owned-order/events', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        env
      );

      expect(res.status).toBe(403);
      expect((await res.json() as any).error).toContain('Unauthorized');
    });

    it('refuses an anonymous caller streaming a registered customer order', async () => {
      const app = createApp();
      const env = createMockEnv();

      const res = await app.fetch(
        new Request('https://auracafe.vn/api/orders/owned-order/events'),
        env
      );

      expect(res.status).toBe(403);
    });

    it('lets a signed-in customer stream their own order', async () => {
      const app = createApp();
      const env = createMockEnv();
      const token = await signTestJwt({ id: 'cust_other', role: 'customer' });
      const controller = new AbortController();

      const res = await app.fetch(
        new Request('https://auracafe.vn/api/orders/owned-order/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        }),
        env
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
      controller.abort();
    });

    it('lets staff stream any order', async () => {
      const app = createApp();
      const env = createMockEnv();
      const token = await signTestJwt({ id: 'staff_1', role: 'kitchen' });
      const controller = new AbortController();

      const res = await app.fetch(
        new Request('https://auracafe.vn/api/orders/owned-order/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        }),
        env
      );

      expect(res.status).toBe(200);
      controller.abort();
    });
  });
});
