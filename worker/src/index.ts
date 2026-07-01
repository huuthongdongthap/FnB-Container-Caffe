/**
 * F&B Caffe Container — Cloudflare Worker
 * Unified Hono router — all routes mounted here
 * Converted from index.js to TypeScript.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createLogger } from './middleware/logger';
import { errorHandler } from './middleware/error-handler';
import type { Env } from './types/env';
import type { MiddlewareHandler } from 'hono';

const log = createLogger({ route: 'index' });

// Route modules — converted
import { getMenu, getMenuItem } from './routes/menu';
import {
  createOrder, getOrder, updateOrder, getAdminOrders, getStats,
  getLatestOrderTimestamp, notifyTelegram,
} from './routes/orders';
import {
  registerUser, loginUser, logoutUser, getCurrentUser, registerStaff, listStaff,
  bootstrapOwner, resetPassword, changePassword,
} from './routes/auth';
import { requireAuth } from './middleware/auth';
import { audit } from './middleware/audit-log';
import { paymentRouter } from './routes/payments';
import { webhookRouter } from './routes/webhooks';
import { reservationsRouter } from './routes/reservations';
import { loyaltyRouter } from './routes/loyalty';
import { referralRouter } from './routes/referrals';
import { contactRouter } from './routes/contact';

// Unconverted routes (imported as .js — will resolve to .ts when converted)
import { tablesRouter } from './routes/tables.js';
import { reviewsRouter } from './routes/reviews.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { customersRouter, getAdminCustomers } from './routes/customers.js';
import { ordersRouter as ordersHonoRouter } from './routes/orders-hono.js';
import { promotionsRouter } from './routes/promotions.js';
import { shiftsRouter } from './routes/shifts.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { adminLoyaltyRouter } from './routes/admin-loyalty.js';
import { birthdayRouter } from './routes/birthday.js';
import { checkinRouter } from './routes/checkin.js';
import { reportsRouter } from './routes/reports.js';

// Read-only routes (imported as .js — owned by other phases)
import {
  checkOverdueOrders, sendCashbackExpiryWarnings,
  processErpnextRetryQueue, processErpnextProductSync,
  syncMauticContacts, detectWinbackCandidates, detectBirthdayCandidates,
} from './routes/cron';
import { sendZNS } from './routes/zalo.js';
import { signageRouter } from './routes/signage.js';
import { mixpostRouter, autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights } from './routes/mixpost.js';
import { pretixRouter } from './routes/pretix.js';
import { handleCalBookingWebhook } from './routes/cal-booking-webhook.js';

// ── ERPNext Integration (Phase 2 migration, owned by 260630-1948) ──
import { createErpnextLead, getErpnextCustomerNotes, addErpnextCustomerTag } from './routes/erpnext.js';
import { createErpnextSalesOrder, getErpnextProductAvailability, syncErpnextProducts, handleErpnextProductWebhook } from './routes/erpnext-pos.js';
import { createErpnextInvoice, getErpnextInvoiceStatus, retryErpnextInvoice, getErpnextSyncFailures } from './routes/erpnext-invoices.js';

const app = new Hono<{ Bindings: Env }>();

// ── CORS allowlist ──
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/(www\.)?auraspace\.cafe$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use('/*', cors({
  origin: (origin: string) => {
    if (!origin) { return ''; }
    return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Reset-Key'],
  credentials: true,
  maxAge: 86400,
} as Parameters<typeof cors>[0]));

// ── Global error handler ──
app.onError(errorHandler);

// ── Menu ──
app.get('/api/menu', (c) => getMenu(c.req.raw, c.env));
app.get('/api/menu/:id', (c) => getMenuItem(c.req.raw, c.env, c.req.param('id')));

// ── Orders (checkout flow) ──
const orderRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost') {
    await next();
    return;
  }
  const key = `rate:order:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 5) { return c.json({ ok: false, error: 'Quá nhiều đơn hàng. Vui lòng thử lại sau 10 phút.' }, 429); }
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 600 });
  await next();
}

app.post('/api/orders', orderRateLimit, (c) => createOrder(c.req.raw, c.env, c.executionCtx));
app.get('/api/orders/latest', (c) => getLatestOrderTimestamp(c.req.raw, c.env));
app.get('/api/orders/:id', (c) => getOrder(c.req.raw, c.env, c.req.param('id')));
app.patch('/api/orders/:id', requireAuth(['owner', 'staff']), (c) => updateOrder(c.req.raw, c.env, c.req.param('id')));

// ── Orders KDS ──
app.use('/api/kds/orders/*', requireAuth(['owner', 'staff']));
app.route('/api/kds/orders', ordersHonoRouter);

// ── Admin (protected) ──
app.use('/api/admin/*', requireAuth(['owner', 'staff']));
app.get('/api/admin/orders', (c) => getAdminOrders(c.req.raw, c.env));
app.get('/api/admin/customers', (c) => getAdminCustomers(c.req.raw, c.env));
app.get('/api/admin/payments/stuck', requireAuth(['owner']), async (c) => {
  const kv = c.env.AUTH_KV;
  if (!kv) return c.json({ stuck: [], dlq: [], total: 0 });

  const stuckList = await kv.list({ prefix: 'payment:stuck:' });
  const dlqList = await kv.list({ prefix: 'webhook:dlq:' });

  const stuck = await Promise.all(
    stuckList.keys.slice(0, 20).map(async (k) => {
      const raw = await kv.get(k.name);
      return raw ? JSON.parse(raw) : null;
    })
  );

  const dlq = await Promise.all(
    dlqList.keys.slice(0, 20).map(async (k) => {
      const raw = await kv.get(k.name);
      return raw ? { key: k.name, ...JSON.parse(raw) } : null;
    })
  );

  return c.json({
    stuck: stuck.filter(Boolean).map((s: Record<string, unknown>) => ({ ...s, amount: '***' })),
    dlq: dlq.filter(Boolean),
    total: stuckList.keys.length + dlqList.keys.length,
  });
});
app.use('/api/stats', requireAuth(['owner', 'staff']));
app.get('/api/stats', (c) => getStats(c.req.raw, c.env));

// ── Auth ──
const authRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const key = `rate:auth:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 20) { return c.json({ ok: false, error: 'Too many requests. Try again in 5 minutes.' }, 429); }
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 300 });
  await next();
}

app.post('/api/auth/register', authRateLimit, (c) => registerUser(c.req.raw, c.env));
app.post('/api/auth/login', authRateLimit, (c) => loginUser(c.req.raw, c.env));
app.post('/api/auth/logout', (c) => logoutUser(c.req.raw, c.env));
app.get('/api/auth/me', (c) => getCurrentUser(c.req.raw, c.env));
app.post('/api/auth/register-staff', requireAuth(['owner']), audit('register_staff'), (c) => registerStaff(c.req.raw, c.env));
app.get('/api/auth/staff', requireAuth(['owner']), audit('list_staff'), (c) => listStaff(c.req.raw, c.env));
app.post('/api/auth/bootstrap-owner', (c) => bootstrapOwner(c.req.raw, c.env));
app.post('/api/auth/reset-password', authRateLimit, (c) => resetPassword(c.req.raw, c.env));
app.post('/api/auth/change-password', authRateLimit, (c) => changePassword(c.req.raw, c.env));

// ── Sub-routers ──
app.route('/api/payment', paymentRouter);
app.route('/api/webhook', webhookRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/products', productsRouter);
app.route('/api/tables', tablesRouter);
app.route('/api/reservations', reservationsRouter);
app.route('/api/customers', customersRouter);
app.route('/api/promotions', promotionsRouter);
app.route('/api/signage', signageRouter);
app.route('/api/mixpost', mixpostRouter);
app.route('/api/pretix', pretixRouter);
app.route('/api/shifts', shiftsRouter);
app.route('/api/subscriptions', subscriptionsRouter);

// ── Manual dispatcher wrappers ──
app.all('/api/reviews/*', (c) => reviewsRouter.fetch(new Request(c.req.raw.url.replace('/api/reviews', ''), c.req.raw), c.env));
app.all('/api/contact/*', (c) => contactRouter.fetch(c.req.raw, c.env));
app.route('/api/loyalty/referral', referralRouter);
app.route('/api/loyalty/birthday', birthdayRouter);
app.route('/api/loyalty/checkin', checkinRouter);
app.route('/api/loyalty', loyaltyRouter);
app.route('/api/admin/loyalty', adminLoyaltyRouter);
app.use('/api/reports/*', requireAuth(['owner', 'staff']));
app.route('/api/reports', reportsRouter);

// ── Health check ──
app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Dev: Simulate PayOS webhook + Telegram (owner-only) ──
app.post('/api/test/telegram-sim', requireAuth(['owner']), audit('test_telegram_sim'), async (c) => {
  try {
    const body = await c.req.json() as { order_id?: string };
    const { order_id } = body;
    if (!order_id) { return c.json({ error: 'Missing order_id' }, 400); }
    const order = await c.env.AURA_DB.prepare('SELECT * FROM orders WHERE id = ?').bind(order_id).first<Record<string, unknown>>();
    if (!order) { return c.json({ error: 'Order not found' }, 404); }
    const parsedItems = JSON.parse((order.items as string) || '[]');
    const tgPromise = notifyTelegram(c.env as unknown as Record<string, unknown>, {
      id: order.id,
      items: parsedItems,
      total: order.total,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      payment_method: order.payment_method,
      notes: order.notes,
    }).catch(e => log.error('Telegram test error:', { message: (e as Error).message }));
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(tgPromise); }
    else { await tgPromise; }
    return c.json({ ok: true, message: 'Telegram sent' });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Admin: Test Zalo ZNS (owner-only) ──
app.post('/api/test/zalo-zns', requireAuth(['owner']), audit('test_zalo_zns'), async (c) => {
  try {
    const { phone, template } = await c.req.json() as { phone?: string; template?: string };
    if (!phone || !template) { return c.json({ error: 'phone and template required' }, 400); }
    const result = await sendZNS(c.env, {
      phone,
      template_key: template,
      data: { name: 'Test Member', member_id: 'AC000001', balance: 50000, amount: 12000, order_id: 'test123', days: 7 },
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Admin: Manual cashback expiry warning run ──
app.post('/api/admin/zalo/send-expiry-warnings', requireAuth(['owner']), audit('send_expiry_warnings'), async (c) => {
  const result = await sendCashbackExpiryWarnings(c.env as unknown as Record<string, unknown>);
  return c.json({ ok: true, ...result });
});

// ── Public: product availability ──
app.get('/api/public/products/:productId/availability', (c) => getErpnextProductAvailability(c.req.raw, c.env, c.req.param('productId')));

// ── ERPNext Integration (owner only) ──
app.use('/api/erpnext/*', requireAuth(['owner']));
app.post('/api/erpnext/invoices', (c) => createErpnextInvoice(c.req.raw, c.env));
app.get('/api/erpnext/invoices/:orderId', (c) => getErpnextInvoiceStatus(c.req.raw, c.env, c.req.param('orderId')));
app.post('/api/erpnext/invoices/:orderId/retry', (c) => retryErpnextInvoice(c.req.raw, c.env, c.req.param('orderId')));
app.get('/api/erpnext/sync-failures', (c) => getErpnextSyncFailures(c.req.raw, c.env));
app.post('/api/erpnext/sales-orders', (c) => createErpnextSalesOrder(c.req.raw, c.env));
app.post('/api/erpnext/products/sync', (c) => syncErpnextProducts(c.req.raw, c.env));
app.post('/api/webhooks/erpnext', requireAuth(['owner']), (c) => handleErpnextProductWebhook(c.req.raw, c.env, c.executionCtx));

// ── Cal.com booking webhook ──
app.post('/api/webhooks/cal-booking', (c) => handleCalBookingWebhook(c.req.raw, c.env));

// ── CRM ──
app.post('/api/erpnext/leads', (c) => createErpnextLead(c.req.raw, c.env));
app.get('/api/erpnext/customers/:customerId/notes', (c) => getErpnextCustomerNotes(c.req.raw, c.env, c.req.param('customerId')));
app.post('/api/erpnext/customers/:customerId/tags', (c) => addErpnextCustomerTag(c.req.raw, c.env, c.req.param('customerId')));

export default app;
export { app };

export const scheduled = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(checkOverdueOrders(env as unknown as Record<string, unknown>));
    ctx.waitUntil(processErpnextRetryQueue(env as unknown as Record<string, unknown>));
    ctx.waitUntil(processErpnextProductSync(env as unknown as Record<string, unknown>));
    ctx.waitUntil((async () => {
      await syncMauticContacts(env as unknown as Record<string, unknown>);
      await Promise.all([
        detectWinbackCandidates(env as unknown as Record<string, unknown>),
        detectBirthdayCandidates(env as unknown as Record<string, unknown>),
      ]);
    })());
    ctx.waitUntil(autoPostDailySpecials(env));
    ctx.waitUntil(autoPostNewPromotions(env));
    ctx.waitUntil(autoPostWeeklyHighlights(env));
    return new Response('ok');
  },
};
