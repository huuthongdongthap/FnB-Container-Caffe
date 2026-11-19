// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { createOrder } from '../packages/domain/order/commands/create-order';
import { splitOrders } from '../packages/domain/order/commands/split-orders';
import { transitionOrderStatus, PAID_ORDER_CANCEL_ERROR } from '../packages/domain/order/policies/order-status-transition';
import { getStats } from '../packages/domain/order/queries/stats';
import { getOrCreatePayOSAttempt, cancelOpenPayOSAttemptForOrder } from '../packages/domain/payment/commands/payos-attempt';
import { reverseAccrual } from '../packages/domain/crm/commands/refund-reversal';
import { eraseCustomerPii } from '../packages/domain/crm/commands/erase-customer-pii';
import { hashOrderToken, verifyGuestOrderToken, canAccessOrder } from '../packages/domain/customer/policies/order-ownership-policy';
import { restoreInventoryForOrder } from '../packages/domain/inventory/src/routes/order-deduction';
import { collectCodPayment } from '../packages/domain/kitchen/commands/collect-cod-payment';
import { handlePayosWebhook } from '../worker/src/routes/webhooks-handlers/payos';
import { handleGetKdsOrders, registerKdsHandlers } from '../worker/src/routes/orders-hono-handlers/kds-handlers';
import { generateJWT } from '../worker/src/lib/jwt';
import { hasIssuedEInvoice } from '../worker/src/routes/openapi-orders-handlers/order-cancel-handlers';
import { persistOtpChallenge, consumeOtpChallenge, recordOtpFailedAttempt } from '../worker/src/tree/loyalty/helpers';
import { createLogger } from '../worker/src/middleware/logger';
import { handleRealtimeChannel } from '../worker/src/routes/realtime-orders';
import { registerSendHandler } from '../worker/src/routes/broadcast-handlers/send-handler';
import type { Env } from '../worker/src/types/env';
import { createCanonicalD1, closeCanonicalD1s, signPayOS, defaultLoyaltyPolicy as policy } from './helpers/canonical-d1-harness';

afterEach(() => { vi.restoreAllMocks(); closeCanonicalD1s(); });

