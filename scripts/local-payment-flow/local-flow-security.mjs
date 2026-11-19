import { createOrder, http, sign } from './local-flow-api.mjs';
import { runOperationalParityChecks } from './local-flow-operational-parity.mjs';

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
    const signed = await createOrder(runtime, 'cod', 'Signed tenant A checkout', {
      items: [{ product_id: 'review-coffee-a', id: 'review-coffee-a', name: 'Cà phê kiểm thử cafe-a', quantity: 1, price: 20000 }],
    }, tokens['staff-a']);
    check('tenant-signed-creation', signed.response.status === 201 && signed.row?.tenant_id === 'cafe-a', 'derive cafe-a from signed staff session',
      { status: signed.response.status, tenant: signed.row?.tenant_id });
    const crossCatalog = await createOrder(runtime, 'cod', 'Cross-tenant catalog reject', {}, tokens['staff-a']);
    check('tenant-cross-catalog-reject', !crossCatalog.row && crossCatalog.response.status === 400, 'tenant A cannot order default-tenant product',
      { status: crossCatalog.response.status, error: crossCatalog.response.body?.error });
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

  await guarded('paid-cancel-and-einvoice-guards', async () => {
    const rawPaidCancel = await http(runtime, `/api/orders/${payos.id}/status`, {
      method: 'PATCH', token: tokens['cashier-default'], body: { status: 'cancelled' },
    });
    const stillPaid = await db.prepare('SELECT status,payment_status FROM orders WHERE id = ?').bind(payos.id).first();
    check('paid-order-blocks-raw-cancel', [403, 409].includes(rawPaidCancel.status) && stillPaid?.status !== 'cancelled',
      'paid order rejects uncompensated status cancel', { status: rawPaidCancel.status, order: stillPaid });

    const unpaidPayos = await createOrder(runtime, 'payos', 'Unpaid KDS hold check');
    const kdsQueue = await http(runtime, '/api/kds/orders', { token: tokens['staff-default'] });
    const kdsIds = (kdsQueue.body.data || []).map(order => order.id);
    check('kds-holds-unpaid-payos', kdsQueue.status === 200 && Boolean(unpaidPayos.id) && !kdsIds.includes(unpaidPayos.id),
      'unpaid PayOS order excluded from KDS queue', { unpaidOrderId: unpaidPayos.id, kdsCount: kdsIds.length });

    const guestOrderToken = unpaidPayos.response.body.data?.order_token || unpaidPayos.response.body.order_token;
    const unauthDetail = await http(runtime, `/api/orders/${unpaidPayos.id}`);
    const tokenDetail = guestOrderToken
      ? await http(runtime, `/api/orders/${unpaidPayos.id}?order_token=${encodeURIComponent(guestOrderToken)}`)
      : { status: 0 };
    check('guest-order-token-bola-guard', Boolean(guestOrderToken) && [401, 403, 404].includes(unauthDetail.status) && tokenDetail.status === 200,
      'anonymous order detail blocked without order_token and allowed with valid capability token',
      { unauthStatus: unauthDetail.status, hasToken: Boolean(guestOrderToken), tokenStatus: tokenDetail.status });

    await db.prepare(
      "INSERT OR REPLACE INTO erpnext_mappings (id, local_type, local_id, erpnext_id, sync_status, tenant_id) VALUES (?, 'sales_invoice', ?, 'SINV-LOCAL-001', 'synced', 'default')"
    ).bind(`map_${unpaidPayos.id}`, unpaidPayos.id).run();
    const einvoiceCancel = await http(runtime, `/api/orders/${unpaidPayos.id}/cancel`, {
      method: 'POST', token: tokens['staff-default'], body: { reason: 'attempted void after invoice' },
    });
    check('einvoice-blocks-order-cancel', einvoiceCancel.status === 409,
      'issued e-invoice blocks order cancellation with 409', { status: einvoiceCancel.status, body: einvoiceCancel.body });

    const anonTrack = await http(runtime, `/api/orders/${unpaidPayos.id}/track`);
    const forgedTrack = await http(runtime, `/api/orders/${unpaidPayos.id}/track?order_token=forged-capability-token`);
    const validTrack = guestOrderToken
      ? await http(runtime, `/api/orders/${unpaidPayos.id}/track?order_token=${encodeURIComponent(guestOrderToken)}`)
      : { status: 0 };
    check('track-forged-order-token-guard',
      anonTrack.status === 200 && forgedTrack.status === 403 && validTrack.status === 200,
      'anonymous shareable track returns 200 while forged token returns 403 and valid token returns 200',
      { anonStatus: anonTrack.status, forgedStatus: forgedTrack.status, validStatus: validTrack.status });
  });

  await guarded('split-bill-kds-and-cod-realtime', async () => {
    await db.prepare(
      "INSERT OR IGNORE INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES ('tbl_split_local', 'T-SPLIT-LOCAL', 'Indoor', 4, 'Available', 'default')"
    ).run();
    const splitRes = await fetch(`${runtime.url}/api/orders/split`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': `idem-split-${Date.now()}`,
        Connection: 'close',
      },
      body: JSON.stringify({
        table_id: 'T-SPLIT-LOCAL',
        orders: [
          {
            customer_name: 'Split Guest A',
            customer_phone: '0901112221',
            payment_method: 'cod',
            items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }],
          },
          {
            customer_name: 'Split Guest B',
            customer_phone: '0901112222',
            payment_method: 'cod',
            items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }],
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const splitBody = await splitRes.json().catch(() => ({}));
    const tokenMap = splitBody?.order_tokens || {};
    const splitIds = Object.keys(tokenMap);
    const firstSplitId = splitIds[0];
    const firstSplitToken = firstSplitId ? tokenMap[firstSplitId] : '';
    const splitUnauth = firstSplitId ? await http(runtime, `/api/orders/${firstSplitId}`) : { status: 0 };
    const splitWithToken = firstSplitId && firstSplitToken
      ? await http(runtime, `/api/orders/${firstSplitId}?order_token=${encodeURIComponent(firstSplitToken)}`)
      : { status: 0 };
    check('split-bill-guest-token-minting',
      splitRes.status === 201 && splitIds.length === 2 && [401, 403, 404].includes(splitUnauth.status) && splitWithToken.status === 200,
      'split bill mints per-child capability tokens and enforces them on order detail',
      { status: splitRes.status, tokenCount: splitIds.length, unauth: splitUnauth.status, withToken: splitWithToken.status });

    await seed('ORD_KITCHEN_HANDOFF', 'default', 'ready');
    const kitchenServed = await http(runtime, '/api/orders/ORD_KITCHEN_HANDOFF/status', {
      method: 'PATCH', token: tokens['kitchen-default'], body: { status: 'served' },
    });
    const kitchenCompleted = await http(runtime, '/api/orders/ORD_KITCHEN_HANDOFF/status', {
      method: 'PATCH', token: tokens['kitchen-default'], body: { status: 'completed' },
    });
    const handoffRow = await db.prepare('SELECT status FROM orders WHERE id = ?').bind('ORD_KITCHEN_HANDOFF').first();
    check('kitchen-ready-to-served-handoff',
      kitchenServed.status === 200 && kitchenCompleted.status === 403 && handoffRow?.status === 'served',
      'kitchen role transitions ready to served (200) and blocks served to completed (403)',
      { servedStatus: kitchenServed.status, completedStatus: kitchenCompleted.status, dbStatus: handoffRow?.status });

    await db.prepare(
      "INSERT INTO orders (id,items,total,status,customer_name,customer_phone,payment_method,payment_status,notes,tenant_id) VALUES ('ORD_QR_PLACEHOLDER','[]',0,'pending','QR Guest','0902223333','cod','unpaid','Khách QR - cho don mon','default')"
    ).run();
    const kdsAfterCheckin = await http(runtime, '/api/kds/orders', { token: tokens['staff-default'] });
    const kdsAfterIds = (kdsAfterCheckin.body.data || []).map(order => order.id);
    check('kds-holds-checkin-placeholder',
      kdsAfterCheckin.status === 200 && !kdsAfterIds.includes('ORD_QR_PLACEHOLDER'),
      'standalone QR check-in empty placeholder excluded from KDS queue',
      { kdsStatus: kdsAfterCheckin.status, leaked: kdsAfterIds.includes('ORD_QR_PLACEHOLDER') });

    await seed('ORD_COD_RT_CHECK', 'default', 'served');
    const codMarkPaid = await http(runtime, '/api/orders/ORD_COD_RT_CHECK/mark-cod-paid', {
      method: 'PATCH', token: tokens['cashier-default'],
    });
    const codRow = await db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind('ORD_COD_RT_CHECK').first();
    check('cod-settlement-realtime-event',
      codMarkPaid.status === 200 && codRow?.payment_status === 'paid',
      'cashier COD collection settles order payment_status to paid cleanly',
      { status: codMarkPaid.status, paymentStatus: codRow?.payment_status });
  });

  await runOperationalParityChecks(runtime, context, check);
}
