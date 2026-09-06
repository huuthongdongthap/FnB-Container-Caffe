/**
 * PayOS Webhook E2E — full path through the Hono app.
 *
 * Exercises the real webhook router end-to-end with a scripted D1 mock:
 *   POST /webhooks/payos -> payosWebhook (HMAC-SHA256 signature, status transition)
 *
 * Covers the critical payment path: signature verification -> order lookup ->
 * amount validation -> payment status transition. Auth is NOT required on
 * webhooks (IPN), so this exercises the unauthenticated path.
 */

import { describe, it, expect, vi } from 'vitest';
import { app } from '../../index';
import { createHmac } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';

interface ScriptedRow { [key: string]: unknown }

function makeScriptedDB(
  rowsBySql: Array<{ match: (sql: string) => boolean; rows: ScriptedRow[]; runChanges?: number }>
): D1Database {
  const db = {
    prepare: (sql: string) => {
      const handler = rowsBySql.find(h => h.match(sql));
      const rows = handler?.rows ?? [];
      const stmt = {
        bind: (...args: unknown[]) => stmt,
        run: async () => ({ success: true, changes: handler?.runChanges ?? 1, lastRowId: 1, meta: { changes: handler?.runChanges ?? 1 } }),
        first: async () => rows[0] ?? null,
        all: async () => ({ results: rows, success: true, meta: {} }),
        raw: async () => [],
      };
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  } as unknown as D1Database;
  return db;
}

const CHECKSUM_KEY = 'payos-test-checksum-key-32-chars-long!!';

function sign(data: Record<string, unknown>, key: string): string {
  // PayOS sorts keys and joins as key=value&key=value before signing
  const sorted = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  return createHmac('sha256', key).update(sorted).digest('hex');
}

const PAYLOAD = {
  success: true,
  data: {
    orderCode: 123456,
    amount: 50000,
    description: 'AURA CAFE order 123456',
  },
};

describe('PayOS webhook E2E', () => {
  it('processes a valid webhook and marks payment completed', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM payments'), rows: [{ id: 'PAY-1', order_id: 'ORD-1', method: 'payos', amount: 50000, status: 'pending' }] },
      { match: (s) => s.startsWith('UPDATE payments'), rows: [] },
    ]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': sign(PAYLOAD.data, CHECKSUM_KEY) },
        body: JSON.stringify(PAYLOAD),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe(0);
  });

  it('rejects webhook with invalid signature', async () => {
    const db = makeScriptedDB([]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': 'deadbeef' },
        body: JSON.stringify(PAYLOAD),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Invalid signature');
  });

  it('rejects webhook with amount mismatch', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM payments'), rows: [{ id: 'PAY-1', order_id: 'ORD-1', method: 'payos', amount: 50000, status: 'pending' }] },
    ]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;
    const payload = { ...PAYLOAD, data: { ...PAYLOAD.data, amount: 999999 } };

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': sign(payload.data, CHECKSUM_KEY) },
        body: JSON.stringify(payload),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Amount mismatch');
  });

  it('acknowledges already-processed webhook', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM payments'), rows: [{ id: 'PAY-1', order_id: 'ORD-1', method: 'payos', amount: 50000, status: 'completed' }] },
    ]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': sign(PAYLOAD.data, CHECKSUM_KEY) },
        body: JSON.stringify(PAYLOAD),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Already processed');
  });

  it('treats a lost race (0 rows updated) as already processed', async () => {
    // Concurrent duplicate webhook: both read status=pending, first wins the
    // conditional UPDATE (1 row), second finds 0 rows changed → no double notify.
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM payments'), rows: [{ id: 'PAY-1', order_id: 'ORD-1', method: 'payos', amount: 50000, status: 'pending' }] },
      { match: (s) => s.startsWith('UPDATE payments'), rows: [], runChanges: 0 },
    ]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': sign(PAYLOAD.data, CHECKSUM_KEY) },
        body: JSON.stringify(PAYLOAD),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Already processed');
  });

  it('lets a late success webhook supersede a failed payment', async () => {
    // Out-of-order: failure webhook lands first, then PayOS retries the success
    // notification. The success path may transition from failed → completed.
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM payments'), rows: [{ id: 'PAY-1', order_id: 'ORD-1', method: 'payos', amount: 50000, status: 'failed' }] },
    ]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': sign(PAYLOAD.data, CHECKSUM_KEY) },
        body: JSON.stringify(PAYLOAD),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Webhook processed');
  });

  it('acks malformed/empty payload without processing', async () => {
    const db = makeScriptedDB([]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ping: true }),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Webhook endpoint alive');
  });

  it('acks unknown order without failing', async () => {
    const db = makeScriptedDB([
      { match: (s) => s.includes('FROM payments'), rows: [] },
    ]);
    const env = { AURA_DB: db, PAYOS_CHECKSUM_KEY: CHECKSUM_KEY, ENVIRONMENT: 'test' } as any;

    const res = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-payos-signature': sign(PAYLOAD.data, CHECKSUM_KEY) },
        body: JSON.stringify(PAYLOAD),
      }),
      env as any, { waitUntil: () => {} } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.message).toContain('Unknown order');
  });
});