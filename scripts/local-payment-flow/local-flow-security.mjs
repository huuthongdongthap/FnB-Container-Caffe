import { createOrder, http, sign } from './local-flow-api.mjs';

export async function runSecurityChecks(runtime, context, check) {
  const { db } = runtime;
  const { tokens, payment, payos } = context;
  const guarded = async (id, action) => {
    try { await action(); } catch (error) { check(id, false, 'scenario executes', { error: String(error) }); }
  };
  const seed = async (id, tenant, status = 'pending') => db.prepare(
    'INSERT INTO orders (id,items,total,status,customer_name,customer_phone,payment_method,payment_status,tenant_id) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, JSON.stringify([{ product_id: 'review-coffee', name: 'Tenant fixture', quantity: 1, price: 20000 }]),
    20000, status, id, '0900000010', 'cod', 'unpaid', tenant).run();

  await guarded('tenant-list-isolation', async () => {
    await seed('ORD_REVIEW_TENANT_A', 'cafe-a');
    await seed('ORD_REVIEW_TENANT_B', 'cafe-b');
    const response = await http(runtime, '/api/kds/orders', { token: tokens['staff-a'] });
    const ids = (response.body.data || []).map(order => order.id);
    check('tenant-list-isolation', response.status === 200 && ids.includes('ORD_REVIEW_TENANT_A') && !ids.includes('ORD_REVIEW_TENANT_B'),
      'only tenant A orders', { status: response.status, ids });
    const changed = await http(runtime, '/api/orders/ORD_REVIEW_TENANT_B/status', {
      method: 'PATCH', token: tokens['staff-a'], body: { status: 'preparing' },
    });
    const row = await db.prepare('SELECT status FROM orders WHERE id = ?').bind('ORD_REVIEW_TENANT_B').first();
    check('tenant-canonical-status-write', [403, 404].includes(changed.status) && row?.status === 'pending',
      '403/404 and foreign order unchanged', { status: changed.status, row });
    await seed('ORD_REVIEW_ADMIN_ALIAS_B', 'cafe-b');
    const alias = await http(runtime, '/api/admin/orders/ORD_REVIEW_ADMIN_ALIAS_B/status', {
      method: 'PATCH', token: tokens['staff-a'], body: { status: 'ready' },
    });
    const aliasRow = await db.prepare('SELECT status FROM orders WHERE id = ?').bind('ORD_REVIEW_ADMIN_ALIAS_B').first();
    check('tenant-admin-status-write', [403, 404].includes(alias.status) && aliasRow?.status === 'pending',
      '403/404 and foreign order unchanged', { status: alias.status, row: aliasRow });
  });

  await guarded('server-pricing-guard', async () => {
    const response = await http(runtime, '/api/orders/guest-checkout', { method: 'POST', body: {
      customer_name: 'Guest price tamper', customer_phone: '0900000010', payment_method: 'payos', fulfillment_type: 'TAKEAWAY',
      items: [{ product_id: 'review-coffee', name: 'Cà phê kiểm thử local', qty: 1, price: 1000 }],
    } });
    const row = await db.prepare('SELECT id,total FROM orders WHERE customer_name = ?').bind('Guest price tamper').first();
    const link = row?.id ? await http(runtime, '/api/payment/create-link', { method: 'POST', body: { order_id: row.id } }) : null;
    const charged = row?.id ? await db.prepare('SELECT amount FROM payments WHERE order_id = ?').bind(row.id).first() : null;
    check('guest-price-tamper', (!row && response.status === 400) || (response.status === 201 && row?.total === 20000 && link?.status === 200 && charged?.amount === 20000),
      'reject tamper or persist catalog price20000', { status: response.status, row, linkStatus: link?.status, charged });
    const discount = await createOrder(runtime, 'payos', 'Public discount tamper', { discount: 19000, total: 1000 });
    const discountLink = discount.id ? await http(runtime, '/api/payment/create-link', { method: 'POST', body: { order_id: discount.id } }) : null;
    const discountPayment = discount.id ? await db.prepare('SELECT amount FROM payments WHERE order_id = ?').bind(discount.id).first() : null;
    check('public-discount-tamper', (!discount.row && discount.response.status === 400) || (discount.response.status === 201 && discount.row?.total === 20000 && discountLink?.status === 200 && discountPayment?.amount === 20000),
      'reject unauthorized discount or charge20000', { status: discount.response.status, total: discount.row?.total, linkStatus: discountLink?.status, charged: discountPayment });
  });

  await guarded('tenant-creation-binding', async () => {
    const signed = await createOrder(runtime, 'cod', 'Signed tenant A checkout', {}, tokens['staff-a']);
    check('tenant-signed-creation', signed.row?.tenant_id === 'cafe-a', 'derive cafe-a from signed staff session',
      { status: signed.response.status, tenant: signed.row?.tenant_id });
    const injected = await createOrder(runtime, 'cod', 'Client tenant injection', { tenant_id: 'cafe-b' });
    check('tenant-client-injection', (!injected.row && [400, 403].includes(injected.response.status)) || (injected.response.status === 201 && injected.row?.tenant_id === 'default'), 'untrusted guest cannot choose cafe-b',
      { status: injected.response.status, tenant: injected.row?.tenant_id });
  });

  await guarded('payos-concurrent-create', async () => {
    const concurrent = await createOrder(runtime, 'payos', 'Concurrent PayOS links');
    runtime.setProviderDelay(150);
    const links = await Promise.all([1, 2].map(() => http(runtime, '/api/payment/create-link', {
      method: 'POST', body: { order_id: concurrent.id },
    })));
    runtime.setProviderDelay(0);
    const rows = await db.prepare("SELECT transaction_id,payment_url FROM payments WHERE order_id = ? AND status = 'pending'").bind(concurrent.id).all();
    const createCount = runtime.providerRequests.filter(request => request.kind === 'create' && rows.results.some(row => String(row.transaction_id) === String(request.orderCode))).length;
    check('payos-concurrent-create', rows.results.length === 1 && Boolean(rows.results[0].payment_url) && createCount === 1
      && links.some(link => link.status === 200) && links.every(link => [200, 202].includes(link.status)), 'one payable attempt and exactly one provider create; callers succeed or wait',
      { statuses: links.map(link => link.status), paymentRows: rows.results });
  });

  await guarded('webhook-write-recovery', async () => {
    await db.prepare("UPDATE payments SET status = 'pending' WHERE id = ?").bind(payment.id).run();
    await db.prepare("UPDATE orders SET payment_status = 'unpaid' WHERE id = ?").bind(payos.id).run();
    await db.prepare(`CREATE TRIGGER local_review_order_write_failure BEFORE UPDATE OF payment_status ON orders
      WHEN OLD.id = '${payos.id}' BEGIN SELECT RAISE(FAIL, 'local fixture transient order write failure'); END;`).run();
    const data = { orderCode: Number(payment.transaction_id), amount: 20000, description: 'local-review', code: '00' };
    const webhook = { code: '00', desc: 'success', success: true, data, signature: sign(data) };
    const first = await http(runtime, '/api/payments/webhook/payos', { method: 'POST', body: webhook });
    const failedOrder = await db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(payos.id).first();
    const failedPayment = await db.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first();
    check('webhook-atomic-rollback', first.status >= 500 && failedOrder?.payment_status === 'unpaid' && failedPayment?.status === 'pending',
      'injected write failure rolls back BOTH financial records', { status: first.status, order: failedOrder, payment: failedPayment });
    await db.prepare('DROP TRIGGER local_review_order_write_failure').run();
    const replay = await http(runtime, '/api/payments/webhook/payos', { method: 'POST', body: webhook });
    const after = await db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(payos.id).first();
    const paymentAfter = await db.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first();
    check('openapi-webhook-recovery', after.payment_status === 'paid', 'replay repairs order after transient write failure',
      { first: first.status, replay: replay.status, order: after, payment: paymentAfter });
    const primary = await http(runtime, '/api/webhook/payos', { method: 'POST', body: webhook });
    const healed = await db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(payos.id).first();
    check('primary-webhook-recovery', primary.status === 200 && healed.payment_status === 'paid',
      'primary webhook repairs partial state', { status: primary.status, row: healed });
  });

  await guarded('refund-local-schema', async () => {
    const response = await http(runtime, '/api/payments/refund', { method: 'POST', token: tokens['cashier-a'], body: {
      paymentId: payment.id, amount: 20000, reason: 'local-review-only',
    } });
    check('refund-local-schema', [403, 404].includes(response.status) && !runtime.providerRequests.some(request => request.kind === 'refund'),
      'foreign tenant refund rejected before provider, no SQL500',
      { status: response.status, body: response.body, fixtureSchema: 'worker/schema.sql' });
    const before = await db.prepare('SELECT status,refund_status,refund_amount FROM payments WHERE id = ?').bind(payment.id).first();
    const own = await http(runtime, '/api/payments/refund', { method: 'POST', token: tokens['cashier-default'], body: {
      paymentId: payment.id, amount: 20000, reason: 'local-review-only',
    } });
    const after = await db.prepare('SELECT status,refund_status,refund_amount FROM payments WHERE id = ?').bind(payment.id).first();
    check('refund-unsupported-fail-closed', own.status === 422 && JSON.stringify(before) === JSON.stringify(after)
      && !runtime.providerRequests.some(request => request.kind === 'refund'),
      'unsupported automatic refund422 with no financial writes or provider calls', { status: own.status, before, after });
  });
}
