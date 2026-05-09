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
import { requireAuth } from './middleware/admin-auth.js';
import { paymentRouter } from './routes/payment.js';
import { webhookRouter } from './routes/webhooks.js';
import { tablesRouter } from './routes/tables.js';
import { reviewsRouter } from './routes/reviews.js';
import { contactRouter } from './routes/contact.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { referralRouter } from './routes/referrals.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { reservationsRouter } from './routes/reservations.js';
import { customersRouter } from './routes/customers.js';
import { ordersRouter as ordersHonoRouter } from './routes/orders-hono.js';
import { promotionsRouter } from './routes/promotions.js';
import { shiftsRouter } from './routes/shifts.js';
import { checkOverdueOrders } from './routes/cron.js';

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
app.post('/api/orders', (c) => createOrder(c.req.raw, c.env));
app.get('/api/orders/latest', (c) => getLatestOrderTimestamp(c.req.raw, c.env));
app.get('/api/orders/:id', (c) => getOrder(c.req.raw, c.env, c.req.param('id')));
app.patch('/api/orders/:id', (c) => updateOrder(c.req.raw, c.env, c.req.param('id')));

// ── Orders KDS ──────────────────────────────────────────────────────────
app.route('/api/kds/orders', ordersHonoRouter);

// ── Admin (protected) ───────────────────────────────────────────────────
app.use('/api/admin/*', requireAuth(['owner', 'staff']));
app.get('/api/admin/orders', (c) => getAdminOrders(c.req.raw, c.env));
app.use('/api/stats', requireAuth(['owner', 'staff']));
app.get('/api/stats', (c) => getStats(c.req.raw, c.env));

// ── Auth ────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (c) => registerUser(c.req.raw, c.env));
app.post('/api/auth/login', (c) => loginUser(c.req.raw, c.env));
app.post('/api/auth/logout', (c) => logoutUser(c.req.raw, c.env));
app.get('/api/auth/me', (c) => getCurrentUser(c.req.raw, c.env));
app.post('/api/auth/register-staff', requireAuth(['owner']), (c) => registerStaff(c.req.raw, c.env));
// Staff/Owner list — owner-only (KV scan, used by /admin/staff.html)
app.get('/api/auth/staff', requireAuth(['owner']), (c) => listStaff(c.req.raw, c.env));
// One-time bootstrap: creates first owner if none exists. Idempotent (409 thereafter).
app.post('/api/auth/bootstrap-owner', (c) => bootstrapOwner(c.req.raw, c.env));
// Password reset — gated by X-Reset-Key header matching env.RESET_KEY (set via wrangler secret put)
app.post('/api/auth/reset-password', (c) => resetPassword(c.req.raw, c.env));

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
app.route('/api/loyalty', loyaltyRouter);
app.route('/api/loyalty/referral', referralRouter);

// ── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Seed menu from JSON (temporary — remove after use) ──────────────────
app.post('/api/seed-menu', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.env.AURA_DB;
    const cats = body.categories || [];
    const items = body.items || [];
    let catCount = 0, itemCount = 0;
    for (const cat of cats) {
      const slug = cat.id || cat.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      await db.prepare('INSERT OR REPLACE INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)')
        .bind(cat.id, cat.name, slug, cat.description || '').run();
      catCount++;
    }
    for (const item of items) {
      await db.prepare('INSERT OR REPLACE INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
        .bind(item.id, item.category, item.name, item.price, item.description || '', JSON.stringify(item.tags || []), item.badge || null).run();
      itemCount++;
    }
    return c.json({ ok: true, categories: catCount, items: itemCount });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Dev-only: Simulate PayOS webhook + Telegram notify cho local test ────
app.post('/api/test/telegram-sim', async (c) => {
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

export default app;
