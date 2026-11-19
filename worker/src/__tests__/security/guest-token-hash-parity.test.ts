// @vitest-environment node
/**
 * Guest capability token hash parity and D1 primary session pinning.
 *
 * Canonical D1 stores `orders.guest_token_hash = sha256(order_token)` without a
 * plaintext `order_token` column. Payment, refund, and promotion handlers must
 * verify `X-Order-Token` against `guest_token_hash`, reject forged tokens, and
 * pin D1 sessions to `first-primary` when Read Replication is active.
 */
import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { app } from '../../index';
import { withPrimarySession, getDatabase } from '../../lib/db';
import { paymentSqliteDB, payosCheckoutResponse } from '../helpers/payment-sqlite-db';
import { orderCreationFixture } from '../integrations/order-creation-fixture';

const closer: Array<{ close: () => void }> = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const db of closer.splice(0)) db.close();
});

function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function signTestJwt(payload: Record<string, unknown>): Promise<string> {
  const secret = 'test-jwt-secret-at-least-16-chars';
  const encoder = new TextEncoder();
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const b64Bytes = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
  return `${data}.${b64Bytes(sig)}`;
}

function canonicalGuestFixture() {
  const ctx = paymentSqliteDB();
  closer.push(ctx.sqlite);
  ctx.sqlite.exec(`
    ALTER TABLE orders ADD COLUMN guest_token_hash TEXT;
    CREATE TABLE promotions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      code TEXT NOT NULL,
      percent INTEGER DEFAULT 10,
      min_order INTEGER DEFAULT 0,
      max_discount INTEGER DEFAULT 30000,
      usage_limit INTEGER DEFAULT 100,
      usage_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      starts_at TEXT,
      expires_at TEXT
    );
    CREATE TABLE promotion_redemptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      promotion_id TEXT,
      code TEXT,
      order_id TEXT,
      customer_id TEXT,
      discount_amount INTEGER DEFAULT 0,
      created_at TEXT
    );
  `);
  const env = {
    AURA_DB: ctx.db,
    JWT_SECRET: 'test-jwt-secret-at-least-16-chars',
    PAYOS_CLIENT_ID: 'cid',
    PAYOS_API_KEY: 'apikey',
    PAYOS_CHECKSUM_KEY: 'checksum-secret',
  } as any;
  return { ...ctx, env };
}

