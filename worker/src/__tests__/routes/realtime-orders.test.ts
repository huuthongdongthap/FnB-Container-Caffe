/**
 * Phase 3 — Realtime Orders Route Tests
 *
 * GET /api/realtime/:channelId — verifies DO forwarding + 503 fallback.
 * NOTE: Node.js Response() rejects status 101; tests use 200 and verify
 * the DO.stub was called with the correct channelId instead.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { realtimeOrdersRouter } from '../../routes/realtime-orders';

function makeEnv(doNs?: unknown) {
  return {
    ORDER_BROADCASTER: doNs,
    AURA_DB: { prepare: () => ({ all: async () => ({ results: [] }) }) },
    AUTH_KV: { put: async () => {}, get: async () => null },
    JWT_SECRET: 'test-secret',
  } as any;
}

function createApp(doNs?: unknown) {
  const app = new Hono();
  app.route('/api/realtime', realtimeOrdersRouter);
  return app;
}

describe('Phase 3: Realtime Orders Route', () => {
  it('503 fallback — ORDER_BROADCASTER binding missing', async () => {
    const app = createApp(undefined);
    const res = await app.fetch(
      new Request('https://test.aura/api/realtime/ORD_123'),
      makeEnv(undefined),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('ORDER_BROADCASTER');
  });

  it('forwards to DO stub with correct channelId', async () => {
    const captured: { id?: string } = {};
    const stub = {
      fetch: async (_req: Request) => new Response('ws-upgraded', { status: 200 }),
    };
    const doNs = {
      get: (id: string) => { captured.id = id; return stub; },
    } as any;
    const app = createApp(doNs);
    const res = await app.fetch(
      new Request('https://test.aura/api/realtime/ORD_123'),
      makeEnv(doNs),
    );
    expect(captured.id).toBe('ORD_123');
    expect(res.status).toBe(200);
  });

  it('forwards different channelId values', async () => {
    const ids: string[] = [];
    const stub = {
      fetch: async () => new Response('ws-upgraded', { status: 200 }),
    };
    const doNs = {
      get: (id: string) => { ids.push(id); return stub; },
    } as any;
    const app = createApp(doNs);
    for (const cid of ['ORD_1', 'ORD_2', 'ORD_3']) {
      await app.fetch(
        new Request(`https://test.aura/api/realtime/${cid}`),
        makeEnv(doNs),
      );
    }
    expect(ids).toEqual(['ORD_1', 'ORD_2', 'ORD_3']);
  });
});
