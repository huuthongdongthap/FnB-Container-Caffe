// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { stationTicketsRouter } from '../../../../packages/domain/kitchen/commands/kitchen-station-tickets';
import { isHeldOutOfKds } from '../../../../packages/domain/kitchen/policies/kds-hold-policy';
import { updateOrder } from '../../../../packages/domain/order/commands/update-order';
import { hashOrderToken } from '../../../../packages/domain/customer/policies/order-ownership-policy';
import { reconcilePayOSPayment } from '../../../../packages/domain/payment/commands/payos-reconcile';
import { encryptTenantSecret } from '../../lib/tenant-secrets';
import { mapSseEventToOrder } from '../../../../src/hooks/stores/order-store-utils';
import { promotionsRouter } from '../../routes/promotions';
import { reviewsRouter } from '../../routes/reviews';
import { tableSessionsRouter } from '../../routes/table-sessions';
import { handleScheduled } from '../../scheduled';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) { params = values; return stmt; },
      async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return col ? ((row[col] as T) ?? null) : (row as unknown as T);
      },
      async all<T = Record<string, unknown>>() {
        return { results: sqlite.prepare(sql).all(...(params as never[])) as unknown as T[], success: true };
      },
      async run() {
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
      },
    };
    return stmt;
  };
  return { prepare, batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => Promise.all(stmts.map((s) => s.run())) } as unknown as D1Database;
}