describe('D1 primary session pinning and guest_token_hash verification', () => {
  it('pins D1 sessions via withSession("first-primary") and falls back when unsupported', () => {
    const sessionPrepare = vi.fn().mockReturnValue('stmt-from-session');
    const rawBatch = vi.fn();
    const withSession = vi.fn().mockReturnValue({ prepare: sessionPrepare });
    const mockDb = {
      prepare: vi.fn(),
      batch: rawBatch,
      exec: vi.fn(),
      dump: vi.fn(),
      withSession,
    } as unknown as D1Database;

    const pinned = withPrimarySession(mockDb);
    expect(withSession).toHaveBeenCalledWith('first-primary');
    expect(pinned.prepare('SELECT 1')).toBe('stmt-from-session');
    // Re-wrapping an already pinned handle is idempotent and does not open a second D1 session.
    expect(withPrimarySession(pinned)).toBe(pinned);
    expect(withSession).toHaveBeenCalledTimes(1);

    // Throwing test shims fall back cleanly to the raw D1 binding.
    const throwingDb = {
      prepare: vi.fn().mockReturnValue('raw-stmt'),
      batch: rawBatch,
      exec: vi.fn(),
      dump: vi.fn(),
      withSession: () => {
        throw new Error('withSession not implemented in test shim');
      },
    } as unknown as D1Database;

    const fallback = getDatabase({ env: { AURA_DB: throwingDb } });
    expect(fallback.prepare('SELECT 1')).toBe('raw-stmt');
  });

  it('authorizes guest order read, signed-in payment read, and promotion redeem via X-Order-Token against guest_token_hash', async () => {
    const { sqlite, payment, env } = canonicalGuestFixture();
    const rawToken = 'guest-capability-secret-token-192bit';
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, customer_id, total, payment_status, status, guest_token_hash, created_at, updated_at)
         VALUES ('ORD_HASH_1', 'default', NULL, 45000, 'unpaid', 'pending', ?, '2026-11-16T00:00:00Z', '2026-11-16T00:00:00Z')`,
      )
      .run(sha256Hex(rawToken));
    payment('ORD_HASH_1', 'pending', '998877');
    sqlite
      .prepare(
        `INSERT INTO promotions (id, tenant_id, code, percent, min_order, max_discount, is_active)
         VALUES ('PROMO_1', 'default', 'GUEST10', 10, 10000, 20000, 1)`,
      )
      .run();

    // Missing or forged token on full guest order read -> 401/403
    const unauthOrder = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_HASH_1'),
      env,
    );
    expect([401, 403]).toContain(unauthOrder.status);

    const forgedOrder = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_HASH_1', {
        headers: { 'X-Order-Token': 'forged-token-value' },
      }),
      env,
    );
    expect([401, 403]).toContain(forgedOrder.status);

    // Valid raw token matching guest_token_hash -> 200 on full order read
    const validOrder = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_HASH_1', {
        headers: { 'X-Order-Token': rawToken },
      }),
      env,
    );
    expect(validOrder.status).toBe(200);

    // Signed-in customer reading payment for an unclaimed guest order succeeds only with valid X-Order-Token
    const customerJwt = await signTestJwt({
      id: 'cust-claim-1',
      sub: 'cust-claim-1',
      role: 'customer',
      tenantId: 'default',
    });
    const noTokenPayment = await app.fetch(
      new Request('https://test.aura/api/payments/pay_ORD_HASH_1', {
        headers: { Authorization: `Bearer ${customerJwt}` },
      }),
      env,
    );
    expect(noTokenPayment.status).toBe(404);

    const validTokenPayment = await app.fetch(
      new Request('https://test.aura/api/payments/pay_ORD_HASH_1', {
        headers: {
          Authorization: `Bearer ${customerJwt}`,
          'X-Order-Token': rawToken,
        },
      }),
      env,
    );
    expect(validTokenPayment.status).toBe(200);

    // Guest promotion redemption verifies X-Order-Token against guest_token_hash
    const forgedRedeem = await app.fetch(
      new Request('https://test.aura/api/promotions/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Token': 'forged-token-value',
        },
        body: JSON.stringify({
          code: 'GUEST10',
          order_id: 'ORD_HASH_1',
          order_total: 45000,
        }),
      }),
      env,
    );
    expect([401, 403]).toContain(forgedRedeem.status);

    const validRedeem = await app.fetch(
      new Request('https://test.aura/api/promotions/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Token': rawToken,
        },
        body: JSON.stringify({
          code: 'GUEST10',
          order_id: 'ORD_HASH_1',
          order_total: 45000,
        }),
      }),
      env,
    );
    expect(validRedeem.status).toBe(200);
  });

  it('rejects forged X-Order-Token on PayOS create-link while preserving unauthenticated guest checkout', async () => {
    const { sqlite, env } = canonicalGuestFixture();
    const rawToken = 'checkout-guest-secret-token';
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, customer_id, total, payment_status, status, guest_token_hash, created_at, updated_at)
         VALUES ('ORD_LINK_1', 'default', NULL, 55000, 'unpaid', 'pending', ?, '2026-11-16T00:00:00Z', '2026-11-16T00:00:00Z')`,
      )
      .run(sha256Hex(rawToken));

    // Forged X-Order-Token must be rejected with 403 even on allowGuest create-link
    const forgedRes = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Order-Token': 'wrong-guest-token',
        },
        body: JSON.stringify({ order_id: 'ORD_LINK_1' }),
      }),
      env,
    );
    expect(forgedRes.status).toBe(403);

    // Unauthenticated guest create-link without X-Order-Token continues to succeed
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) =>
      payosCheckoutResponse(
        JSON.parse(String(init?.body || '{}')),
        'checksum-secret',
        'ord-link-1',
      ),
    );
    const unauthGuestRes = await app.fetch(
      new Request('https://test.aura/api/payment/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_LINK_1' }),
      }),
      env,
    );
    expect(unauthGuestRes.status).toBe(200);
  });

  it('returns order_token from POST /api/orders/sync and allows X-Order-Token in CORS preflight', async () => {
    const created = orderCreationFixture();
    closer.push(created.sqlite);

    const preflight = await app.fetch(
      new Request('https://test.aura/api/orders/sync', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://auraspace.cafe',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, X-Order-Token, X-Local-ID',
        },
      }),
      created.env as any,
    );
    expect(preflight.headers.get('Access-Control-Allow-Headers') || '').toContain('X-Order-Token');

    const syncRes = await app.fetch(
      new Request('https://test.aura/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localId: 'loc-sync-guest-1',
          orderData: {
            items: [{ product_id: 'coffee', name: 'Coffee', quantity: 1 }],
            total: 20000,
            customer_name: 'Offline Guest',
            customer_phone: '0900000010',
            payment_method: 'cod',
          },
        }),
      }),
      created.env as any,
    );
    expect(syncRes.status).toBe(201);
    const syncBody = (await syncRes.json()) as {
      order_token?: string;
      data?: { id?: string };
    };
    expect(typeof syncBody.order_token).toBe('string');
    expect((syncBody.order_token || '').length).toBeGreaterThanOrEqual(32);
    const syncedOrderId = syncBody.data?.id;
    expect(typeof syncedOrderId).toBe('string');

    const readSynced = await app.fetch(
      new Request(`https://test.aura/api/orders/${syncedOrderId}`, {
        headers: { 'X-Order-Token': syncBody.order_token! },
      }),
      created.env as any,
    );
    expect(readSynced.status).toBe(200);
  });

  it('claims canonical guest_token_hash orders via X-Order-Token or verification_value and rejects forged tokens', async () => {
    const { sqlite, env } = canonicalGuestFixture();
    const rawTokenA = 'claim-canonical-token-alpha-192bit';
    const rawTokenB = 'claim-canonical-token-bravo-192bit';
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, customer_id, customer_phone, total, payment_status, status, guest_token_hash, created_at, updated_at)
         VALUES ('ORD_CLAIM_A', 'default', NULL, 'guest', 45000, 'unpaid', 'pending', ?, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z'),
                ('ORD_CLAIM_B', 'default', NULL, 'guest', 50000, 'unpaid', 'pending', ?, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')`,
      )
      .run(sha256Hex(rawTokenA), sha256Hex(rawTokenB));

    const customerJwt = await signTestJwt({
      id: 'cust-claim-canonical',
      sub: 'cust-claim-canonical',
      role: 'customer',
      tenantId: 'default',
    });

    const forgedClaim = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_CLAIM_A/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerJwt}`,
          'Content-Type': 'application/json',
          'X-Order-Token': 'forged-claim-token',
        },
        body: JSON.stringify({}),
      }),
      env,
    );
    expect([401, 403]).toContain(forgedClaim.status);

    const headerClaim = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_CLAIM_A/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerJwt}`,
          'Content-Type': 'application/json',
          'X-Order-Token': rawTokenA,
        },
        body: JSON.stringify({}),
      }),
      env,
    );
    expect(headerClaim.status).toBe(200);
    const claimedRowA = sqlite
      .prepare('SELECT customer_id FROM orders WHERE id = ?')
      .get('ORD_CLAIM_A') as { customer_id?: string | null } | undefined;
    expect(claimedRowA?.customer_id).toBe('cust-claim-canonical');

    const bodyVerificationClaim = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_CLAIM_B/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verification_type: 'order_token',
          verification_value: rawTokenB,
        }),
      }),
      env,
    );
    expect(bodyVerificationClaim.status).toBe(200);
    const claimedRowB = sqlite
      .prepare('SELECT customer_id FROM orders WHERE id = ?')
      .get('ORD_CLAIM_B') as { customer_id?: string | null } | undefined;
    expect(claimedRowB?.customer_id).toBe('cust-claim-canonical');
  });

  it('broadcasts PayOS webhook settlement to ORDER_BROADCASTER and tenant-scoped KV order_event', async () => {
    const { sqlite, env } = canonicalGuestFixture();
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, customer_id, total, payment_status, payment_method, status, items, created_at, updated_at)
         VALUES ('ORD_WEBHOOK_RT', 'branch-b', NULL, 60000, 'unpaid', 'payos', 'pending', '[]', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')`,
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, created_at, updated_at)
         VALUES ('pay_ORD_WEBHOOK_RT', 'ORD_WEBHOOK_RT', 'payos', 60000, 'pending', '776655', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')`,
      )
      .run();

    const kvStore = new Map<string, string>();
    const doBroadcasts: Array<{ channel: string; payload: Record<string, unknown> }> = [];
    env.AUTH_KV = {
      get: async (k: string) => kvStore.get(k) ?? null,
      put: async (k: string, v: string) => {
        kvStore.set(k, v);
      },
      delete: async (k: string) => {
        kvStore.delete(k);
      },
    };
    env.ORDER_BROADCASTER = {
      idFromName: (name: string) => name,
      get: (channel: string) => ({
        broadcast: async (payload: Record<string, unknown>) => {
          doBroadcasts.push({ channel, payload });
        },
      }),
    };

    const webhookData: Record<string, unknown> = {
      accountNumber: '0123456789',
      amount: 60000,
      code: '00',
      currency: 'VND',
      description: 'Thanh toan don hang',
      orderCode: 776655,
      paymentLinkId: 'plink-rt-1',
      reference: 'FT2611170001',
      transactionDateTime: '2026-11-17 10:00:00',
    };
    const canonical = Object.keys(webhookData)
      .sort()
      .map((k) => `${k}=${webhookData[k]}`)
      .join('&');
    const signature = createHmac('sha256', 'checksum-secret').update(canonical).digest('hex');

    const webhookRes = await app.fetch(
      new Request('https://test.aura/api/webhook/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '00',
          desc: 'success',
          success: true,
          data: webhookData,
          signature,
        }),
      }),
      env,
    );
    expect(webhookRes.status).toBe(200);
    expect(doBroadcasts).toHaveLength(1);
    expect(doBroadcasts[0]?.channel).toBe('branch-b:ORD_WEBHOOK_RT');
    expect(doBroadcasts[0]?.payload).toMatchObject({
      orderId: 'ORD_WEBHOOK_RT',
      status: 'pending',
      payment_status: 'paid',
      tenant_id: 'branch-b',
    });
    expect(kvStore.get('latest_order_ts:branch-b')).toBeTruthy();
    const scopedEvent = JSON.parse(kvStore.get('order_event:branch-b:ORD_WEBHOOK_RT') || '{}');
    expect(scopedEvent).toMatchObject({
      orderId: 'ORD_WEBHOOK_RT',
      status: 'pending',
      paymentStatus: 'paid',
      tenantId: 'branch-b',
    });
  });

  it('blocks signed-in foreign customer and forged X-Order-Token on GET /api/orders/:id/track while keeping anonymous shareable link working', async () => {
    const { sqlite, env } = canonicalGuestFixture();
    const rawToken = 'track-capability-token-secret-192bit';
    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, customer_id, customer_name, customer_phone, total, payment_status, status, guest_token_hash, created_at, updated_at)
         VALUES ('ORD_TRACK_GUARD', 'default', NULL, 'Secret Guest', '0908887777', 42000, 'unpaid', 'pending', ?, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')`,
      )
      .run(sha256Hex(rawToken));

    // Anonymous shareable /track link without token remains allowed with zero-PII payload
    const anonTrack = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_TRACK_GUARD/track'),
      env,
    );
    expect(anonTrack.status).toBe(200);
    const anonBody = (await anonTrack.json()) as { data?: Record<string, unknown> };
    expect(anonBody.data?.customer_name).toBeUndefined();
    expect(anonBody.data?.customer_phone).toBeUndefined();

    // Forged X-Order-Token is rejected with 403
    const forgedTrack = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_TRACK_GUARD/track', {
        headers: { 'X-Order-Token': 'forged-track-token' },
      }),
      env,
    );
    expect(forgedTrack.status).toBe(403);

    // Signed-in foreign customer without matching X-Order-Token cannot enumerate unclaimed guest order
    const foreignCustomerJwt = await signTestJwt({
      id: 'cust-foreign-enumerator',
      sub: 'cust-foreign-enumerator',
      role: 'customer',
      tenantId: 'default',
    });
    const foreignSignedInTrack = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_TRACK_GUARD/track', {
        headers: { Authorization: `Bearer ${foreignCustomerJwt}` },
      }),
      env,
    );
    expect(foreignSignedInTrack.status).toBe(403);

    // Signed-in customer presenting the matching X-Order-Token (e.g. guest who just logged in) is allowed
    const holderSignedInTrack = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_TRACK_GUARD/track', {
        headers: {
          Authorization: `Bearer ${foreignCustomerJwt}`,
          'X-Order-Token': rawToken,
        },
      }),
      env,
    );
    expect(holderSignedInTrack.status).toBe(200);
  });

  it('mints per-child guest_token_hash and order_tokens in POST /api/orders/split and enforces capability token on child order detail', async () => {
    const created = orderCreationFixture();
    closer.push(created.sqlite);
    created.sqlite.exec(`
      INSERT INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id)
      VALUES ('tbl_split_1', 'B08', 'Indoor', 4, 'Available', 'default');
    `);

    const splitRes = await app.fetch(
      new Request('https://test.aura/api/orders/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-split-parity-1',
        },
        body: JSON.stringify({
          table_id: 'B08',
          orders: [
            {
              customer_name: 'Guest Split 1',
              customer_phone: '0901112233',
              payment_method: 'cod',
              items: [{ product_id: 'coffee', name: 'Coffee', quantity: 1 }],
            },
            {
              customer_name: 'Guest Split 2',
              customer_phone: '0901112244',
              payment_method: 'cod',
              items: [{ product_id: 'coffee', name: 'Coffee', quantity: 1 }],
            },
          ],
        }),
      }),
      created.env as any,
    );
    expect(splitRes.status).toBe(201);
    const splitBody = (await splitRes.json()) as {
      order_tokens?: Record<string, string>;
      orders?: Array<{ id: string; order_token?: string }>;
    };
    const tokens = splitBody.order_tokens || {};
    const ids = Object.keys(tokens);
    expect(ids).toHaveLength(2);

    for (const childId of ids) {
      const childToken = tokens[childId]!;
      expect(childToken.length).toBeGreaterThanOrEqual(32);
      const row = created.sqlite
        .prepare('SELECT guest_token_hash FROM orders WHERE id = ?')
        .get(childId) as { guest_token_hash?: string | null } | undefined;
      expect(row?.guest_token_hash).toBe(sha256Hex(childToken));

      const unauthDetail = await app.fetch(
        new Request(`https://test.aura/api/orders/${childId}`),
        created.env as any,
      );
      expect([401, 403]).toContain(unauthDetail.status);

      const authDetail = await app.fetch(
        new Request(`https://test.aura/api/orders/${childId}`, {
          headers: { 'X-Order-Token': childToken },
        }),
        created.env as any,
      );
      expect(authDetail.status).toBe(200);
    }
  });

  it('allows kitchen role ready -> served while blocking served -> completed, holds QR check-in placeholder out of KDS, and broadcasts COD mark-paid', async () => {
    const { sqlite, env } = canonicalGuestFixture();
    sqlite.exec(`
      ALTER TABLE orders ADD COLUMN previous_status TEXT;
      ALTER TABLE orders ADD COLUMN served_at TEXT;
      ALTER TABLE orders ADD COLUMN completed_at TEXT;
      ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
      ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
      ALTER TABLE payments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
    `);

    sqlite
      .prepare(
        `INSERT INTO orders (id, tenant_id, customer_name, customer_phone, items, total, payment_method, payment_status, status, notes, created_at, updated_at)
         VALUES
           ('ORD_QR_WAIT', 'branch-k', 'QR Checkin', '0909990001', '[]', 0, 'cod', 'unpaid', 'pending', 'Khách QR - cho don mon', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z'),
           ('ORD_BARISTA_1', 'branch-k', 'Active Drink', '0909990002', '[{"name":"Latte","quantity":1,"price":35000}]', 35000, 'cod', 'unpaid', 'ready', NULL, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')`,
      )
      .run();

    const kvStore = new Map<string, string>();
    const doBroadcasts: Array<{ channel: string; payload: Record<string, unknown> }> = [];
    env.AUTH_KV = {
      get: async (k: string) => kvStore.get(k) ?? null,
      put: async (k: string, v: string) => {
        kvStore.set(k, v);
      },
      delete: async (k: string) => {
        kvStore.delete(k);
      },
    };
    env.ORDER_BROADCASTER = {
      idFromName: (name: string) => name,
      get: (channel: string) => ({
        fetch: async (req: Request) => {
          const payload = (await req.json()) as Record<string, unknown>;
          doBroadcasts.push({ channel, payload });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      }),
    };

    sqlite
      .prepare(
        `INSERT INTO users (id, name, role, tenant_id, is_active, auth_version, created_at, updated_at)
         VALUES
           ('barista-1', 'Barista One', 'barista', 'branch-k', 1, 1, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z'),
           ('cashier-1', 'Cashier One', 'cashier', 'branch-k', 1, 1, '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')`,
      )
      .run();

    const authTime = Math.floor(Date.now() / 1000);
    const baristaJwt = await signTestJwt({
      id: 'barista-1',
      sub: 'barista-1',
      role: 'barista',
      tenantId: 'branch-k',
      authVersion: 1,
      authTime,
      sessionType: 'staff-web',
    });
    const cashierJwt = await signTestJwt({
      id: 'cashier-1',
      sub: 'cashier-1',
      role: 'cashier',
      tenantId: 'branch-k',
      authVersion: 1,
      authTime,
      sessionType: 'staff-web',
    });

    const kdsRes = await app.fetch(
      new Request('https://test.aura/api/orders/kds', {
        headers: { Authorization: `Bearer ${baristaJwt}`, 'X-Tenant-ID': 'branch-k' },
      }),
      env,
    );
    expect(kdsRes.status).toBe(200);
    const kdsBody = (await kdsRes.json()) as { data?: Array<{ id: string }> };
    const kdsIds = (kdsBody.data || []).map((o) => o.id);
    expect(kdsIds).toContain('ORD_BARISTA_1');
    expect(kdsIds).not.toContain('ORD_QR_WAIT');

    const serveRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_BARISTA_1/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${baristaJwt}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'branch-k',
        },
        body: JSON.stringify({ status: 'served' }),
      }),
      env,
    );
    expect(serveRes.status).toBe(200);

    const completeRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_BARISTA_1/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${baristaJwt}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'branch-k',
        },
        body: JSON.stringify({ status: 'completed' }),
      }),
      env,
    );
    expect(completeRes.status).toBe(403);

    doBroadcasts.length = 0;
    const codPaidRes = await app.fetch(
      new Request('https://test.aura/api/orders/ORD_BARISTA_1/mark-cod-paid', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cashierJwt}`,
          'X-Tenant-ID': 'branch-k',
        },
      }),
      env,
    );
    expect(codPaidRes.status).toBe(200);
    expect(doBroadcasts).toHaveLength(1);
    expect(doBroadcasts[0]?.channel).toBe('branch-k:ORD_BARISTA_1');
    expect(doBroadcasts[0]?.payload).toMatchObject({
      orderId: 'ORD_BARISTA_1',
      status: 'served',
      payment_status: 'paid',
      tenant_id: 'branch-k',
    });
    const codKvEvent = JSON.parse(kvStore.get('order_event:branch-k:ORD_BARISTA_1') || '{}');
    expect(codKvEvent).toMatchObject({
      orderId: 'ORD_BARISTA_1',
      status: 'served',
      paymentStatus: 'paid',
      tenantId: 'branch-k',
    });
  });
});
