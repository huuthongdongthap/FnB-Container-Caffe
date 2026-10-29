import { describe, expect, it } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, isStaffAccountLookup, staffSessionClaims } from '../test-utils';

const JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

/** Account rows the request-time session gate reads behind each staff token. */
const STAFF_ROWS = [
  { id: 'staff-kds', name: 'KDS Staff', phone: null, role: 'staff', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
  { id: 'staff-kitchen', name: 'Kitchen Staff', phone: null, role: 'kitchen', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
  { id: 'cashier-1', name: 'Cashier Staff', phone: null, role: 'cashier', tenant_id: 'cafe-a', is_active: 1, auth_version: 1 },
];

/**
 * Env whose DB answers the session gate's account lookup from STAFF_ROWS and
 * otherwise returns no data: every staff request needs the row behind its token,
 * and a token with no row reads as a revoked session rather than as "no data".
 */
function kdsEnv() {
  return createMockEnv({
    JWT_SECRET,
    AURA_DB: {
      prepare: (sql: string) => {
        if (isStaffAccountLookup(sql)) {
          let boundId = '';
          const account = {
            bind: (id: unknown) => { boundId = String(id ?? ''); return account; },
            first: async () => STAFF_ROWS.find(r => r.id === boundId) ?? null,
          };
          return account as any;
        }
        const empty = {
          bind: () => empty,
          first: async () => null,
          all: async () => ({ results: [], success: true }),
          run: async () => ({ success: true, changes: 0, lastRowId: 0 }),
          raw: async () => [],
        };
        return empty as any;
      },
      batch: async () => [],
    } as any,
  }) as any;
}

async function staffToken(role = 'staff', id = 'staff-kds') {
  return generateJWT({
    id,
    sub: id,
    email: `${id}@test.aura`,
    name: `KDS ${role}`,
    role,
    tenantId: 'cafe-a',
    ...staffSessionClaims(),
  } as any, JWT_SECRET, 28800);
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
    const env = kdsEnv();

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
    const token = await staffToken('kitchen', 'staff-kitchen');
    const env = kdsEnv();
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
        // The session gate's account read has to be answered before the order
        // lookup, otherwise this request reads as a revoked session.
        if (isStaffAccountLookup(sql)) {
          let boundId = '';
          const account = {
            bind: (id: unknown) => { boundId = String(id ?? ''); return account; },
            first: async () => STAFF_ROWS.find(r => r.id === boundId) ?? null,
          };
          return account as any;
        }
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
      ...staffSessionClaims(),
    } as any, JWT_SECRET, 28800);

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
    const env = kdsEnv();

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
