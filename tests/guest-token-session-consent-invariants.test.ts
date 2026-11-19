// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { createOrder } from '../packages/domain/order/commands/create-order';
import {
  transitionOrderStatus,
  ISSUED_EINVOICE_CANCEL_ERROR,
} from '../packages/domain/order/policies/order-status-transition';
import { executeKdsStatusTransition } from '../packages/domain/kitchen/commands/kds-status-transition';
import { eraseCustomerPii } from '../packages/domain/crm/commands/erase-customer-pii';
import { updateConsent } from '../packages/domain/crm/commands/update-consent';
import { handleGetOrderById } from '../worker/src/routes/openapi-orders-handlers/order-read-handlers';
import { registerProfileHandlers } from '../worker/src/routes/customers-handlers/profile-handlers';
import { registerSendHandler } from '../worker/src/routes/broadcast-handlers/send-handler';
import { handlePhoneOtpRequest } from '../worker/src/tree/loyalty/phone-otp-handler';
import { handlePhoneAuth } from '../worker/src/tree/loyalty/phone-auth-handler';
import { logoutUser } from '../worker/src/tree/auth/logout';
import type { Env } from '../worker/src/types/env';
import { createCanonicalD1, closeCanonicalD1s } from './helpers/canonical-d1-harness';

afterEach(() => {
  vi.restoreAllMocks();
  closeCanonicalD1s();
});

