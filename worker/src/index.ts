/**
 * F&B Caffe Container — Cloudflare Worker
 * Unified Hono router — all routes mounted here
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/error-handler';
import { correlationId } from './middleware/correlation-id';
import { requestMetrics } from './middleware/request-metrics';
import { requireAuth } from './middleware/auth';
import { OrderBroadcaster } from './do/OrderBroadcaster';
import { handleScheduled } from './scheduled';
import type { Env } from './types/env';

// ── Sub-Routers ──
import { customerMenuRouter } from './routes/customer-menu';
import { authEndpointsRouter } from './routes/auth-endpoints';
import { staffMobileRouter } from './routes/staff-mobile';
import { ordersUnifiedRouter } from './routes/orders-unified';
import { realtimeOrdersRouter } from './routes/realtime-orders';
import { kdsStreamRouter } from '@aura/domain-kitchen';
import { registerFeatureRoutes } from './routes/features-router';
import { registerIntegrationRoutes } from './routes/integrations-router';
import { subscriptionsRouter } from './routes/subscriptions';

// ── OpenAPI & Docs ──
import { openApiApp } from './lib/openapi';
import { openApiTablesRouter } from './routes/openapi-tables';
import { openApiAuthRouter } from './routes/openapi-auth';
import { openApiPaymentsRouter } from './routes/openapi-payments';
import { openApiStaffRouter } from './routes/openapi-staff';
import { openApiInventoryRouter } from './routes/openapi-inventory';
import { openApiLoyaltyRouter } from './routes/openapi-loyalty';
import { openApiPromotionsRouter } from './routes/openapi-promotions';
import { openApiCronRouter } from './routes/openapi-cron';

const app = new Hono<{ Bindings: Env }>();

// ── CORS allowlist ──
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.fnb-caffe-container\.pages\.dev$/,
  /^https:\/\/(www\.)?auraspace\.cafe$/,
  /^https:\/\/(www\.)?auracafe\.vn$/,
  /^https:\/\/[a-z0-9-]+\.auracafe\.vn$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/
];

app.use('/*', cors({
  origin: (origin: string) => {
    if (!origin) return '';
    return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Reset-Key', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400
} as Parameters<typeof cors>[0]));

// ── Global Middleware ──
app.use('*', correlationId());
app.use('*', requestMetrics());
app.onError(errorHandler);

// ── Menu & Unified Orders Router (Single Runtime Owner) ──
app.route('/api/menu', customerMenuRouter);
app.route('/api/orders', ordersUnifiedRouter);

// ── Orders KDS & Realtime ──
app.use('/api/kds/orders/*', requireAuth(['owner', 'staff']));
app.route('/api/kds/orders', ordersUnifiedRouter);
app.route('/api/kds/orders', kdsStreamRouter);
app.get('/api/realtime/:channelId', (c) => realtimeOrdersRouter.fetch(c.req.raw, c.env, c.executionCtx));

// ── Auth & Mobile ──
app.route('/api/auth', authEndpointsRouter);
app.route('/mobile', staffMobileRouter);
app.get('/sw-mobile.js', (c) => c.text('/* Service Worker at /sw-mobile.js — managed by public/sw-mobile.js */', 200, { 'Content-Type': 'application/javascript' }));

// ── Domain Features & External Integrations ──
app.route('/api/subscriptions', subscriptionsRouter);
registerFeatureRoutes(app);
registerIntegrationRoutes(app);

// ── OpenAPI Sub-Routers & Docs ──
app.route('/', openApiTablesRouter);
app.route('/', openApiAuthRouter);
app.route('/', openApiPaymentsRouter);
app.route('/', openApiStaffRouter);
app.route('/', openApiInventoryRouter);
app.route('/', openApiLoyaltyRouter);
app.route('/', openApiPromotionsRouter);
app.route('/', openApiCronRouter);
app.route('/', openApiApp);

// ── API v1 alias ──
const v1 = new Hono<{ Bindings: Env }>();
v1.use('/*', async (c) => {
  const url = new URL(c.req.raw.url);
  url.pathname = url.pathname.replace(/^\/api\/v1/, '/api');
  return app.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});
app.route('/api/v1', v1);

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled: handleScheduled,
};
export { app };
export { handleScheduled as scheduled };
export { OrderBroadcaster };
