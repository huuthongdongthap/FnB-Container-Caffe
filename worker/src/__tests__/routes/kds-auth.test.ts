import { describe, expect, it } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv } from '../test-utils';

const JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

async function staffToken() {
  return generateJWT({
    id: 'staff-kds',
    sub: 'staff-kds',
    email: 'staff@test.aura',
    name: 'KDS Staff',
    role: 'staff',
    tenantId: 'cafe-a',
  } as any, JWT_SECRET);
}

describe('KDS session protection', () => {
  it('rejects unauthenticated queue and SSE requests', async () => {
    const env = createMockEnv({ JWT_SECRET });

    const queueResponse = await app.fetch(
      new Request('https://test.aura/api/kds/orders'),
      env as any,
    );
    const streamResponse = await app.fetch(
      new Request('https://test.aura/api/kds/orders/stream'),
      env as any,
    );

    expect(queueResponse.status).toBe(401);
    expect(streamResponse.status).toBe(401);

    const codCollectionResponse = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_COD/mark-cod-paid', { method: 'PATCH' }),
      env as any,
    );
    expect(codCollectionResponse.status).toBe(401);
  });

  it('allows an authenticated staff session to load the queue and SSE stream', async () => {
    const token = await staffToken();
    const env = createMockEnv({ JWT_SECRET });

    const queueResponse = await app.fetch(
      new Request('https://test.aura/api/kds/orders', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env as any,
    );
    const streamResponse = await app.fetch(
      new Request(`https://test.aura/api/kds/orders/stream?token=${encodeURIComponent(token)}`),
      env as any,
    );

    expect(queueResponse.status).toBe(200);
    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get('Content-Type')).toContain('text/event-stream');
    await streamResponse.body?.cancel();
  });

  it('does not let kitchen staff collect COD payments', async () => {
    const token = await generateJWT({
      id: 'staff-kitchen',
      sub: 'staff-kitchen',
      email: 'kitchen@test.aura',
      name: 'Kitchen Staff',
      role: 'kitchen',
      tenantId: 'cafe-a',
    } as any, JWT_SECRET);
    const env = createMockEnv({ JWT_SECRET });
    const response = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_COD/mark-cod-paid', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env as any,
    );
    expect(response.status).toBe(403);

    const paymentStatusResponse = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_COD', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'paid' }),
      }),
      env as any,
    );
    expect(paymentStatusResponse.status).toBe(400);
  });

  it('allows a cashier session to collect COD only within its tenant', async () => {
    const statements: Array<{ sql: string; binds: unknown[] }> = [];
    const order = {
      total: 42000,
      status: 'preparing',
      payment_status: 'unpaid',
      payment_method: 'cod',
    };
    const env = createMockEnv({ JWT_SECRET }) as any;
    env.AURA_DB = {
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const statement = {
          bind: (...args: unknown[]) => { binds = args; return statement; },
          first: async () => sql.includes('FROM orders WHERE id = ?') ? order : null,
          run: async () => {
            statements.push({ sql, binds });
            return { success: true, changes: 1, meta: { changes: 1 } };
          },
          all: async () => ({ results: [], success: true }),
        };
        return statement as any;
      },
      batch: async (statements: Array<{ run(): Promise<unknown> }>) => {
        const results = []; for (const statement of statements) results.push(await statement.run()); return results;
      },
    };
    const token = await generateJWT({
      id: 'cashier-1',
      sub: 'cashier-1',
      email: 'cashier@test.aura',
      role: 'cashier',
      tenantId: 'cafe-a',
    } as any, JWT_SECRET);

    const response = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_COD/mark-cod-paid', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(statements.some(statement => statement.sql.includes('UPDATE orders') && statement.sql.includes('tenant_id = ?') && statement.binds.includes('cafe-a'))).toBe(true);
  });
  it('serves the KDS queue from the dedicated router, not the unified orders surface', async () => {
    const token = await staffToken();
    const env = createMockEnv({ JWT_SECRET });

    const queue = await app.fetch(
      new Request('https://test.aura/api/kds/orders', { headers: { Authorization: `Bearer ${token}` } }),
      env as any,
    );
    expect(queue.status).toBe(200);

    // The unified orders surface must not reappear under the KDS prefix: a
    // customer-order-shaped path there reaches no route at all, so the response
    // is the router's own 404 rather than a handler's JSON payload.
    const leaked = await app.fetch(
      new Request('https://test.aura/api/kds/orders/ORD_X/track', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env as any,
    );
    expect(leaked.status).toBe(404);
    expect(leaked.headers.get('Content-Type')).not.toContain('application/json');
  });
});
