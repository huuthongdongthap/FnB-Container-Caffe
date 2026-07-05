/**
 * F&B Caffe Container — Cloudflare Worker
 * Unified Hono router — all routes mounted here
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createLogger } from './middleware/logger';
import { errorHandler } from './middleware/error-handler';
import type { Env } from './types/env';
import type { MiddlewareHandler } from 'hono';

const log = createLogger({ route: 'index' });

// Route modules — pre-existing TS
import { getMenu, getMenuItem } from './routes/menu';
import {
  createOrder, getOrder, updateOrder, getAdminOrders, getStats,
  getLatestOrderTimestamp, notifyTelegram, splitOrders,
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

// ── Converted route modules (was .js, now .ts) ──
import { tablesRouter } from './routes/tables';
import { reviewsRouter } from './routes/reviews';
import { categoriesRouter } from './routes/categories';
import { productsRouter } from './routes/products';
import { customersRouter } from './routes/customers';
import { ordersRouter as ordersHonoRouter } from './routes/orders-hono';
import { orderStreamRouter } from './routes/order-stream';
import { promotionsRouter } from './routes/promotions';
import { shiftsRouter } from './routes/shifts';
import { subscriptionsRouter } from './routes/subscriptions';
import { adminLoyaltyRouter } from './routes/admin-loyalty';
import { birthdayRouter } from './routes/birthday';
import { checkinRouter } from './routes/checkin';
import { reportsRouter } from './routes/reports';
import { signageRouter } from './routes/signage';
import { pretixRouter } from './routes/pretix';
import { calBookingWebhookRouter } from './routes/cal-booking-webhook';

// ── Cron + Notifications ──
import {
  checkOverdueOrders, sendCashbackExpiryWarnings,
  processErpnextRetryQueue, processErpnextProductSync,
  syncMauticContacts, detectWinbackCandidates, detectBirthdayCandidates,
  runCampaignTriggers,
} from './routes/cron';
import { sendZNS } from './routes/zalo';

// ── ERPNext Integration (plain handlers → new unified handlers) ──
import { handleErpnextRequest } from './routes/erpnext';
import { handleErpnextPosRequest } from './routes/erpnext-pos';
import { handleErpnextInvoicesRequest } from './routes/erpnext-invoices';
import { erpnextSyncRoutes } from './routes/erpnext-sync';

// ── Mautic Bridge ──
import { handleMauticBridgeRequest } from './routes/mautic-bridge';

// ── Mixpost (was router + cron exports) ──
import { handleMixpostRequest, autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights } from './routes/mixpost';

// ── Version ──
import { getVersion } from './routes/version';
import { campaignsRouter } from './routes/campaigns';
import { broadcastRouter } from './routes/broadcast';
import { chatRouter } from './routes/chat';
import { analyticsRouter } from './routes/analytics-hono';
import { refundRouter } from './routes/refunds';
import { registerVitalsRoute } from './routes/vitals';
import { inventoryCRUD, inventorySnapshots, inventoryTransactions } from './routes/inventory';

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
    if (!origin) return '';
    return ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin)) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Reset-Key'],
  credentials: true,
  maxAge: 86400,
} as Parameters<typeof cors>[0]));

// ── Request metrics (all routes, non-blocking) ──
import { requestMetrics } from './middleware/request-metrics';
app.use('*', requestMetrics());

// ── Global error handler ──
app.onError(errorHandler);

// ── Menu ──
app.get('/api/menu', (c) => getMenu(c.req.raw, c.env));
app.get('/api/menu/:id', (c) => getMenuItem(c.req.raw, c.env, c.req.param('id')));

// ── Orders (checkout flow) ──
const orderRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost') return next();
  const key = `rate:order:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 5) return c.json({ ok: false, error: 'Quá nhiều đơn hàng. Vui lòng thử lại sau 10 phút.' }, 429);
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 600 });
  await next();
};

app.post('/api/orders', orderRateLimit, (c) => createOrder(c.req.raw, c.env, c.executionCtx));
app.post('/api/orders/split', (c) => splitOrders(c.req.raw, c.env));
app.get('/api/orders/latest', (c) => getLatestOrderTimestamp(c.req.raw, c.env));
app.get('/api/orders/:id', (c) => getOrder(c.req.raw, c.env, c.req.param('id')));
app.patch('/api/orders/:id', requireAuth(['owner', 'staff']), (c) => updateOrder(c.req.raw, c.env, c.req.param('id')));

// ── Orders KDS ──
app.use('/api/kds/orders/*', requireAuth(['owner', 'staff']));
app.route('/api/kds/orders', ordersHonoRouter);

// ── Order SSE Stream (public, read-only) ──
app.route('/api/orders', orderStreamRouter);

// ── Admin (protected) ──
app.use('/api/admin/*', requireAuth(['owner', 'staff']));
app.get('/api/admin/orders', (c) => getAdminOrders(c.req.raw, c.env));

// Admin customers list (inlined from old getAdminCustomers)
app.get('/api/admin/customers', async (c) => {
  const db = c.env.AURA_DB;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = (page - 1) * limit;
  const { results } = await db.prepare(
    'SELECT id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();
  const { total: totalRow } = await db.prepare('SELECT COUNT(*) as total FROM customers').first<{ total: number }>() || { total: 0 };
  return c.json({ success: true, data: results, pagination: { page, limit, total: totalRow } });
});

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
  if (count >= 20) return c.json({ ok: false, error: 'Too many requests. Try again in 5 minutes.' }, 429);
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 300 });
  await next();
};

app.post('/api/auth/register', authRateLimit, (c) => registerUser(c.req.raw, c.env));
app.post('/api/auth/login', authRateLimit, (c) => loginUser(c.req.raw, c.env, c.executionCtx));
app.post('/api/auth/logout', (c) => logoutUser(c.req.raw, c.env));
app.get('/api/auth/me', (c) => getCurrentUser(c.req.raw, c.env));
app.post('/api/auth/register-staff', requireAuth(['owner']), audit('register_staff'), (c) => registerStaff(c.req.raw, c.env));
app.get('/api/auth/staff', requireAuth(['owner']), audit('list_staff'), (c) => listStaff(c.req.raw, c.env));
app.post('/api/auth/bootstrap-owner', (c) => bootstrapOwner(c.req.raw, c.env));
app.post('/api/auth/reset-password', authRateLimit, (c) => resetPassword(c.req.raw, c.env));
app.post('/api/auth/change-password', authRateLimit, (c) => changePassword(c.req.raw, c.env));

// ── Sub-routers ──
app.route('/api/payment', paymentRouter);
app.route('/api/payments', refundRouter);
app.route('/api/webhook', webhookRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/products', productsRouter);
app.route('/api/tables', tablesRouter);
app.route('/api/reservations', reservationsRouter);
app.route('/api/customers', customersRouter);
app.route('/api/promotions', promotionsRouter);
app.route('/api/signage', signageRouter);
app.route('/api/pretix', pretixRouter);
app.route('/api/shifts', shiftsRouter);
app.route('/api/subscriptions', subscriptionsRouter);
app.route('/api/campaigns', campaignsRouter);
app.use('/api/broadcast/*', requireAuth(['owner', 'staff']));
app.route('/api/broadcast', broadcastRouter);
app.route('/api/chat', chatRouter);

// ── Analytics Dashboard (owner/staff) ──
app.use('/api/analytics/*', requireAuth(['owner', 'staff']));
app.route('/api/analytics', analyticsRouter);

// ── Web Vitals (public, sendBeacon) ──
registerVitalsRoute(app);

// ── Reviews (Hono router wrapper) ──
app.all('/api/reviews/*', (c) => reviewsRouter.fetch(
  new Request(c.req.raw.url.replace('/api/reviews', ''), c.req.raw), c.env, c.executionCtx
));

// ── Contact (Hono router wrapper) ──
app.all('/api/contact/*', (c) => contactRouter.fetch(
  new Request(c.req.raw.url.replace('/api/contact', ''), c.req.raw), c.env
));

// ── Cal.com booking webhook ──
app.all('/api/webhooks/cal-booking/*', (c) => calBookingWebhookRouter.fetch(
  new Request(c.req.raw.url.replace('/api/webhooks/cal-booking', '/api/cal-booking-webhook'), c.req.raw), c.env, c.executionCtx
));

app.route('/api/loyalty/referral', referralRouter);
app.route('/api/loyalty/birthday', birthdayRouter);
app.route('/api/loyalty/checkin', checkinRouter);
app.route('/api/loyalty', loyaltyRouter);
app.route('/api/admin/loyalty', adminLoyaltyRouter);
app.use('/api/reports/*', requireAuth(['owner', 'staff']));
app.route('/api/reports', reportsRouter);

// ── Inventory (protected: read for owner/staff/customer, write for owner/staff) ──
app.use('/api/inventory/*', requireAuth(['owner', 'staff', 'customer']));
app.route('/api/inventory', inventoryCRUD);
app.route('/api/inventory', inventoryTransactions);
app.route('/api/inventory', inventorySnapshots);

// ── Health check ──
import { getHealth } from './routes/health';
app.get('/api/health', async (c) => {
  const checkDb = c.req.query('db') === '1';
  const result = await getHealth(c.env, checkDb);
  const statusCode = result.status === 'degraded' ? 503 : 200;
  return c.json(result, statusCode as 200 | 503);
});

// ── Version (deploy SHA verification) ──
app.get('/api/version', (c) => c.json(getVersion(c.env)));

// ── Admin Sales CSV Export ──
import { adminSalesRouter } from './routes/admin-sales';
app.route('/api/admin/sales', adminSalesRouter);

// ── Admin Metrics (staff-only observability) ──
import adminMetrics from './routes/admin-metrics';
app.route('/api/admin/metrics', adminMetrics);

// ── Cron: Alert dispatch (protected by shared secret) ──
import { createAlertDispatcher } from './lib/alert-dispatcher';

function checkCronSecret(c: { env: Env; req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined } }): boolean {
  if (!c.env.CRON_SECRET) return true; // not configured — allow (dev/legacy)
  const secret = c.req.header('X-Cron-Secret') || c.req.query('secret');
  return secret === c.env.CRON_SECRET;
}

app.get('/cron/alerts', async (c) => {
  if (!checkCronSecret(c)) return c.json({ error: 'Unauthorized' }, 401);
  const dispatcher = createAlertDispatcher(c.env.AURA_DB);
  const tgToken = c.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = c.env.TELEGRAM_CHAT_ID;
  const sendFn = async (msg: string, _severity: string) => {
    if (!tgToken || !tgChatId) return;
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(5000),
    });
  };
  const fired = await dispatcher.dispatchAlerts(sendFn);
  return c.json({ fired, at: new Date().toISOString() });
});

// ── Cron: Daily digest (triggered hourly, dispatched only at 21:00 ICT) ──
app.get('/cron/digest', async (c) => {
  if (!checkCronSecret(c)) return c.json({ error: 'Unauthorized' }, 401);
  const ictHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }),
    10
  );
  if (ictHour !== 21) {
    return c.json({ skipped: true, reason: 'Not digest time', ictHour });
  }
  const dispatcher = createAlertDispatcher(c.env.AURA_DB);
  const tgToken = c.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = c.env.TELEGRAM_CHAT_ID;
  const sendFn = async (msg: string) => {
    if (!tgToken || !tgChatId) return;
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(5000),
    });
  };
  await dispatcher.dispatchDigest(sendFn);
  return c.json({ ok: true, at: new Date().toISOString() });
});

// ── Dev: Simulate PayOS webhook + Telegram (owner-only) ──
app.post('/api/test/telegram-sim', requireAuth(['owner']), audit('test_telegram_sim'), async (c) => {
  try {
    const body = await c.req.json<{ order_id?: string }>();
    if (!body.order_id) return c.json({ error: 'Missing order_id' }, 400);
    const order = await c.env.AURA_DB.prepare('SELECT * FROM orders WHERE id = ?').bind(body.order_id).first<Record<string, unknown>>();
    if (!order) return c.json({ error: 'Order not found' }, 404);
    const parsedItems = JSON.parse((order.items as string) || '[]');
    const tgPromise = notifyTelegram(c.env as unknown as Record<string, unknown>, {
      id: order.id as string,
      items: parsedItems,
      total: order.total as number,
      customer_name: order.customer_name as string,
      customer_phone: order.customer_phone as string,
      customer_address: order.customer_address as string,
      payment_method: order.payment_method as string,
      notes: order.notes as string,
    }).catch((e: Error) => log.error('Telegram test error:', { message: e.message }));
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
    const { phone, template } = await c.req.json<{ phone?: string; template?: string }>();
    if (!phone || !template) return c.json({ error: 'phone and template required' }, 400);
    const result = await sendZNS(c.env as unknown as Record<string, unknown>, {
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

// ── ERPNext Integration (owner only) ──
// All ERPNext routes use unified handlers, forwarding to their respective handlers
app.use('/api/erpnext/*', requireAuth(['owner']));

app.all('/api/erpnext/*', (c) => {
  const url = c.req.raw.url.replace('/api/erpnext', '/api/erpnext');
  return handleErpnextRequest(c.req.raw, c.env as unknown as Record<string, unknown>);
});

app.all('/api/erpnext-pos/*', (c) =>
  handleErpnextPosRequest(c.req.raw, c.env as unknown as Record<string, unknown>)
);

app.all('/api/erpnext-invoices/*', (c) =>
  handleErpnextInvoicesRequest(c.req.raw, c.env as unknown as Record<string, unknown>)
);

// ── ERPNext Sync (owner + staff) ──
erpnextSyncRoutes(app);

// ── Public: product availability ──
app.get('/api/public/products/:productId/availability', (c) =>
  handleErpnextPosRequest(
    new Request(`https://internal/api/erpnext-pos/products/${c.req.param('productId')}/availability`, c.req.raw),
    c.env as unknown as Record<string, unknown>
  )
);

// ── Cal.com booking webhook (public) ──
app.post('/api/webhooks/cal-booking', (c) =>
  calBookingWebhookRouter.fetch(
    new Request(c.req.raw.url.replace('/api/webhooks/cal-booking', '/api/cal-booking-webhook'), {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    }),
    c.env,
    c.executionCtx
  )
);

// ── Mixpost (admin only) ──
app.use('/api/mixpost/*', requireAuth(['owner', 'staff']));
app.all('/api/mixpost/*', (c) =>
  handleMixpostRequest(c.req.raw, c.env as unknown as Record<string, unknown>)
);

// ── Mautic Bridge (cron/admin) ──
app.use('/api/mautic-bridge/*', requireAuth(['owner']));
app.all('/api/mautic-bridge/*', (c) =>
  handleMauticBridgeRequest(c.req.raw, c.env as unknown as Record<string, unknown>)
);

// ── Zalo (admin only) ──
app.all('/api/zalo/*', requireAuth(['owner']), async (c) => {
  const { handleZaloRequest } = await import('./routes/zalo');
  return handleZaloRequest(c.req.raw, c.env as unknown as Record<string, unknown>);
});

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
    ctx.waitUntil(autoPostDailySpecials(env as unknown as Record<string, unknown>));
    ctx.waitUntil(autoPostNewPromotions(env as unknown as Record<string, unknown>));
    ctx.waitUntil(autoPostWeeklyHighlights(env as unknown as Record<string, unknown>));
    ctx.waitUntil(runCampaignTriggers(env as unknown as Record<string, unknown>));
    return new Response('ok');
  },
};
