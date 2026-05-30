/**
 * F&B Caffe Container — Cloudflare Worker
 * Unified Hono router — all routes mounted here
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Route modules
import { getMenu, getMenuItem } from './routes/menu.js';
import {
  createOrder,
  getOrder,
  updateOrder,
  getAdminOrders,
  getStats,
  getLatestOrderTimestamp,
  notifyTelegram
} from './routes/orders.js';
import {
  registerUser, loginUser, logoutUser, getCurrentUser, registerStaff, listStaff,
  bootstrapOwner, resetPassword,
} from './routes/auth.js';
import { changePassword } from './routes/change-password.js';
import { requireAuth } from './middleware/admin-auth.js';
import { paymentRouter } from './routes/payment.js';
import { webhookRouter } from './routes/webhooks.js';
import { tablesRouter } from './routes/tables.js';
import { reviewsRouter } from './routes/reviews.js';
import { contactRouter } from './routes/contact.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { adminLoyaltyRouter } from './routes/admin-loyalty.js';
import { referralRouter } from './routes/referrals.js';
import { birthdayRouter } from './routes/birthday.js';
import { checkinRouter } from './routes/checkin.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { reservationsRouter } from './routes/reservations.js';
import { customersRouter } from './routes/customers.js';
import { ordersRouter as ordersHonoRouter } from './routes/orders-hono.js';
import { promotionsRouter } from './routes/promotions.js';
import { shiftsRouter } from './routes/shifts.js';
import { checkOverdueOrders, sendCashbackExpiryWarnings } from './routes/cron.js';
import { sendZNS } from './routes/zalo.js';
import { reportsRouter } from './routes/reports.js';

const app = new Hono();

// ── CORS allowlist (production: main Pages domain, preview: *.pages.dev, dev: localhost) ─
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/(www\.)?auraspace\.cafe$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use('/*', cors({
  origin: (origin) => {
    if (!origin) {return '';}
    return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Reset-Key'],
  credentials: true,
  maxAge: 86400,
}));

// ── Global error handler: never leak HTML to JSON clients ──
app.onError((err, c) => {
  console.error('[Global Error]', err.message, err.stack?.slice(0, 300));
  return c.json({ success: false, error: 'Internal server error', detail: err.message.slice(0, 200) }, 500);
});

// ── Menu ────────────────────────────────────────────────────────────────
app.get('/api/menu', (c) => getMenu(c.req.raw, c.env));
app.get('/api/menu/:id', (c) => getMenuItem(c.req.raw, c.env, c.req.param('id')));

// ── Orders (checkout flow) ──────────────────────────────────────────────
// Rate limit order creation: 5 orders per IP per 10 minutes (prevents KDS spam)
async function orderRateLimit(c, next) {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost') {
    await next();
    return;
  }
  const key = `rate:order:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 5) {return c.json({ ok: false, error: 'Quá nhiều đơn hàng. Vui lòng thử lại sau 10 phút.' }, 429);}
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 600 });
  await next();
}
app.post('/api/orders', orderRateLimit, (c) => createOrder(c.req.raw, c.env));
app.get('/api/orders/latest', (c) => getLatestOrderTimestamp(c.req.raw, c.env));
app.get('/api/orders/:id', (c) => getOrder(c.req.raw, c.env, c.req.param('id')));
app.patch('/api/orders/:id', requireAuth(['owner', 'staff']), (c) => updateOrder(c.req.raw, c.env, c.req.param('id')));

// ── Orders KDS ──────────────────────────────────────────────────────────
app.use('/api/kds/orders/*', requireAuth(['owner', 'staff']));
app.route('/api/kds/orders', ordersHonoRouter);

// ── Admin (protected) ───────────────────────────────────────────────────
app.use('/api/admin/*', requireAuth(['owner', 'staff']));
app.get('/api/admin/orders', (c) => getAdminOrders(c.req.raw, c.env));
app.use('/api/stats', requireAuth(['owner', 'staff']));
app.get('/api/stats', (c) => getStats(c.req.raw, c.env));

// ── Auth ────────────────────────────────────────────────────────────────
// Rate limit brute-force targets: 20 attempts per IP per 5 minutes
async function authRateLimit(c, next) {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const key = `rate:auth:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 20) {return c.json({ ok: false, error: 'Too many requests. Try again in 5 minutes.' }, 429);}
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 300 });
  await next();
}
app.post('/api/auth/register', authRateLimit, (c) => registerUser(c.req.raw, c.env));
app.post('/api/auth/login', authRateLimit, (c) => loginUser(c.req.raw, c.env));
app.post('/api/auth/logout', (c) => logoutUser(c.req.raw, c.env));
app.get('/api/auth/me', (c) => getCurrentUser(c.req.raw, c.env));
app.post('/api/auth/register-staff', requireAuth(['owner']), (c) => registerStaff(c.req.raw, c.env));
app.get('/api/auth/staff', requireAuth(['owner']), (c) => listStaff(c.req.raw, c.env));
app.post('/api/auth/bootstrap-owner', (c) => bootstrapOwner(c.req.raw, c.env));
app.post('/api/auth/reset-password', authRateLimit, (c) => resetPassword(c.req.raw, c.env));
app.post('/api/auth/change-password', authRateLimit, (c) => changePassword(c.req.raw, c.env));

// ── Sub-routers (Hono-native) ───────────────────────────────────────────
app.route('/api/payment', paymentRouter);
app.route('/api/webhook', webhookRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/products', productsRouter);
app.route('/api/tables', tablesRouter);
app.route('/api/reservations', reservationsRouter);
app.route('/api/customers', customersRouter);
app.route('/api/promotions', promotionsRouter);
app.route('/api/shifts', shiftsRouter);

// ── Manual dispatcher wrappers (non-Hono routers) ───────────────────────
app.all('/api/reviews/*', (c) => reviewsRouter.fetch(new Request(c.req.raw.url.replace('/api/reviews', ''), c.req.raw), c.env, c.executionCtx));
app.all('/api/contact/*', (c) => contactRouter.fetch(new Request(c.req.raw.url.replace('/api/contact', ''), c.req.raw), c.env, c.executionCtx));
app.route('/api/loyalty/referral', referralRouter);
app.route('/api/loyalty/birthday', birthdayRouter);
app.route('/api/loyalty/checkin', checkinRouter);
app.route('/api/loyalty', loyaltyRouter);
app.route('/api/admin/loyalty', adminLoyaltyRouter);
app.use('/api/reports/*', requireAuth(['owner', 'staff']));
app.route('/api/reports', reportsRouter);

// ── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));


// ── Dev-only: Simulate PayOS webhook + Telegram notify cho local test ────
app.post('/api/test/telegram-sim', requireAuth(['owner']), async (c) => {
  try {
    const body = await c.req.json();
    const { order_id } = body;
    if (!order_id) {return c.json({ error: 'Missing order_id' }, 400);}
    const order = await c.env.AURA_DB.prepare(
      'SELECT * FROM orders WHERE id = ?'
    ).bind(order_id).first();
    if (!order) {return c.json({ error: 'Order not found' }, 404);}
    const parsedItems = JSON.parse(order.items || '[]');
    const tgPromise = notifyTelegram(c.env, {
      id: order.id,
      items: parsedItems,
      total: order.total,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      payment_method: order.payment_method,
      notes: order.notes,
    }).catch(e => console.error('[Telegram test] Error:', e));
    if (c.executionCtx?.waitUntil) {c.executionCtx.waitUntil(tgPromise);}
    else {await tgPromise;}
    return c.json({ ok: true, message: 'Telegram sent' });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Admin: Test Zalo ZNS send (owner-only) ──────────────────────────────
app.post('/api/test/zalo-zns', requireAuth(['owner']), async (c) => {
  try {
    const { phone, template } = await c.req.json();
    if (!phone || !template) {return c.json({ error: 'phone and template required' }, 400);}
    const result = await sendZNS(c.env, {
      phone,
      template_key: template,
      data: { name: 'Test Member', member_id: 'AC000001', balance: 50000, amount: 12000, order_id: 'test123', days: 7 },
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Admin: Manual cashback expiry warning run (owner-only) ──────────────
app.post('/api/admin/zalo/send-expiry-warnings', requireAuth(['owner']), async (c) => {
  const result = await sendCashbackExpiryWarnings(c.env);
  return c.json({ ok: true, ...result });
});

export default app;

export { app };

export const scheduled = {
  async fetch(request, env, ctx) {
    ctx.waitUntil(checkOverdueOrders(env));
    return new Response('ok');
  },
};
