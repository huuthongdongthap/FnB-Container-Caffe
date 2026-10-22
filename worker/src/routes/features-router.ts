import { handleUpdateOrderStatus } from './orders-hono-handlers/kds-handlers';
/**
 * Feature Routes Registration (Admin, CRM, Reports, Signage, Webhooks, SaaS, etc.)
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { getAdminOrders, getStats } from '@aura/domain-order';
import { paymentRouter, nowPaymentsIPN } from '@aura/domain-payment';
import { refundRouter } from './refunds';
import { pushRouter } from './push';
import { webhookRouter } from './webhooks';
import { categoriesRouter, productsRouter, menuModifiersRouter } from '@aura/domain-catalog';
import { catalogRouter } from './openapi-catalog';
import { tablesRouter, qrRouter } from '@aura/domain-table';
import { tableSessionsRouter } from './table-sessions';
import { kitchenStationsRouter } from '@aura/domain-kitchen';
import { floorPlanRouter } from './floor-plan';
import { clientErrorsRouter } from './client-errors';
import { staffTipsRouter } from '@aura/domain-staff';
import { adminQRRouter } from './admin-qr';
import { reservationsRouter } from '@aura/domain-reservation';
import { customersRouter } from './customers';
import { crmRouter } from './crm';
import { posCustomerRouter } from './pos-customer';
import { promotionsRouter } from './promotions';
import { signageRouter } from './signage';
import { pretixRouter } from './pretix';
import { shiftsRouter, reconciliationRoutes } from '@aura/domain-shift';
import { getInvoiceReceipt } from './subscription-receipt';
import { campaignsRouter } from './campaigns';
import { broadcastRouter } from './broadcast';
import { chatRouter } from './chat';
import { analyticsRouter } from './analytics-hono';
import { registerVitalsRoute } from './vitals';
import { reviewsRouter } from './reviews';
import { contactRouter } from './contact';
import { recruitmentRouter } from './recruitment';
import { calBookingWebhookRouter } from './cal-booking-webhook';
import { loyaltyRouter } from './loyalty';
import { referralRouter } from './referrals';
import { birthdayRouter } from './birthday';
import { checkinRouter } from './checkin';
import { adminLoyaltyRouter } from './admin-loyalty';
import { reportsRouter } from './reports';
import { inventoryCRUD, inventorySnapshots, inventoryTransactions } from '@aura/domain-inventory';
import { getHealth } from './health';
import { getVersion } from './version';
import { dindinRouter } from './dindin';
import { adminSalesRouter } from './admin-sales';
import adminMetrics from './admin-metrics';
import { registerAuditLogRoutes } from './admin-audit-logs';
import { registerCronAdminRoutes } from './cron-admin';
import {
  getAdminCustomers,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer,
  getStuckPayments,
} from './admin-handlers';
import { getPricing } from './saas-pricing';
import { createTenantRoutes } from './saas-tenants';
import { franchiseRouter } from './franchise-locations';
import { recommendationsRouter } from './recommendations';
import { inventoryForecastingRouter } from './inventory-forecasting';
import { demandForecastRouter } from './demand-forecast';
import { aiBaristaRouter } from './ai-barista';
import { dynamicPricingRouter } from './dynamic-pricing';
import { customerAssistantRouter } from './customer-assistant';
import { zaloWebhookRouter } from './zalo-webhook';
import { containerTelemetryRouter } from './container-telemetry';
import { handleOverview } from './reports-handlers/grouped-sales-handlers';
import type { Env } from '../types/env';

export function registerFeatureRoutes(app: Hono<{ Bindings: Env }>): void {
  // Admin Protected (Kitchen/Barista/Chef scoped strictly to /api/admin/orders*)
  const adminOrderAuth = requireAuth(['owner', 'manager', 'staff', 'admin', 'kitchen', 'barista', 'chef', 'waiter', 'cashier']);
  const adminGeneralAuth = requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']);
  app.use('/api/admin/*', async (c, next) => {
    if (c.req.path === '/api/admin/orders' || c.req.path.startsWith('/api/admin/orders/')) {
      return adminOrderAuth(c, next);
    }
    return adminGeneralAuth(c, next);
  });
  app.get('/api/admin/orders', (c) => {
    const user = c.get('user' as any) as { tenantId?: string; role?: string } | undefined;
    const isHQ = user?.role === 'owner' && (!user?.tenantId || user?.tenantId === 'default' || user?.tenantId === 'hq');
    const effectiveTenant = isHQ ? (c.req.query('tenant_id') || undefined) : user?.tenantId;
    return getAdminOrders(c.req.raw, c.env, effectiveTenant);
  });
  // Every alias uses the same tenant-scoped state machine and compare-and-set.
  app.patch('/api/admin/orders/:id/status', handleUpdateOrderStatus);
  app.post('/api/admin/orders/:id/complete', (c) => handleUpdateOrderStatus(c, 'completed'));
  app.get('/api/admin/customers', (c) => getAdminCustomers(c.req.raw, c.env));
  app.post('/api/admin/customers', (c) => createAdminCustomer(c.req.raw, c.env));
  app.patch('/api/admin/customers/:id', (c) => updateAdminCustomer(c.req.raw, c.env, c.req.param('id')));
  app.delete('/api/admin/customers/:id', (c) => deleteAdminCustomer(c.env, c.req.param('id')));
  app.get('/api/admin/payments/stuck', requireAuth(['owner', 'manager', 'admin']), (c) => getStuckPayments(c.req.raw, c.env));
  app.route('/api/admin/dindin', dindinRouter);
  app.route('/api/admin/sales', adminSalesRouter);
  app.route('/api/admin/metrics', adminMetrics);
  registerAuditLogRoutes(app);
  registerCronAdminRoutes(app);

  // Stats & Dashboard Overview
  app.use('/api/stats', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']));
  app.get('/api/stats', (c) => getStats(c.req.raw, c.env));
  app.use('/api/dashboard/*', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']));
  app.get('/api/dashboard/overview', handleOverview);

  // Payment & Refunds
  app.route('/api/payment', paymentRouter);
  app.route('/api/payments', refundRouter);
  app.route('/api/push', pushRouter);
  app.route('/api/webhook', webhookRouter);

  // Catalog & Tables
  app.route('/api/categories', categoriesRouter);
  app.route('/api/products', productsRouter);
  app.route('/api/catalog', catalogRouter);
  app.route('/api/tables', tablesRouter);
  app.use('/api/table-sessions/*', requireAuth(['owner', 'staff', 'manager', 'admin', 'waiter', 'cashier']));
  app.route('/api/table-sessions', tableSessionsRouter);
  app.route('/api/menu-modifiers', menuModifiersRouter);
  app.route('/api/kitchen-stations', kitchenStationsRouter);
  app.route('/api/floor-plan', floorPlanRouter);
  app.route('/api/client-error', clientErrorsRouter);
  app.route('/api/errors', clientErrorsRouter);
  app.route('/api/staff-tips', staffTipsRouter);
  app.route('/api/qr', qrRouter);
  app.route('/api/admin/qr', adminQRRouter);

  // Reservations & CRM
  app.route('/api/reservations', reservationsRouter);
  app.route('/api/admin/reservations', reservationsRouter);
  app.route('/api/customers', customersRouter);
  app.route('/api/crm', crmRouter);
  app.route('/api/pos/customer', posCustomerRouter);
  app.route('/api/promotions', promotionsRouter);
  app.route('/api/signage', signageRouter);
  app.route('/api/pretix', pretixRouter);
  app.use('/api/shifts/:id/*', requireAuth(['owner', 'manager', 'staff', 'admin', 'waiter', 'kitchen', 'barista', 'chef', 'cashier']));
  reconciliationRoutes(app as any);
  app.route('/api/shifts', shiftsRouter);
  app.get('/api/subscriptions/invoices/:id/receipt', requireAuth(['owner', 'manager', 'admin', 'staff', 'vendor', 'customer']), (c) => getInvoiceReceipt(c));
  app.route('/api/campaigns', campaignsRouter);
  app.use('/api/broadcast/*', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']));
  app.route('/api/broadcast', broadcastRouter);
  app.route('/api/chat', chatRouter);

  // Analytics & Observability
  app.use('/api/analytics/*', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']));
  app.route('/api/analytics', analyticsRouter);
  registerVitalsRoute(app);

  // External Service Proxies & Webhooks
  app.route('/api/reviews', reviewsRouter);
  app.all('/api/contact', (c) => contactRouter.fetch(c.req.raw, c.env));
  app.all('/api/contact/*', (c) => contactRouter.fetch(c.req.raw, c.env));
  app.route('/api/recruitment', recruitmentRouter);
  app.route('/api/webhooks/cal-booking', calBookingWebhookRouter);
  app.route('/api/cal-booking-webhook', calBookingWebhookRouter);
  app.post('/api/webhooks/nowpayments', (c) => nowPaymentsIPN(c.req.raw, c.env));

  // Loyalty & Reports
  app.route('/api/loyalty/referral', referralRouter);
  app.route('/api/loyalty/birthday', birthdayRouter);
  app.route('/api/admin/birthday', birthdayRouter);
  app.route('/api/loyalty/checkin', checkinRouter);
  app.route('/api/checkin', checkinRouter);
  app.route('/api/admin/checkins', checkinRouter);
  app.route('/api/loyalty', loyaltyRouter);
  app.route('/api/admin/loyalty', adminLoyaltyRouter);
  app.route('/api/admin-loyalty', adminLoyaltyRouter);
  app.get('/api/admin/notification-settings', requireAuth(['owner', 'manager', 'admin']), async (c) => {
    const raw = await c.env.AUTH_KV?.get('config:notification_settings');
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return c.json({
      autoNotifyNewOrder: Boolean(parsed.autoNotifyNewOrder),
      soundAlerts: Boolean(parsed.soundAlerts),
    });
  });
  app.patch('/api/admin/notification-settings', requireAuth(['owner', 'manager', 'admin']), async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const raw = await c.env.AUTH_KV?.get('config:notification_settings');
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const next = {
      autoNotifyNewOrder: typeof body.autoNotifyNewOrder === 'boolean' ? body.autoNotifyNewOrder : Boolean(prev.autoNotifyNewOrder),
      soundAlerts: typeof body.soundAlerts === 'boolean' ? body.soundAlerts : Boolean(prev.soundAlerts),
    };
    await c.env.AUTH_KV?.put('config:notification_settings', JSON.stringify(next));
    return c.json({ success: true, ...next });
  });
  app.patch('/api/staff/notification-settings', requireAuth(['owner', 'manager', 'admin', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'cashier']), async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const user = (c as unknown as { get: (k: string) => { id?: string } | undefined }).get('user');
    const key = `config:staff_notification_settings:${user?.id || 'default'}`;
    const raw = await c.env.AUTH_KV?.get(key);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const next = {
      orderAlertsEnabled: typeof body.orderAlertsEnabled === 'boolean' ? body.orderAlertsEnabled : Boolean(prev.orderAlertsEnabled ?? true),
      shiftRemindersEnabled: typeof body.shiftRemindersEnabled === 'boolean' ? body.shiftRemindersEnabled : Boolean(prev.shiftRemindersEnabled ?? true),
    };
    await c.env.AUTH_KV?.put(key, JSON.stringify(next));
    return c.json({ success: true, ...next });
  });
  app.use('/api/reports/*', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']));
  app.route('/api/reports', reportsRouter);

  // Inventory Items (domain-inventory)
  const inventoryItemsApp = new Hono<{ Bindings: Env }>();
  inventoryItemsApp.use('/*', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'admin']));
  inventoryCRUD(inventoryItemsApp as any);
  inventoryTransactions(inventoryItemsApp as any);
  inventorySnapshots(inventoryItemsApp as any);
  app.route('/api/inventory/items', inventoryItemsApp);

  // Health & System
  app.get('/api/health', async (c) => {
    const checkDeps = c.req.query('db') === '1' || c.req.query('ready') === '1' || c.req.query('deep') === '1';
    const result = await getHealth(c.env, checkDeps);
    const isHealthy = result.status === 'ok' && (!checkDeps || result.readiness);
    const httpStatus = isHealthy ? 200 : 503;
    return c.json(result, httpStatus as 200 | 503);
  });
  app.get('/api/version', (c) => c.json(getVersion(c.env)));

  // SaaS & Franchise
  app.get('/api/saas/pricing', getPricing);
  app.use('/api/saas/tenants/*', requireAuth(), tenantMiddleware);
  app.route('/api/saas/tenants', createTenantRoutes());
  app.route('/api/franchise', franchiseRouter);

  // AI & Edge Automation
  app.route('/api/recommendations', recommendationsRouter);
  app.route('/api/inventory/forecasting', inventoryForecastingRouter);
  app.route('/api/admin/metrics', demandForecastRouter);
  app.route('/api/ai/barista', aiBaristaRouter);

  // Autonomous Edge Operations
  app.route('/api/pricing/dynamic', dynamicPricingRouter);
  app.route('/api/chat/assistant', customerAssistantRouter);
  app.route('/api/webhooks/zalo', zaloWebhookRouter);
  app.route('/api/edge', containerTelemetryRouter);
}
