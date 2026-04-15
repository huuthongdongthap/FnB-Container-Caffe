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
  registerUser, loginUser, logoutUser, getCurrentUser,
} from './routes/auth.js';
import { paymentRouter } from './routes/payment.js';
import { webhookRouter } from './routes/webhooks.js';
import { tablesRouter } from './routes/tables.js';
import { reviewsRouter } from './routes/reviews.js';
import { contactRouter } from './routes/contact.js';
import { loyaltyRouter } from './routes/loyalty.js';

const app = new Hono();

// ── Global CORS ─────────────────────────────────────────────────────────
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  maxAge: 86400,
}));

// ── Menu ────────────────────────────────────────────────────────────────
app.get('/api/menu', (c) => getMenu(c.req.raw, c.env));
app.get('/api/menu/:id', (c) => getMenuItem(c.req.raw, c.env, c.req.param('id')));

// ── Orders (checkout flow) ──────────────────────────────────────────────
app.post('/api/orders', (c) => createOrder(c.req.raw, c.env));
app.get('/api/orders/latest', (c) => getLatestOrderTs(c));
app.get('/api/orders/:id', (c) => getOrder(c.req.raw, c.env, c.req.param('id')));
app.patch('/api/orders/:id', (c) => updateOrder(c.req.raw, c.env, c.req.param('id')));

// ── Orders KDS ──────────────────────────────────────────────────────────
app.get('/api/kds/orders', (c) => getKdsOrders(c));
app.patch('/api/kds/orders/:id/status', (c) => updateOrderStatus(c));

// ── Admin ───────────────────────────────────────────────────────────────
app.get('/api/admin/orders', (c) => getAdminOrders(c.req.raw, c.env));
app.get('/api/stats', (c) => getStats(c.req.raw, c.env));

// ── Auth ────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (c) => registerUser(c.req.raw, c.env));
app.post('/api/auth/login', (c) => loginUser(c.req.raw, c.env));
app.post('/api/auth/logout', (c) => logoutUser(c.req.raw, c.env));
app.get('/api/auth/me', (c) => getCurrentUser(c.req.raw, c.env));

// ── Sub-routers (Hono-native) ───────────────────────────────────────────
app.route('/api/payment', paymentRouter);
app.route('/api/webhook', webhookRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/products', productsRouter);
app.route('/api/tables', tablesRouter);
app.route('/api/reservations', reservationsRouter);
app.route('/api/customers', customersRouter);

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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      // Route matching
      // GET /api/menu
      if (path === '/api/menu' && method === 'GET') {
        return getMenu(request, env);
      }

      // GET /api/menu/:id
      if (path.match(/^\/api\/menu\/[^/]+$/) && method === 'GET') {
        const id = path.split('/')[3];
        return getMenuItem(request, env, id);
      }

      // POST /api/orders
      if (path === '/api/orders' && method === 'POST') {
        return createOrder(request, env);
      }

      // GET /api/orders/latest
      if (path === '/api/orders/latest' && method === 'GET') {
        return getLatestOrderTimestamp(request, env);
      }

      // GET /api/orders/:id
      if (path.match(/^\/api\/orders\/[^/]+$/) && method === 'GET') {
        const id = path.split('/')[3];
        return getOrder(request, env, id);
      }

      // PATCH /api/orders/:id
      if (path.match(/^\/api\/orders\/[^/]+$/) && method === 'PATCH') {
        const id = path.split('/')[3];
        return updateOrder(request, env, id);
      }

      // GET /api/admin/orders
      if (path === '/api/admin/orders' && method === 'GET') {
        return getAdminOrders(request, env);
      }

      // GET /api/stats
      if (path === '/api/stats' && method === 'GET') {
        return getStats(request, env);
      }

      // Auth Routes
      // POST /api/auth/register
      if (path === '/api/auth/register' && method === 'POST') {
        return registerUser(request, env);
      }

      // POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        return loginUser(request, env);
      }

      // POST /api/auth/logout
      if (path === '/api/auth/logout' && method === 'POST') {
        return logoutUser(request, env);
      }

      // GET /api/auth/me
      if (path === '/api/auth/me' && method === 'GET') {
        return getCurrentUser(request, env);
      }

      // Payment Routes — /api/payment/*
      if (path.startsWith('/api/payment/')) {
        return paymentRouter.fetch(
          new Request(request.url.replace('/api/payment', ''), request),
          env,
          ctx
        );
      }

      // Webhook Routes — /api/webhook/*
      if (path.startsWith('/api/webhook/')) {
        return webhookRouter.fetch(
          new Request(request.url.replace('/api/webhook', ''), request),
          env,
          ctx
        );
      }

      // Tables Routes — /api/tables* (Hono router)
      if (path.startsWith('/api/tables')) {
        return tablesRouter.fetch(
          new Request(request.url.replace('/api/tables', ''), request),
          env,
          ctx
        );
      }

      // Phase 4 Routes — /api/reviews*, /api/contact*, /api/loyalty*
      if (path.startsWith('/api/reviews')) {
        return reviewsRouter.fetch(
          new Request(request.url.replace('/api/reviews', ''), request),
          env,
          ctx
        );
      }

      if (path.startsWith('/api/contact')) {
        return contactRouter.fetch(
          new Request(request.url.replace('/api/contact', ''), request),
          env,
          ctx
        );
      }

      if (path.startsWith('/api/loyalty')) {
        return loyaltyRouter.fetch(
          request, // loyaltyRouter uses raw paths, do not strip prefix
          env,
          ctx
        );
      }

      // 404 for unmatched routes
      return errorResponse('Not Found', 404);

    } catch (error) {
      if (env.DEBUG === 'true') { console.error('Worker error:', error); } // eslint-disable-line no-console
      return errorResponse('Internal Server Error: ' + error.message, 500);
    }
  },
};
