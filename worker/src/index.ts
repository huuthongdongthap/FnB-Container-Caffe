/**
 * F&B Caffe Container — Cloudflare Worker
 * Unified Hono router — all routes mounted here
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/error-handler';
import { correlationId } from './middleware/correlation-id';
import { requestMetrics } from './middleware/request-metrics';
import { securityHeaders } from './middleware/security-headers';
import { orderBodyLimit, authBodyLimit } from './middleware/body-limit';
import { requireAuth } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { OrderBroadcaster } from './do/OrderBroadcaster';
import { handleScheduled } from './scheduled';
import type { Env } from './types/env';

// ── Sub-Routers ──
import { customerMenuRouter } from './routes/customer-menu';
import { authEndpointsRouter } from './routes/auth-endpoints';
import { staffMobileRouter } from './routes/staff-mobile';
import { ordersUnifiedRouter } from './routes/orders-unified';
import { kdsOrdersRouter } from './routes/kds-orders';
import { KDS_ROLES } from './routes/orders-hono-handlers/kds-handlers';
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
import { openApiSopRouter } from './routes/openapi-sop';
import { sopMobileRouter } from './routes/sop-mobile';
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
  /^https:\/\/[a-z0-9-]+\.auraspace\.cafe$/,
  /^https:\/\/(www\.)?auracafe\.vn$/,
  /^https:\/\/[a-z0-9-]+\.auracafe\.vn$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/
];

app.use('/*', cors({
  origin: (origin: string) => {
    if (!origin) return false;
    return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : false;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Session-ID',
    'X-Reset-Key',
    'X-Request-ID',
    'Idempotency-Key',
    'X-Tenant-ID',
    'X-Edge-Telemetry-Secret'
  ],
  exposeHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400
} as Parameters<typeof cors>[0]));

// ── Global Middleware ──
app.use('*', correlationId());
app.use('*', securityHeaders());
app.use('*', requestMetrics());
// Body ceilings go before the routers so an oversized payload is rejected
// before any route handler pays to parse it.
app.use('/api/orders/*', orderBodyLimit());
app.use('/api/orders', orderBodyLimit());
app.use('/api/kds/orders/*', orderBodyLimit());
app.use('/api/auth/*', authBodyLimit());
app.onError(errorHandler);

// ── Menu & Unified Orders Router (Single Runtime Owner) ──
app.route('/api/menu', customerMenuRouter);

// ── Orders KDS & Realtime ──

app.use('/api/orders/kds', requireAuth(KDS_ROLES));
app.use('/api/orders/kds/*', requireAuth(KDS_ROLES));
app.use('/api/orders/kds', tenantMiddleware);
app.use('/api/orders/kds/*', tenantMiddleware);
app.use('/api/kds/orders', requireAuth(KDS_ROLES));
app.use('/api/kds/orders/*', requireAuth(KDS_ROLES));
app.use('/api/kds/orders', tenantMiddleware);
app.use('/api/kds/orders/*', tenantMiddleware);
const codCollectionRoles = ['owner', 'manager', 'cashier', 'admin'];
app.use('/api/orders/:id/mark-cod-paid', requireAuth(codCollectionRoles));
app.use('/api/orders/:id/mark-cod-paid', tenantMiddleware);
app.route('/api/orders', ordersUnifiedRouter);
// Mount the static SSE endpoint before the dynamic /:id order routes.
app.route('/api/kds/orders', kdsStreamRouter);
// The KDS queue is the only other consumer of this prefix, so it gets its own
// router instead of re-mounting the whole unified orders surface here.
app.route('/api/kds/orders', kdsOrdersRouter);
app.get('/api/realtime/:channelId', requireAuth(KDS_ROLES), tenantMiddleware, (c) => {
  const user = c.get('user');
  const channelId = c.req.param('channelId');
  const tenantId = user?.tenantId || 'default';
  if (channelId !== tenantId && !channelId.startsWith(`${tenantId}:`) && channelId !== 'kitchen') {
    return c.json({ success: false, error: 'Không đủ quyền truy cập kênh thời gian thực của cửa hàng khác' }, 403);
  }
  return realtimeOrdersRouter.fetch(c.req.raw, c.env, c.executionCtx);
});

// ── Auth & Mobile ──
app.route('/api/auth', authEndpointsRouter);
app.route('/mobile', staffMobileRouter);
app.route('/api/sop', sopMobileRouter);
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
app.route('/', openApiSopRouter);
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
