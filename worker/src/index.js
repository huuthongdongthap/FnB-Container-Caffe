/**
 * F&B Caffe Container - Cloudflare Worker
 * Main entry point - Routes dispatcher
 */

import { corsHeaders, errorResponse } from './middleware/cors.js';
import { getMenu, getMenuItem } from './routes/menu.js';
import {
  createOrder,
  getOrder,
  updateOrder,
  getAdminOrders,
  getStats,
} from './routes/orders.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
} from './routes/auth.js';
import { paymentRouter } from './routes/payment.js';
import { webhookRouter } from './routes/webhooks.js';

// Debug logging — set DEBUG="true" in wrangler.toml [vars] or Workers dashboard

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

      // 404 for unmatched routes
      return errorResponse('Not Found', 404);

    } catch (error) {
      if (env.DEBUG === 'true') { console.error('Worker error:', error); } // eslint-disable-line no-console
      return errorResponse('Internal Server Error: ' + error.message, 500);
    }
  },
};