describe('KDS payment hold, cancellation parity, cron session pinning, promotions & guest reviews', () => {
  it('holds unpaid online-prepaid dine-in/takeaway orders out of KDS and blocks station-ticket raw ready bypass', async () => {
    expect(isHeldOutOfKds({ order_type: 'dine_in', payment_method: 'payos', payment_status: 'unpaid', items: '[{}]' })).toBe(true);
    expect(isHeldOutOfKds({ order_type: 'takeaway', payment_method: 'qr', payment_status: 'pending', items: '[{}]' })).toBe(true);
    expect(isHeldOutOfKds({ order_type: 'dine_in', payment_method: 'cod', payment_status: 'unpaid', items: '[{}]' })).toBe(false);

    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_method TEXT, payment_status TEXT, order_type TEXT, items TEXT, notes TEXT, is_cod INTEGER, total INTEGER, tenant_id TEXT);
      CREATE TABLE kitchen_stations (id TEXT PRIMARY KEY, code TEXT, name TEXT, is_active INTEGER, tenant_id TEXT);
      CREATE TABLE order_item_stations (order_item_id TEXT, station_id TEXT, started_at TEXT, ready_at TEXT, PRIMARY KEY (order_item_id, station_id));
      INSERT INTO orders VALUES ('ord_unpaid_payos', 'pending', 'payos', 'unpaid', 'dine_in', '[{"id":"p1","name":"Latte","quantity":1,"price":45000}]', NULL, 0, 45000, 'default');
      INSERT INTO kitchen_stations VALUES ('st_bar', 'BAR', 'Bar', 1, 'default');
    `);
    const db = createSqliteD1(sqlite);
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'chef_1', role: 'kitchen', tenantId: 'default' } as never);
      c.set('tenantId' as never, 'default' as never);
      await next();
    });
    app.route('/', stationTicketsRouter);

    const res = await app.request('/tickets/ord_unpaid_payos/items/p1/ready?station_id=st_bar', {
      method: 'POST',
    }, { AURA_DB: db } as unknown as Env);
    expect(res.status).toBe(409);
    const ordAfter = sqlite.prepare('SELECT status FROM orders WHERE id = ?').get('ord_unpaid_payos') as { status: string };
    expect(ordAfter.status).toBe('pending');
  });

  it('cancels open PayOS link at provider, releases dine-in table, and emits tenant KV + broadcaster events on updateOrder', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_method TEXT, payment_status TEXT, table_id TEXT, items TEXT, total INTEGER, notes TEXT, delivery_time TEXT, customer_name TEXT, customer_phone TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount INTEGER, status TEXT, transaction_id TEXT, payment_url TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE reservations (id TEXT PRIMARY KEY, table_id TEXT, date TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE tenant_payment_configs (tenant_id TEXT PRIMARY KEY, provider TEXT, payos_client_id_enc TEXT, payos_api_key_enc TEXT, payos_checksum_key_enc TEXT, key_version INTEGER, bank_bin TEXT, bank_account_no TEXT, bank_account_name TEXT, bank_name TEXT, is_active INTEGER, updated_at TEXT);
      INSERT INTO cafe_tables VALUES ('tbl_5', '5', 'Occupied', 'sadec');
      INSERT INTO orders VALUES ('ord_cancel_1', 'pending', 'payos', 'unpaid', '5', '[{"id":"p1","name":"Latte","quantity":1,"price":45000}]', 45000, NULL, NULL, 'Guest', '0901234567', 'sadec', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z');
      INSERT INTO payments VALUES ('pay_open_1', 'ord_cancel_1', 'payos', 45000, 'pending', '123456', 'https://pay.payos.vn/web/link_abc', 'sadec', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z');
    `);
    const tenantSecretsKey = '11'.repeat(32);
    const merchantClientId = 'sadec-test-client';
    const merchantApiKey = 'sadec-test-api-key';
    const encryptedCredentials = await Promise.all([
      encryptTenantSecret(merchantClientId, tenantSecretsKey, 1, 'sadec:payos_client_id'),
      encryptTenantSecret(merchantApiKey, tenantSecretsKey, 1, 'sadec:payos_api_key'),
      encryptTenantSecret('sadec-test-checksum', tenantSecretsKey, 1, 'sadec:payos_checksum_key'),
    ]);
    sqlite.prepare(`
      INSERT INTO tenant_payment_configs (tenant_id, provider, payos_client_id_enc, payos_api_key_enc, payos_checksum_key_enc, key_version, is_active)
      VALUES ('sadec', 'payos', ?, ?, ?, 1, 1)
    `).run(...encryptedCredentials);
    const db = createSqliteD1(sqlite);
    const kvStore = new Map<string, string>();
    const kv = { put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v); }), get: vi.fn(async (k: string) => kvStore.get(k) ?? null) };
    const broadcastSpy = vi.fn(async () => {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: '00', data: { status: 'CANCELLED' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const env = {
        AURA_DB: db,
        AUTH_KV: kv,
        TENANT_SECRETS_KEY: tenantSecretsKey,
        PAYOS_CLIENT_ID: 'flagship-test-client',
        PAYOS_API_KEY: 'flagship-test-api-key',
        PAYOS_CHECKSUM_KEY: 'flagship-test-checksum',
        ORDER_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ broadcast: broadcastSpy }) },
      };
      const req = new Request('https://test.aura/api/orders/ord_cancel_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const res = await updateOrder(req, env as never, 'ord_cancel_1', 'manager', 'sadec');
      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v2\/payment-requests\/link_abc\/cancel$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-client-id': merchantClientId, 'x-api-key': merchantApiKey }),
        }),
      );
      const tbl = sqlite.prepare('SELECT status FROM cafe_tables WHERE id = ?').get('tbl_5') as { status: string };
      expect(tbl.status).toBe('Available');
      expect(kvStore.has('order_event:sadec:ord_cancel_1')).toBe(true);
      expect(kvStore.has('latest_order_ts:sadec')).toBe(true);
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pins scheduled cron D1 with primary session, fans out reconciled PayOS settlement, and enforces table_sessions CAS', async () => {
    const withSessionSpy = vi.fn().mockReturnValue({ prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }), all: async () => ({ results: [] }), run: async () => ({}) }) });
    const waitPromises: Promise<unknown>[] = [];
    await handleScheduled({} as never, { AURA_DB: { withSession: withSessionSpy, prepare: () => ({}) } } as unknown as Env, {
      waitUntil: (p: Promise<unknown>) => { waitPromises.push(p); },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext);
    await Promise.allSettled(waitPromises);
    expect(withSessionSpy).toHaveBeenCalledWith('first-primary');

    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT, payment_method TEXT, payment_status TEXT, total INTEGER, total_amount INTEGER, table_id TEXT, session_id TEXT, items TEXT, customer_name TEXT, customer_phone TEXT, customer_id TEXT, customer_email TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT, method TEXT, amount INTEGER, status TEXT, refund_status TEXT, transaction_id TEXT, payment_url TEXT, provider_reference TEXT, tenant_id TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE _metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value REAL, tags TEXT, created_at TEXT);
      CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, status TEXT, order_count INTEGER, total_amount INTEGER, tenant_id TEXT, updated_at TEXT);
      INSERT INTO orders VALUES ('ord_rec_1', 'pending', 'payos', 'unpaid', 55000, 55000, '7', NULL, '[]', 'Guest', '0901234567', NULL, NULL, 'sadec', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z');
      INSERT INTO payments VALUES ('pay_rec_1', 'ord_rec_1', 'payos', 55000, 'pending', NULL, '778899', 'https://pay.payos.vn/web/pl_778', NULL, 'sadec', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z');
      INSERT INTO table_sessions VALUES ('sess_a', '7', 'active', 0, 0, 'sadec', '2026-11-17T00:00:00Z'), ('sess_b', '7', 'active', 0, 0, 'sadec', '2026-11-17T00:00:00Z');
    `);
    const db = createSqliteD1(sqlite);
    const kvMap = new Map<string, string>();
    const kv = { put: vi.fn(async (k: string, v: string) => { kvMap.set(k, v); }), get: vi.fn(async (k: string) => kvMap.get(k) ?? null) };
    const broadcastSpy = vi.fn(async () => {});
    const rec = await reconcilePayOSPayment({
      db,
      kv: kv as never,
      env: { ORDER_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ broadcast: broadcastSpy }) } },
      paymentId: 'pay_rec_1',
      tenantId: 'sadec',
      clientId: 'cid',
      apiKey: 'akey',
      checksumKey: 'test_checksum_secret',
      source: 'cron',
      preVerified: { ok: true, status: 'PAID', amount: 55000, amountPaid: 55000, amountRemaining: 0, orderCode: 778899, id: 'pl_778' },
    });
    expect(rec.ok).toBe(true);
    expect(kvMap.has('order_event:sadec:ord_rec_1')).toBe(true);
    expect(kvMap.has('payment_event:sadec:ord_rec_1')).toBe(true);
    expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_rec_1', payment_status: 'paid' }));

    const sessApp = new Hono<{ Bindings: Env }>();
    sessApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'waiter_1', role: 'waiter', tenantId: 'sadec' } as never);
      c.set('tenantId' as never, 'sadec' as never);
      await next();
    });
    sessApp.route('/api/table-sessions', tableSessionsRouter);
    const attach1 = await sessApp.request('/api/table-sessions/sess_a/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: 'ord_rec_1' }) }, { AURA_DB: db } as unknown as Env);
    const attachDup = await sessApp.request('/api/table-sessions/sess_a/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: 'ord_rec_1' }) }, { AURA_DB: db } as unknown as Env);
    const attachCross = await sessApp.request('/api/table-sessions/sess_b/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: 'ord_rec_1' }) }, { AURA_DB: db } as unknown as Env);
    expect(attach1.status).toBe(200);
    expect(attachDup.status).toBe(200);
    expect(attachCross.status).toBe(409);
    const sessRow = sqlite.prepare('SELECT order_count, total_amount FROM table_sessions WHERE id = ?').get('sess_a') as { order_count: number; total_amount: number };
    expect(sessRow.order_count).toBe(1);
    expect(sessRow.total_amount).toBe(55000);
  });

  it('guards public promotions, verifies X-Order-Token on phone-less guest reviews, and maps snake_case SSE payloads', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const tokenPlain = 'qr_guest_secret_token_999';
    const tokenHash = await hashOrderToken(tokenPlain);
    sqlite.exec(`
      CREATE TABLE promotions (id TEXT PRIMARY KEY, code TEXT, percent INTEGER, is_active INTEGER, starts_at TEXT, expires_at TEXT, usage_limit INTEGER, usage_count INTEGER, tenant_id TEXT, created_at TEXT);
      CREATE TABLE orders (id TEXT PRIMARY KEY, customer_id TEXT, customer_phone TEXT, guest_token_hash TEXT, status TEXT, tenant_id TEXT);
      CREATE TABLE reviews (id TEXT PRIMARY KEY, order_id TEXT, rating INTEGER, comment TEXT, customer_name TEXT, tenant_id TEXT, created_at TEXT);
      INSERT INTO promotions VALUES
        ('p_active', 'PUBLIC10', 10, 1, NULL, NULL, 0, 0, 'sadec', '2026-11-17T00:00:00Z'),
        ('p_draft', 'DRAFT50', 50, 0, NULL, NULL, 0, 0, 'sadec', '2026-11-17T00:00:00Z');
      INSERT INTO orders VALUES ('ord_qr_nophone', NULL, NULL, '${tokenHash}', 'completed', 'sadec');
    `);
    const db = createSqliteD1(sqlite);
    const env = { AURA_DB: db, PILOT_TENANT_ID: 'sadec', JWT_SECRET: 'test-jwt-secret-at-least-16-chars' } as unknown as Env;

    const anonList = await promotionsRouter.request('/', { method: 'GET' }, env);
    expect(anonList.status).toBe(200);
    const anonBody = (await anonList.json()) as { data: Array<{ code: string }> };
    expect(anonBody.data.map((p) => p.code)).toEqual(['PUBLIC10']);
    const anonDraft = await promotionsRouter.request('/DRAFT50', { method: 'GET' }, env);
    expect(anonDraft.status).toBe(404);
    const crossOverride = await promotionsRouter.request('/?store_id=other-branch', { method: 'GET' }, env);
    expect(crossOverride.status).toBe(403);

    const forgedRev = await reviewsRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Order-Token': 'forged_token' },
      body: JSON.stringify({ order_id: 'ord_qr_nophone', rating: 5, comment: 'Fake' }),
    }, env);
    expect(forgedRev.status).toBe(403);

    const validRev = await reviewsRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Order-Token': tokenPlain },
      body: JSON.stringify({ order_id: 'ord_qr_nophone', rating: 5, comment: 'Tuyệt vời!' }),
    }, env);
    expect(validRev.status).toBe(201);

    const mapped = mapSseEventToOrder({ orderId: 'ord_sse_1', status: 'confirmed', payment_status: 'paid', total: 65000, createdAt: 1731800000000 });
    expect(mapped.id).toBe('ord_sse_1');
    expect(mapped.paymentStatus).toBe('paid');
    expect(mapped.totalAmount).toBe(65000);
  });
});
