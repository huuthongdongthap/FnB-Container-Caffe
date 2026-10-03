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
import { shiftsRouter } from '@aura/domain-shift';
import { getInvoiceReceipt } from './subscription-receipt';
import { campaignsRouter } from './campaigns';
import { broadcastRouter } from './broadcast';
import { chatRouter } from './chat';
import { analyticsRouter } from './analytics-hono';
import { registerVitalsRoute } from './vitals';
import { reviewsRouter } from './reviews';
import { contactRouter } from './contact';
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
import { getAdminCustomers, getStuckPayments } from './admin-handlers';
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
import type { Env } from '../types/env';

export function registerFeatureRoutes(app: Hono<{ Bindings: Env }>): void {
  // Admin Protected
  app.use('/api/admin/*', requireAuth(['owner', 'staff']));
  app.get('/api/admin/orders', (c) => {
    const user = c.get('user' as any) as { tenantId?: string; role?: string } | undefined;
    const isHQ = user?.role === 'owner' && (!user?.tenantId || user?.tenantId === 'default' || user?.tenantId === 'hq');
    const effectiveTenant = isHQ ? (c.req.query('tenant_id') || undefined) : user?.tenantId;
    return getAdminOrders(c.req.raw, c.env, effectiveTenant);
  });
  app.get('/api/admin/customers', (c) => getAdminCustomers(c.req.raw, c.env));
  app.get('/api/admin/payments/stuck', requireAuth(['owner']), (c) => getStuckPayments(c.req.raw, c.env));
  app.route('/api/admin/dindin', dindinRouter);
  app.route('/api/admin/sales', adminSalesRouter);
  app.route('/api/admin/metrics', adminMetrics);
  registerAuditLogRoutes(app);
  registerCronAdminRoutes(app);

  // Stats
  app.use('/api/stats', requireAuth(['owner', 'staff']));
  app.get('/api/stats', (c) => getStats(c.req.raw, c.env));

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
  app.use('/api/table-sessions/*', requireAuth(['owner', 'staff', 'manager']));
  app.route('/api/table-sessions', tableSessionsRouter);
  app.route('/api/menu-modifiers', menuModifiersRouter);
  app.route('/api/kitchen-stations', kitchenStationsRouter);
  app.route('/api/floor-plan', floorPlanRouter);
  app.route('/api/client-error', clientErrorsRouter);
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
  app.route('/api/shifts', shiftsRouter);
  app.get('/api/subscriptions/invoices/:id/receipt', requireAuth(['owner', 'customer']), (c) => getInvoiceReceipt(c));
  app.route('/api/campaigns', campaignsRouter);
  app.use('/api/broadcast/*', requireAuth(['owner', 'staff']));
  app.route('/api/broadcast', broadcastRouter);
  app.route('/api/chat', chatRouter);

  // Analytics & Observability
  app.use('/api/analytics/*', requireAuth(['owner', 'staff']));
  app.route('/api/analytics', analyticsRouter);
  registerVitalsRoute(app);

  // External Service Proxies & Webhooks
  app.all('/api/reviews/*', (c) => reviewsRouter.fetch(new Request(c.req.raw.url.replace('/api/reviews', ''), c.req.raw), c.env, c.executionCtx));
  app.all('/api/contact/*', (c) => contactRouter.fetch(new Request(c.req.raw.url.replace('/api/contact', ''), c.req.raw), c.env));
  app.all('/api/webhooks/cal-booking/*', (c) => calBookingWebhookRouter.fetch(new Request(c.req.raw.url.replace('/api/webhooks/cal-booking', '/api/cal-booking-webhook'), c.req.raw), c.env, c.executionCtx));
  app.post('/api/webhooks/nowpayments', (c) => nowPaymentsIPN(c.req.raw, c.env));
  app.post('/api/webhooks/cal-booking', (c) => calBookingWebhookRouter.fetch(new Request(c.req.raw.url.replace('/api/webhooks/cal-booking', '/api/cal-booking-webhook'), { method: c.req.raw.method, headers: c.req.raw.headers, body: c.req.raw.body }), c.env, c.executionCtx));

  // Loyalty & Reports
  app.route('/api/loyalty/referral', referralRouter);
  app.route('/api/loyalty/birthday', birthdayRouter);
  app.route('/api/loyalty/checkin', checkinRouter);
  app.route('/api/loyalty', loyaltyRouter);
  app.route('/api/admin/loyalty', adminLoyaltyRouter);
  app.use('/api/reports/*', requireAuth(['owner', 'staff']));
  app.route('/api/reports', reportsRouter);

  // Inventory Items (domain-inventory)
  const inventoryItemsApp = new Hono<{ Bindings: Env }>();
  inventoryItemsApp.use('/*', requireAuth(['owner', 'staff', 'customer']));
  inventoryCRUD(inventoryItemsApp as any);
  inventoryTransactions(inventoryItemsApp as any);
  inventorySnapshots(inventoryItemsApp as any);
  app.route('/api/inventory/items', inventoryItemsApp);

  // Health & System
  app.get('/api/health', async (c) => {
    const checkDb = c.req.query('db') === '1';
    const result = await getHealth(c.env, checkDb);
    return c.json(result, (result.status === 'degraded' ? 503 : 200) as 200 | 503);
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
