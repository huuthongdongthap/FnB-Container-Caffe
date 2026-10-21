// @vitest-environment node
/**
 * Order tracking access control.
 *
 * The tracking URL is a shareable link, so the endpoint must not act as an
 * enumeration oracle: an anonymous caller resolves guest orders only, and a
 * signed-in customer resolves their own orders only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../index';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';

const closer: Array<{ close: () => void }> = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of closer.splice(0)) db.close(); });

function fixture() {
  const { db, sqlite } = paymentSqliteDB();
  closer.push(sqlite);
  return { sqlite, env: { AURA_DB: db, JWT_SECRET: 'test-jwt-secret-at-least-16-chars' } as any };
}

function seedGuestOrder(sqlite: any, id: string, tenantId = 'default') {
  sqlite.prepare(`INSERT INTO orders (id, tenant_id, customer_id, total, status, items, customer_name, customer_phone, created_at, updated_at)
    VALUES (?, ?, NULL, 20000, 'pending', '[]', 'Guest', '0900000010', '2026-01-01', '2026-01-01')`).run(id, tenantId);
}

function seedOwnedOrder(sqlite: any, id: string, customerId: string, tenantId = 'default') {
  sqlite.prepare(`INSERT INTO orders (id, tenant_id, customer_id, total, status, items, customer_name, customer_phone, created_at, updated_at)
    VALUES (?, ?, ?, 20000, 'pending', '[]', 'Buyer', '0900000002', '2026-01-01', '2026-01-01')`).run(id, tenantId, customerId);
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

function track(env: any, id: string, token?: string) {
  return app.fetch(
    new Request(`https://test.aura/api/orders/${id}/track`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    env
  );
}

describe('order tracking access control', () => {
  it('resolves a guest order for an anonymous caller', async () => {
    const { sqlite, env } = fixture();
    seedGuestOrder(sqlite, 'ORD_GUEST');

    const res = await track(env, 'ORD_GUEST');

    expect(res.status).toBe(200);
    expect((await res.json() as any).data.status).toBe('pending');
  });

  it('rejects an anonymous caller asking for a registered customer order', async () => {
    const { sqlite, env } = fixture();
    seedOwnedOrder(sqlite, 'ORD_OWNED', 'customer-1');

    const res = await track(env, 'ORD_OWNED');

    expect(res.status).toBe(401);
  });

  it('lets a customer read their own order', async () => {
    const { sqlite, env } = fixture();
    seedOwnedOrder(sqlite, 'ORD_MINE', 'customer-1');
    const token = await signTestJwt({ id: 'customer-1', role: 'customer' });

    const res = await track(env, 'ORD_MINE', token);

    expect(res.status).toBe(200);
  });

  it("stops a customer reading another customer's order", async () => {
    const { sqlite, env } = fixture();
    seedOwnedOrder(sqlite, 'ORD_THEIRS', 'customer-2');
    const token = await signTestJwt({ id: 'customer-1', role: 'customer' });

    const res = await track(env, 'ORD_THEIRS', token);

    expect(res.status).toBe(403);
  });

  it('hides an order belonging to another tenant behind a 404', async () => {
    const { sqlite, env } = fixture();
    seedGuestOrder(sqlite, 'ORD_OTHER_TENANT', 'tenant-b');

    const res = await track(env, 'ORD_OTHER_TENANT');

    expect(res.status).toBe(404);
  });
});