describe('Guest Capability Token, Session Revocation, Spoilage & Per-Channel Consent Invariants', () => {
  it('mints order_token on guest createOrder and enforces capability token on GET /api/orders/:id', async () => {
    const { sqlite, db, kv } = createCanonicalD1();
    sqlite.prepare("INSERT INTO categories (id, name, slug) VALUES ('cat_g', 'Cà Phê', 'ca-phe')").run();
    sqlite.prepare("INSERT INTO products (id, category_id, name, price, available, is_available) VALUES ('p_g1', 'cat_g', 'Bạc Xỉu', 32000, 1, 1)").run();

    const createRes = await createOrder(
      new Request('https://api.aura.vn/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-guest-tok-1' },
        body: JSON.stringify({
          customer_name: 'Khách Vãng Lai',
          customer_phone: '0909888777',
          payment_method: 'cod',
          order_type: 'takeaway',
          items: [{ id: 'p_g1', name: 'Bạc Xỉu', quantity: 1, price: 32000 }],
          total: 32000,
        }),
      }),
      { AURA_DB: db, AUTH_KV: kv } as any,
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { order_token?: string; data: { id: string; order_token?: string } };
    const orderId = created.data.id;
    const orderToken = created.order_token ?? created.data.order_token;
    expect(typeof orderToken).toBe('string');
    expect(orderToken!.length).toBeGreaterThanOrEqual(32);

    const row = sqlite.prepare('SELECT guest_token_hash FROM orders WHERE id = ?').get(orderId) as { guest_token_hash: string | null };
    expect(row.guest_token_hash).toMatch(/^[0-9a-f]{64}$/);

    const readApp = new Hono<{ Bindings: Env }>();
    readApp.get('/orders/:id', (c) => handleGetOrderById(c as any));
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: 'test_jwt_secret_at_least_32_bytes_long_012345' } as any;

    expect((await readApp.request(`/orders/${orderId}`, {}, env)).status).toBe(401);
    expect((await readApp.request(`/orders/${orderId}`, { headers: { 'X-Order-Token': 'forged_token_value' } }, env)).status).toBe(403);
    const validRes = await readApp.request(`/orders/${orderId}`, { headers: { 'X-Order-Token': orderToken! } }, env);
    expect(validRes.status).toBe(200);
  });

  it('preserves working customer re-login after logout and fails closed (503) when OTP D1 persistence fails', async () => {
    const { sqlite, db, kv, kvStore } = createCanonicalD1();
    const jwtSecret = 'test_jwt_secret_at_least_32_bytes_long_012345';
    sqlite.prepare("INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, auth_version, tenant_id) VALUES ('cust_relogin', 'Ngọc', '0912345678', 50, 50, 'bronze', 1, 'default')").run();

    const authApp = new Hono<{ Bindings: Env }>();
    authApp.post('/phone-otp', handlePhoneOtpRequest);
    authApp.post('/phone-auth', handlePhoneAuth);
    const meRouter = new Hono<{ Bindings: Env }>();
    registerProfileHandlers(meRouter);
    authApp.route('/customers', meRouter);
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: jwtSecret } as any;

    await authApp.request('/phone-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0912345678' }) }, env);
    const otp1 = kvStore.get('phone_otp:default:0912345678')?.value;
    const login1 = await authApp.request('/phone-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0912345678', otp: otp1 }) }, env);
    const { token: jwt1 } = (await login1.json()) as { token: string };
    expect(typeof jwt1).toBe('string');

    const logoutRes = await logoutUser(new Request('https://api.aura.vn/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${jwt1}` } }), env);
    expect(logoutRes.status).toBe(200);
    expect((await authApp.request('/customers/me', { headers: { Authorization: `Bearer ${jwt1}` } }, env)).status).toBe(401);

    await authApp.request('/phone-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0912345678' }) }, env);
    const otp2 = kvStore.get('phone_otp:default:0912345678')?.value;
    const login2 = await authApp.request('/phone-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0912345678', otp: otp2 }) }, env);
    const { token: jwt2 } = (await login2.json()) as { token: string };
    expect((await authApp.request('/customers/me', { headers: { Authorization: `Bearer ${jwt2}` } }, env)).status).toBe(200);

    const brokenDb = {
      prepare: (sql: string) => {
        if (/otp_challenges/i.test(sql)) {
          return { run: async () => { throw new Error('D1 write unavailable'); }, bind: () => ({ run: async () => { throw new Error('D1 write unavailable'); } }) };
        }
        return db.prepare(sql);
      },
    };
    const brokenOtpRes = await authApp.request(
      '/phone-otp',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0912345678' }) },
      { AURA_DB: brokenDb, AUTH_KV: kv, JWT_SECRET: jwtSecret } as any,
    );
    expect(brokenOtpRes.status).toBe(503);
    expect(kvStore.has('phone_otp:default:0912345678')).toBe(false);
  });

  it('prevents cross-tenant PII erasure, allows COD delivery prep, spoils cancelled KDS stock, blocks e-invoice cancel, and honors channel consent', async () => {
    const { sqlite, db, kv, kvStore } = createCanonicalD1();
    sqlite.prepare("INSERT INTO customers (id, name, phone, email, auth_version, tenant_id) VALUES ('cust_t1', 'Trâm', '0933444555', 'tram@aura.vn', 1, 'default')").run();
    await kv.put('phone_otp:default:0933444555', '654321');
    await kv.put('cust_auth_ver:cust_t1', '1');

    await updateConsent(db, { customerId: 'cust_t1', purpose: 'marketing', channel: 'all', granted: true, source: 'customer_portal', actorId: 'cust_t1', actorRole: 'customer', tenantId: 'default' }, 'default');
    await updateConsent(db, { customerId: 'cust_t1', purpose: 'marketing', channel: 'sms', granted: false, source: 'customer_portal', actorId: 'cust_t1', actorRole: 'customer', tenantId: 'default' }, 'default');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 202 }));
    const bcastApp = new Hono<{ Bindings: Env }>();
    bcastApp.use('*', async (c, next) => { c.set('user' as never, { id: 'adm_1', role: 'owner', tenant_id: 'default' } as never); await next(); });
    registerSendHandler(bcastApp);
    const bcastEnv = { AURA_DB: db, SPEEDSMS_API_KEY: 'sms_mock', SENDGRID_API_KEY: 'SG.mock' } as any;

    const smsRes = await bcastApp.request('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segment: 'all', channel: 'sms', title: 'KM', message: 'SMS test' }) }, bcastEnv);
    expect(smsRes.status).toBe(400);
    const emailRes = await bcastApp.request('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segment: 'all', channel: 'email', title: 'KM', message: 'Email test' }) }, bcastEnv);
    expect(emailRes.status).toBe(200);

    const wrongTenantErase = await eraseCustomerPii(db, { customerId: 'cust_t1', actorId: 'mgr_b', actorRole: 'manager', tenantId: 'store-b', kv });
    expect(wrongTenantErase.notFound).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS cnt FROM consents WHERE customer_id = 'cust_t1' AND revoked_at IS NULL").get()).toEqual({ cnt: 1 });

    const rightTenantErase = await eraseCustomerPii(db, { customerId: 'cust_t1', actorId: 'cust_t1', actorRole: 'customer', tenantId: 'default', kv });
    expect(rightTenantErase.ok).toBe(true);
    expect(sqlite.prepare("SELECT COUNT(*) AS cnt FROM consents WHERE customer_id = 'cust_t1' AND revoked_at IS NULL").get()).toEqual({ cnt: 0 });
    expect(kvStore.has('phone_otp:default:0933444555')).toBe(false);
    expect(kvStore.has('cust_auth_ver:cust_t1')).toBe(false);
    const anonRow = sqlite.prepare("SELECT anonymized_at FROM customers WHERE id = 'cust_t1'").get() as { anonymized_at: string | null };
    expect(anonRow.anonymized_at).toBeTruthy();

    sqlite.prepare("INSERT INTO orders (id, items, customer_name, customer_phone, order_type, payment_method, payment_status, status, is_cod, total, tenant_id) VALUES ('ord_del_cod', '[]', 'A', '0901112222', 'delivery', 'cod', 'unpaid', 'confirmed', 1, 50000, 'default'), ('ord_del_qr', '[]', 'B', '0901113333', 'delivery', 'payos', 'unpaid', 'confirmed', 0, 50000, 'default')").run();
    expect((await transitionOrderStatus(db, 'ord_del_cod', 'preparing', 'kitchen')).success).toBe(true);
    expect((await transitionOrderStatus(db, 'ord_del_qr', 'preparing', 'kitchen')).statusCode).toBe(409);

    sqlite.prepare("INSERT INTO ingredients (id, name, sku, unit, current_stock) VALUES ('ing_esp', 'Hạt Espresso', 'SKU-ESP', 'g', 500)").run();
    sqlite.prepare("INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type) VALUES ('sm_1', 'ing_esp', 'consumption', -18, 'ord_del_cod', 'order')").run();
    const kdsCancel = await executeKdsStatusTransition(db, 'ord_del_cod', 'cancelled', 'manager', { tenantId: 'default' });
    expect(kdsCancel.success).toBe(true);
    expect(sqlite.prepare("SELECT current_stock FROM ingredients WHERE id = 'ing_esp'").get()).toEqual({ current_stock: 500 });
    expect(sqlite.prepare("SELECT COUNT(*) AS cnt FROM waste_log WHERE order_id = 'ord_del_cod' AND ingredient_id = 'ing_esp'").get()).toEqual({ cnt: 1 });

    sqlite.prepare("INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, sync_status, tenant_id) VALUES ('em_inv_1', 'sales_invoice', 'ord_del_qr', 'SINV-0099', 'synced', 'default')").run();
    const einvCancel = await transitionOrderStatus(db, 'ord_del_qr', 'cancelled', 'owner', { tenantId: 'default' });
    expect(einvCancel).toMatchObject({ success: false, statusCode: 409, error: ISSUED_EINVOICE_CANCEL_ERROR });
  });
});
