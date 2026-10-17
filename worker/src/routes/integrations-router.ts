/**
 * External Integration Routers (ERPNext, Mautic, Mixpost, Zalo, Home Assistant, TastyIgniter, Frigate)
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { handleErpnextRequest } from './erpnext';
import { handleErpnextPosRequest } from './erpnext-pos';
import { handleErpnextInvoicesRequest } from './erpnext-invoices';
import { erpnextSyncRoutes } from './erpnext-sync';
import { customerRoutes } from './erpnext/customers';
import { vendorRoutes } from './erpnext/vendors';
import { expenseRoutes } from './erpnext/expenses';
import { handleMauticBridgeRequest } from './mautic-bridge';
import { handleMixpostRequest } from './mixpost';
import { createHARouter } from './homeassistant';
import { createTIRoutes } from './integrations/tastyigniter';
import { createFrigateRoutes } from './integrations/frigate';
import { createWifiRoutes } from './wifi';
import type { Env } from '../types/env';

export function registerIntegrationRoutes(app: Hono<{ Bindings: Env }>): void {
  // ERPNext Integration (register specific sub-routes before catch-all /api/erpnext/*)
  app.use('/api/erpnext/*', requireAuth(['owner', 'manager', 'staff', 'admin']));
  erpnextSyncRoutes(app);
  customerRoutes(app);
  vendorRoutes(app);
  expenseRoutes(app);
  app.all('/api/erpnext/*', (c) => handleErpnextRequest(c.req.raw, c.env as unknown as Record<string, unknown>));
  app.use('/api/erpnext-pos/*', requireAuth(['owner', 'manager', 'staff', 'admin']));
  app.all('/api/erpnext-pos/*', (c) => handleErpnextPosRequest(c.req.raw, c.env as unknown as Record<string, unknown>));
  app.use('/api/erpnext-invoices/*', requireAuth(['owner', 'manager', 'staff', 'admin']));
  app.all('/api/erpnext-invoices/*', (c) => handleErpnextInvoicesRequest(c.req.raw, c.env as unknown as Record<string, unknown>));
  app.get('/api/public/products/:productId/availability', (c) =>
    handleErpnextPosRequest(new Request(`https://internal/api/erpnext-pos/products/${c.req.param('productId')}/availability`, c.req.raw), c.env as unknown as Record<string, unknown>)
  );

  // Mixpost, Mautic, Zalo, Integrations
  app.use('/api/mixpost/*', requireAuth(['owner', 'manager', 'staff', 'admin']));
  app.all('/api/mixpost/*', (c) => handleMixpostRequest(c.req.raw, c.env as unknown as Record<string, unknown>));
  app.use('/api/mautic-bridge/*', requireAuth(['owner', 'manager', 'admin']));
  app.all('/api/mautic-bridge/*', (c) => handleMauticBridgeRequest(c.req.raw, c.env as unknown as Record<string, unknown>));
  app.all('/api/zalo/*', requireAuth(['owner', 'manager', 'admin']), async (c) => {
    const { handleZaloRequest } = await import('./zalo');
    return handleZaloRequest(c.req.raw, c.env as unknown as Record<string, unknown>);
  });
  app.route('/api/ha', createHARouter());
  app.route('/api/integrations/tastyigniter', createTIRoutes());
  app.use('/api/integrations/frigate/*', requireAuth(['owner', 'manager', 'staff', 'admin']));
  app.route('/api/integrations/frigate', createFrigateRoutes());
  app.route('/api/wifi', createWifiRoutes());
}