describe('End-to-End Domain Integrity, Concurrency, Security & Privacy Verification', () => {
  it('enforces server catalog pricing, split-order statutory VAT cap, and PayOS webhook HMAC/link/idempotency', async () => {
    const { sqlite, db, kv } = createCanonicalD1();
    sqlite.prepare("INSERT INTO categories (id, name, slug) VALUES ('cat_1', 'Cà Phê', 'ca-phe')").run();
    sqlite.prepare("INSERT INTO products (id, category_id, name, price, available, is_available) VALUES ('p_cf', 'cat_1', 'Cà Phê Muối', 35000, 1, 1)").run();
    sqlite.prepare("INSERT INTO cafe_tables (id, table_number, capacity, zone, status, tenant_id) VALUES ('t_01', '01', 4, 'indoor', 'Available', 'default')").run();

    const tamperedReq = new Request('https://api.aura.vn/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Khách', customer_phone: '0901234567', payment_method: 'payos', order_type: 'takeaway', items: [{ id: 'p_cf', quantity: 2, price: 1000 }], total: 2000 }),
    });
    const tamperedRes = await createOrder(tamperedReq, { AURA_DB: db, AUTH_KV: kv } as any);
    expect(tamperedRes.status).toBe(400);

    const excessiveVatSplit = await splitOrders(new Request('https://api.aura.vn/api/orders/split', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: [{ customer_name: 'A', customer_phone: '0901234567', payment_method: 'cash', items: [{ id: 'p_cf', quantity: 1, price: 35000 }], tax: 9000, total: 44000 }] }),
    }), { AURA_DB: db } as any, 't_01', 'default', { id: 'staff_1', role: 'cashier' });
    expect(excessiveVatSplit.status).toBe(400);

    sqlite.prepare("INSERT INTO orders (id, items, customer_name, customer_phone, tenant_id, total, status, payment_status, payment_method) VALUES ('ord_w1', '[]', 'Khách', '0901234567', 'default', 35000, 'pending', 'unpaid', 'payos')").run();
    sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id) VALUES ('payos:ord_w1', 'ord_w1', 'payos', 35000, 'pending', '555001', 'https://pay.payos.vn/web/lnk_ok', 'default')").run();

    const badLink = { orderCode: 555001, amount: 35000, description: 'ord', status: 'PAID', paymentLinkId: 'lnk_forged', reference: 'REF_1' };
    const mkWebhookCtx = (payload: unknown) => ({
      req: { json: async () => payload, header: () => undefined, raw: new Request('https://api.aura.vn/api/webhook/payos', { method: 'POST', body: JSON.stringify(payload) }) },
      env: { AURA_DB: db, AUTH_KV: kv, PAYOS_CHECKSUM_KEY: 'chk_1' },
      json: (d: unknown, status = 200) => new Response(JSON.stringify(d), { status }),
    });
    expect((await handlePayosWebhook(mkWebhookCtx({ code: '00', success: true, data: badLink, signature: signPayOS(badLink, 'chk_1') }) as any)).status).toBe(400);

    const goodData = { ...badLink, paymentLinkId: 'lnk_ok', code: '00' };
    const goodPayload = { code: '00', success: true, data: goodData, signature: signPayOS(goodData, 'chk_1') };
    expect((await handlePayosWebhook(mkWebhookCtx(goodPayload) as any)).status).toBe(200);
    expect((await handlePayosWebhook(mkWebhookCtx(goodPayload) as any)).status).toBe(200);
    expect(sqlite.prepare("SELECT payment_status FROM orders WHERE id = 'ord_w1'").get()).toEqual({ payment_status: 'paid' });
    expect(sqlite.prepare("SELECT status, provider_reference FROM payments WHERE id = 'payos:ord_w1'").get()).toEqual({ status: 'completed', provider_reference: 'REF_1' });
  });

  it('guards paid-order raw cancel, rotates expired PayOS links, cancels open links, and claws back redeemed vouchers', async () => {
    const { sqlite, db } = createCanonicalD1();
    sqlite.prepare("INSERT INTO orders (id, items, customer_name, customer_phone, payment_method, status, payment_status, total, points_earned, cashback_earned, tenant_id) VALUES ('ord_paid', '[]', 'Lan', '0911222333', 'payos', 'confirmed', 'paid', 100000, 100, 5000, 'default')").run();
    const rawCancel = await transitionOrderStatus(db, 'ord_paid', 'cancelled', 'cashier');
    expect(rawCancel).toMatchObject({ success: false, statusCode: 409, error: PAID_ORDER_CANCEL_ERROR });

    sqlite.prepare("INSERT INTO orders (id, items, customer_name, customer_phone, payment_method, status, payment_status, total, tenant_id) VALUES ('ord_exp', '[]', 'Lan', '0911222333', 'payos', 'pending', 'unpaid', 40000, 'default')").run();
    sqlite.prepare("INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id) VALUES ('payos:ord_exp', 'ord_exp', 'payos', 40000, 'expired', '70001', 'https://pay.payos.vn/web/old', 'default')").run();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('/cancel')) return new Response(JSON.stringify({ code: '00' }), { status: 200 });
      const body = JSON.parse(String(init?.body));
      const d = { orderCode: body.orderCode, amount: 40000, status: 'PENDING', paymentLinkId: 'rot_1', checkoutUrl: 'https://pay.payos.vn/web/rot_1' };
      return new Response(JSON.stringify({ code: '00', data: d, signature: signPayOS(d, 'chk_1') }), { status: 200 });
    });
    const rotated = await getOrCreatePayOSAttempt({ db, orderId: 'ord_exp', amount: 40000, clientId: 'c', apiKey: 'k', checksumKey: 'chk_1', description: 'rot', returnUrl: 'https://a.vn/ok', cancelUrl: 'https://a.vn/no' });
    expect(rotated.ok).toBe(true);
    const cancelled = await cancelOpenPayOSAttemptForOrder(db, { PAYOS_CLIENT_ID: 'c', PAYOS_API_KEY: 'k' }, 'ord_exp', 'default');
    expect(cancelled).toEqual({ cancelled: 1, providerNotified: 1 });

    sqlite.prepare("INSERT INTO customers (id, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id) VALUES ('cust_v', 'Lan', '0911222333', 0, 100, 'bronze', 'default')").run();
    sqlite.prepare("INSERT INTO cashback_wallets (id, customer_id, balance, tenant_id) VALUES ('w_v', 'cust_v', 5000, 'default')").run();
    sqlite.prepare("INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, tenant_id) VALUES ('tx_e1', 'w_v', 'cust_v', 'ord_paid', 'earn', 5000, 5000, 'default')").run();
    sqlite.prepare("INSERT INTO loyalty_point_logs (id, customer_id, order_id, points_change, reason, balance_after, tenant_id) VALUES ('ptl_ord_ord_paid', 'cust_v', 'ord_paid', 100, 'order_accrual', 100, 'default')").run();
    sqlite.prepare("INSERT INTO loyalty_rewards (id, name, points_cost, reward_type, reward_value, is_active) VALUES ('rw_1', 'Giảm 20k', 100, 'discount_fixed', 20000, 1)").run();
    sqlite.prepare("INSERT INTO loyalty_redemptions (id, customer_id, reward_id, points_spent, voucher_code, status, created_at) VALUES ('red_1', 'cust_v', 'rw_1', 100, 'VCH_FARM', 'active', '2099-01-01T00:00:00.000Z')").run();

    await reverseAccrual(db, policy, { orderId: 'ord_paid', customerId: 'cust_v', refundAmountVnd: 100000, reason: 'refund', tenantId: 'default' });
    await reverseAccrual(db, policy, { orderId: 'ord_paid', customerId: 'cust_v', refundAmountVnd: 100000, reason: 'refund', tenantId: 'default' });
    expect(sqlite.prepare("SELECT status FROM loyalty_redemptions WHERE id = 'red_1'").get()).toEqual({ status: 'revoked' });
    expect(sqlite.prepare("SELECT COUNT(*) AS cnt FROM loyalty_point_logs WHERE id = 'ptl_rev_ord_paid'").get()).toEqual({ cnt: 1 });
  });

  it('enforces guest order_token BOLA, atomic OTP lockout, KDS unpaid hold, COD cashier gate, BOM waste, ICT stats & e-invoice lock', async () => {
    const { sqlite, db } = createCanonicalD1();
    const rawToken = 'guest_secret_capability_token_01';
    const tokenHash = await hashOrderToken(rawToken);
    const guestOrder = { id: 'ord_g1', customer_id: null, guest_token_hash: tokenHash };
    expect(canAccessOrder(null, guestOrder).allowed).toBe(false);
    expect(canAccessOrder(null, guestOrder, { orderTokenVerified: await verifyGuestOrderToken(tokenHash, 'wrong') }).allowed).toBe(false);
    expect(canAccessOrder(null, guestOrder, { orderTokenVerified: await verifyGuestOrderToken(tokenHash, rawToken) }).allowed).toBe(true);

    await persistOtpChallenge(db, 'otp_challenge:default:0988777666', 'default', '0988777666', '123456', 300);
    for (let i = 0; i < 5; i++) await recordOtpFailedAttempt(db, 'otp_challenge:default:0988777666');
    expect(await consumeOtpChallenge(db, 'otp_challenge:default:0988777666', '123456')).toBe('locked');

    sqlite.prepare("INSERT INTO orders (id, items, customer_name, customer_phone, status, payment_method, payment_status, total, is_cod, tenant_id, created_at) VALUES ('ord_unp', '[]', 'A', '0900000001', 'pending', 'payos', 'unpaid', 30000, 0, 'default', '2026-11-15T17:30:00.000Z'), ('ord_cod', '[]', 'B', '0900000002', 'preparing', 'cod', 'unpaid', 45000, 1, 'default', '2026-11-15T17:30:00.000Z')").run();
    const kdsApp = new Hono<{ Bindings: Env }>();
    kdsApp.use('*', async (c, next) => { c.set('user' as never, { id: 'u_k', role: 'kitchen', tenant_id: 'default' } as never); await next(); });
    kdsApp.get('/kds', handleGetKdsOrders);
    const kdsRes = await kdsApp.request('/kds', {}, { AURA_DB: db } as any);
    const kdsBody = (await kdsRes.json()) as { data: Array<{ id: string }> };
    expect(kdsBody.data.map((o) => o.id)).toEqual(['ord_cod']);

    const jwtSecret = 'test_jwt_secret_at_least_32_bytes_long_012345';
    const authTime = Math.floor(Date.now() / 1000);
    sqlite.prepare("INSERT INTO users (id, name, phone, role, is_active, auth_version, tenant_id) VALUES ('u_k', 'Bếp', '0900111222', 'kitchen', 1, 1, 'default'), ('u_c', 'Thu ngân', '0900111333', 'cashier', 1, 1, 'default')").run();
    const kitchenJwt = await generateJWT({ id: 'u_k', email: 'k@aura.vn', name: 'Bếp', role: 'kitchen', tenantId: 'default', authVersion: 1, authTime, sessionType: 'staff-web' } as any, jwtSecret, 3600);
    const cashierJwt = await generateJWT({ id: 'u_c', email: 'c@aura.vn', name: 'Thu ngân', role: 'cashier', tenantId: 'default', authVersion: 1, authTime, sessionType: 'staff-web' } as any, jwtSecret, 3600);
    const codApp = new Hono<{ Bindings: Env }>();
    registerKdsHandlers(codApp);
    const kCod = await codApp.request('/ord_cod/mark-cod-paid', { method: 'PATCH', headers: { Authorization: `Bearer ${kitchenJwt}` } }, { AURA_DB: db, JWT_SECRET: jwtSecret } as any);
    expect(kCod.status).toBe(403);
    const cCod = await codApp.request('/ord_cod/mark-cod-paid', { method: 'PATCH', headers: { Authorization: `Bearer ${cashierJwt}` } }, { AURA_DB: db, JWT_SECRET: jwtSecret } as any);
    expect(cCod.status).toBe(200);
    expect((await collectCodPayment(db, 'ord_cod', 'default', 'u_c')).idempotent).toBe(true);

    sqlite.prepare("INSERT INTO inventory_items (id, sku, name, category, unit, current_stock, tenant_id) VALUES ('inv_milk', 'MLK', 'Sữa tươi', 'dairy', 'ml', 800, 'default')").run();
    sqlite.prepare("INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, tenant_id) VALUES ('tx_r1', 'inv_milk', 'reserve', -200, 'ord_cod', 'order', 'default')").run();
    await restoreInventoryForOrder({ AURA_DB: db as any }, 'ord_cod', 'default', 'preparing');
    expect(sqlite.prepare("SELECT current_stock FROM inventory_items WHERE id = 'inv_milk'").get()).toEqual({ current_stock: 800 });
    expect(sqlite.prepare("SELECT type FROM inventory_transactions WHERE reference_id = 'ord_cod' AND type = 'waste'").get()).toEqual({ type: 'waste' });

    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-16T01:00:00+07:00').getTime());
    const ictStats = await (await getStats(new Request('https://api.aura.vn/api/orders/stats'), { AURA_DB: db }, 'default')).json() as { stats: { orders_today: number } };
    expect(ictStats.stats.orders_today).toBe(2);

    sqlite.prepare("INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, sync_status, tenant_id) VALUES ('em_1', 'sales_invoice', 'ord_cod', 'SINV-001', 'synced', 'default')").run();
    expect(await hasIssuedEInvoice(db, 'ord_cod')).toBe(true);
  });

  it('enforces marketing consent filtering, ledger-safe PII erasure, logger redaction & authenticated WS channels', async () => {
    const { sqlite, db, kv, kvStore } = createCanonicalD1();
    sqlite.prepare("INSERT INTO customers (id, name, phone, email, total_spent, total_orders, auth_version, tenant_id) VALUES ('c_optin', 'Minh', '0905111222', 'minh@test.vn', 120000, 2, 1, 'default'), ('c_noopt', 'Hoa', '0905333444', 'hoa@test.vn', 80000, 1, 1, 'default')").run();
    sqlite.prepare("INSERT INTO consents (id, customer_id, purpose, channel, granted, policy_version, source, granted_at, tenant_id) VALUES ('cs_1', 'c_optin', 'marketing', 'email', 1, '2026-05-01', 'app', '2026-11-15T00:00:00.000Z', 'default')").run();
    sqlite.prepare("INSERT INTO orders (id, items, payment_method, customer_id, customer_name, customer_phone, customer_email, customer_address, total, status, payment_status, tenant_id) VALUES ('ord_p1', '[]', 'payos', 'c_optin', 'Minh', '0905111222', 'minh@test.vn', '29 Nguyễn Tất Thành', 120000, 'completed', 'paid', 'default')").run();
    await kv.put('otp_verified_phone:default:0905111222', '1');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    const bcastApp = new Hono<{ Bindings: Env }>();
    bcastApp.use('*', async (c, next) => { c.set('user' as never, { id: 'adm_1', role: 'owner', tenant_id: 'default' } as never); await next(); });
    registerSendHandler(bcastApp);
    const bcastRes = await bcastApp.request('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segment: 'all', channel: 'email', title: 'Ưu đãi', message: 'Chào bạn' }) }, { AURA_DB: db, SENDGRID_API_KEY: 'SG.mock' } as any);
    const bcastJson = (await bcastRes.json()) as { total?: number; sent_count?: number };
    expect(bcastJson.total).toBe(1);

    const erased = await eraseCustomerPii(db, { customerId: 'c_optin', actorId: 'c_optin', actorRole: 'customer', tenantId: 'default', kv });
    expect(erased.ok).toBe(true);
    expect(kvStore.has('otp_verified_phone:default:0905111222')).toBe(false);
    const custAfter = sqlite.prepare("SELECT name, phone, email, total_spent, auth_version FROM customers WHERE id = 'c_optin'").get() as Record<string, unknown>;
    expect(custAfter).toMatchObject({ name: '[ERASED]', email: null, total_spent: 120000, auth_version: 2 });
    expect(String(custAfter.phone)).toMatch(/^erased_/);
    const ordAfter = sqlite.prepare("SELECT customer_name, customer_phone, customer_address, total FROM orders WHERE id = 'ord_p1'").get();
    expect(ordAfter).toEqual({ customer_name: '[ERASED]', customer_phone: erased.erasedToken, customer_address: null, total: 120000 });

    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((msg: string) => { logged.push(String(msg)); });
    createLogger({ route: 'test' }).info('checkout', { phone: '+84905111222', customer_name: 'Minh', delivery_address: '29 NTT', url: 'https://aura.vn/ws?order_token=sec_123&token=jwt_456' });
    expect(logged[0]).not.toContain('905111222');
    expect(logged[0]).not.toContain('sec_123');
    expect(logged[0]).not.toContain('jwt_456');

    const wsApp = new Hono<{ Bindings: Env }>();
    wsApp.get('/realtime/:channelId', handleRealtimeChannel);
    const unauthWs = await wsApp.request('/realtime/orders', { headers: { Upgrade: 'websocket' } }, {
      AURA_DB: db, JWT_SECRET: 'test_jwt_secret_at_least_32_bytes_long_012345',
      ORDER_BROADCASTER: { idFromName: () => 'id', get: () => ({ fetch: async () => new Response() }) },
    } as any);
    expect([401, 403]).toContain(unauthWs.status);
  });
});
