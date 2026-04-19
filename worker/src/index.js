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
  getLatestOrderTimestamp
} from './routes/orders.js';
import {
  registerUser, loginUser, logoutUser, getCurrentUser, registerStaff,
} from './routes/auth.js';
import { requireAuth } from './middleware/admin-auth.js';
import { paymentRouter } from './routes/payment.js';
import { webhookRouter } from './routes/webhooks.js';
import { tablesRouter } from './routes/tables.js';
import { reviewsRouter } from './routes/reviews.js';
import { contactRouter } from './routes/contact.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { reservationsRouter } from './routes/reservations.js';
import { customersRouter } from './routes/customers.js';
import { ordersRouter as ordersHonoRouter } from './routes/orders-hono.js';
import { promotionsRouter } from './routes/promotions.js';
import { shiftsRouter } from './routes/shifts.js';

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
    if (!origin) { return ''; }
    return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  credentials: true,
  maxAge: 86400,
}));

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
app.all('/api/loyalty/*', (c) => loyaltyRouter.fetch(c.req.raw, c.env, c.executionCtx));

// ── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

export default app;
