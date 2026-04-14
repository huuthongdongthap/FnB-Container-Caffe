/**
 * F&B Caffe Container — Cloudflare Worker
 * Unified Hono router — all routes mounted here
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Route modules
import { getMenu, getMenuItem } from './routes/menu.js';
import {
  createOrder, getOrder, updateOrder,
  getAdminOrders, getStats,
  getLatestOrderTs, getKdsOrders, updateOrderStatus,
} from './routes/orders.js';
import {
  registerUser, loginUser, logoutUser, getCurrentUser,
} from './routes/auth.js';
import { paymentRouter }    from './routes/payment.js';
import { webhookRouter }    from './routes/webhooks.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter }   from './routes/products.js';
import { tablesRouter }        from './routes/tables.js';
import { reservationsRouter }  from './routes/reservations.js';
import { checkOverdueOrders }  from './routes/cron.js';

const app = new Hono();

// ── Global CORS ─────────────────────────────────────────────────────────
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  maxAge: 86400,
}));

// ── Menu ────────────────────────────────────────────────────────────────
app.get('/api/menu',     (c) => getMenu(c.req.raw, c.env));
app.get('/api/menu/:id', (c) => getMenuItem(c.req.raw, c.env, c.req.param('id')));

// ── Orders (checkout flow) ──────────────────────────────────────────────
app.post('/api/orders',      (c) => createOrder(c.req.raw, c.env));
app.get('/api/orders/latest', (c) => getLatestOrderTs(c));
app.get('/api/orders/:id',   (c) => getOrder(c.req.raw, c.env, c.req.param('id')));
app.patch('/api/orders/:id', (c) => updateOrder(c.req.raw, c.env, c.req.param('id')));

// ── Orders KDS ──────────────────────────────────────────────────────────
app.get('/api/kds/orders',            (c) => getKdsOrders(c));
app.patch('/api/kds/orders/:id/status', (c) => updateOrderStatus(c));

// ── Admin ───────────────────────────────────────────────────────────────
app.get('/api/admin/orders', (c) => getAdminOrders(c.req.raw, c.env));
app.get('/api/stats',        (c) => getStats(c.req.raw, c.env));

// ── Auth ────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (c) => registerUser(c.req.raw, c.env));
app.post('/api/auth/login',    (c) => loginUser(c.req.raw, c.env));
app.post('/api/auth/logout',   (c) => logoutUser(c.req.raw, c.env));
app.get('/api/auth/me',        (c) => getCurrentUser(c.req.raw, c.env));

// ── Sub-routers (Hono-native) ───────────────────────────────────────────
app.route('/api/payment',    paymentRouter);
app.route('/api/webhook',    webhookRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/products',   productsRouter);
app.route('/api/tables',        tablesRouter);
app.route('/api/reservations',  reservationsRouter);

// ── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// ── 404 ─────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));

// ── Error handler ───────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ success: false, error: err.message }, 500);
});

// ── Export ───────────────────────────────────────────────────────────────
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    await checkOverdueOrders(env);
  },
};
