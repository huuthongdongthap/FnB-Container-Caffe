import { createHmac } from 'node:crypto';
import { CHECKSUM, REVIEW_PASSWORD } from './local-runtime.mjs';

export const orderInput = (method, name, extra = {}) => ({
  customer_name: name, customer_phone: '0900000010', payment_method: method,
  items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }],
  total: 20000, order_type: 'takeaway', ...extra,
});

export function sign(data) {
  const canonical = Object.keys(data).sort().map(key => `${key}=${data[key] ?? ''}`).join('&');
  return createHmac('sha256', CHECKSUM).update(canonical).digest('hex');
}

export async function http(runtime, pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${runtime.url}${pathname}`, {
    method, headers: { 'content-type': 'application/json', Connection: 'close', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  const text = await response.text(); let json;
  try { json = JSON.parse(text); } catch { json = { text }; }
  return { status: response.status, body: json };
}

export async function createOrder(runtime, method, name, extra = {}, token) {
  const response = await http(runtime, '/api/orders', { method: 'POST', body: orderInput(method, name, extra), token });
  const row = await runtime.db.prepare('SELECT * FROM orders WHERE customer_name = ? ORDER BY created_at DESC LIMIT 1').bind(name).first();
  return { response, row, id: response.body.data?.id || row?.id };
}

export async function runApiFlow(runtime, check) {
  const tokens = {};
  for (const identity of ['staff-default', 'cashier-default', 'kitchen-default', 'staff-a', 'cashier-a']) {
    const login = await http(runtime, '/api/auth/login', { method: 'POST', body: {
      email: `${identity}@local-review.test`, password: REVIEW_PASSWORD,
    } });
    check(`login:${identity}`, login.status === 200 && Boolean(login.body.token), '200 + signed token', { status: login.status, role: login.body.user?.role });
    tokens[identity] = login.body.token;
  }
  const anonymous = await http(runtime, '/api/kds/orders');
  check('kds-anonymous', anonymous.status === 401, 401, anonymous.status);
  const unauthCod = await http(runtime, '/api/orders/ORD_UNKNOWN/mark-cod-paid', { method: 'PATCH' });
  check('cod-anonymous', unauthCod.status === 401, 401, unauthCod.status);

  const payos = await createOrder(runtime, 'payos', 'Local PayOS flow');
  const cod = await createOrder(runtime, 'cod', 'Local COD flow');
  for (const [method, order] of [['payos', payos], ['cod', cod]]) {
    check(`create:${method}`, order.response.status === 201 && order.row?.total === 20000 && order.row?.payment_status === 'unpaid',
      '201, server total 20000, unpaid', { status: order.response.status, total: order.row?.total, payment: order.row?.payment_status, body: order.response.body.error });
  }
  if (!payos.id || !cod.id) throw new Error('Order rows unavailable for downstream checks');

  const unsupported = [];
  for (const method of ['momo', 'apple_pay', 'google_pay']) {
    const result = await http(runtime, '/api/orders', { method: 'POST', body: orderInput(method, `Unsupported ${method}`) });
    unsupported.push({ method, status: result.status });
  }
  check('unsupported-methods', unsupported.every(result => result.status === 400), 'all 400', unsupported);
  const removedRoutes = [];
  for (const pathname of ['/api/payment/momo/create', '/api/webhook/momo', '/api/payments/payment-request']) {
    const result = await http(runtime, pathname, { method: 'POST', body: {}, token: tokens['staff-default'] });
    removedRoutes.push({ pathname, status: result.status });
  }
  check('retired-routes', removedRoutes.every(result => result.status === 404), 'all 404', removedRoutes);

  const tamperedLink = await http(runtime, '/api/payment/create-link', { method: 'POST', body: { order_id: payos.id, amount: 1 } });
  check('payos-rejects-tampered-amount', tamperedLink.status === 400, 400, tamperedLink.status);
  const codLink = await http(runtime, '/api/payment/create-link', { method: 'POST', body: { order_id: cod.id, amount: 20000 } });
  check('payos-rejects-cod', codLink.status === 409, 409, codLink.status);
  const payosLink = await http(runtime, '/api/payment/create-link', { method: 'POST', body: { order_id: payos.id } });
  const payment = await runtime.db.prepare('SELECT * FROM payments WHERE order_id = ?').bind(payos.id).first();
  check('payos-server-amount', payosLink.status === 200 && payment?.amount === 20000 && runtime.providerRequests.some(r => r.kind === 'create' && r.amount === 20000),
    'link200, persisted/provider amount20000', { status: payosLink.status, amount: payment?.amount });
  if (!payment?.transaction_id) throw new Error('PayOS transaction unavailable');
  const data = { orderCode: Number(payment.transaction_id), amount: 20000, description: 'local-review', code: '00' };
  const webhook = { code: '00', desc: 'success', success: true, data, signature: sign(data) };
  const invalid = await http(runtime, '/api/webhook/payos', { method: 'POST', body: { ...webhook, signature: 'invalid' } });
  check('webhook-invalid-signature', invalid.status === 401, 401, invalid.status);
  const zeroData = { ...data, amount: 0 };
  const zero = await http(runtime, '/api/webhook/payos', { method: 'POST', body: { ...webhook, data: zeroData, signature: sign(zeroData) } });
  check('webhook-zero-amount', zero.status === 400, 400, zero.status);
  const valid = await http(runtime, '/api/webhook/payos', { method: 'POST', body: webhook });
  const replay = await http(runtime, '/api/webhook/payos', { method: 'POST', body: webhook });
  const paidOrder = await runtime.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(payos.id).first();
  const paidPayment = await runtime.db.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first();
  check('webhook-paid-idempotent', valid.status === 200 && replay.status === 200 && paidOrder?.payment_status === 'paid' && paidPayment?.status === 'completed',
    'both200 + order paid/payment completed', { first: valid.status, replay: replay.status, order: paidOrder, payment: paidPayment });

  const track = await http(runtime, `/api/orders/${payos.id}/track`);
  check('guest-track-items', track.status === 200 && track.body.data?.items?.length > 0, '200 with order items', { status: track.status, items: track.body.data?.items });
  await runtime.db.prepare("UPDATE orders SET status = 'preparing' WHERE id = ?").bind(cod.id).run();
  const queue = await http(runtime, '/api/kds/orders', { token: tokens['staff-default'] });
  const queueIds = (queue.body.data || []).map(order => order.id);
  check('staff-queue-paid-and-cod', queue.status === 200 && queueIds.includes(payos.id) && queueIds.includes(cod.id), '200 with both orders', { status: queue.status, ids: queueIds });
  const cashierQueue = await http(runtime, '/api/kds/orders', { token: tokens['cashier-default'] });
  check('cashier-queue', cashierQueue.status === 200, '200 (router grants cashier KDS access)', cashierQueue.status);

  const controller = new AbortController();
  const stream = await fetch(`${runtime.url}/api/kds/orders/stream`, { signal: controller.signal, headers: { Authorization: `Bearer ${tokens['staff-default']}` } });
  const reader = stream.body.getReader();
  const frame = new TextDecoder().decode((await reader.read()).value);
  controller.abort(); await reader.cancel().catch(() => {});
  check('staff-sse-snapshot', stream.status === 200 && frame.includes('snapshot') && frame.includes(payos.id), '200 with authenticated snapshot/order', { status: stream.status, frame: frame.slice(0, 250) });

  const kitchenCollection = await http(runtime, `/api/orders/${cod.id}/mark-cod-paid`, { method: 'PATCH', token: tokens['kitchen-default'] });
  const otherTenantCollection = await http(runtime, `/api/orders/${cod.id}/mark-cod-paid`, { method: 'PATCH', token: tokens['cashier-a'] });
  check('cod-role-and-tenant', kitchenCollection.status === 403 && otherTenantCollection.status === 404, 'kitchen403, other tenant404', { kitchen: kitchenCollection.status, tenant: otherTenantCollection.status });
  const collected = await http(runtime, `/api/orders/${cod.id}/mark-cod-paid`, { method: 'PATCH', token: tokens['cashier-default'] });
  const codAfter = await runtime.db.prepare('SELECT status,payment_status FROM orders WHERE id = ?').bind(cod.id).first();
  check('cod-staff-payment', collected.status === 200 && codAfter?.payment_status === 'paid', '200 and paid', { status: collected.status, order: codAfter });
  check('cod-preserves-kitchen-state', codAfter?.status === 'preparing', 'still preparing until kitchen completes', codAfter);
  return { tokens, payos, cod, payment };
}
