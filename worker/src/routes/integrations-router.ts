/**
 * External Integration Routers (ERPNext, Mautic, Mixpost, Zalo, Home Assistant, TastyIgniter, Frigate)
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import { handleErpnextRequest } from './erpnext';
import { handleErpnextPosRequest } from './erpnext-pos';
import { handleErpnextInvoicesRequest } from './erpnext-invoices';
import { erpnextSyncRoutes } from './erpnext-sync';
import { customerRoutes } from './erpnext/customers';
import { vendorRoutes } from './erpnext/vendors';
import { expenseRoutes } from './erpnext/expenses';
import { handleMauticBridgeRequest } from './mautic-bridge';
import { handleMixpostRequest, mixpostRouter } from './mixpost';
import { createHARouter } from './homeassistant';
import { createTIRoutes } from './integrations/tastyigniter';
import { createFrigateRoutes } from './integrations/frigate';
import { createWifiRoutes } from './wifi';
import type { Env } from '../types/env';

export function registerIntegrationRoutes(app: Hono<{ Bindings: Env }>): void {
  // ERPNext Integration (register specific sub-routes before catch-all /api/erpnext/*)
  app.use('/api/erpnext/*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']));
  erpnextSyncRoutes(app);
  customerRoutes(app);
  vendorRoutes(app);
  expenseRoutes(app);
  app.all('/api/erpnext/*', (c) => handleErpnextRequest(c.req.raw, c.env as unknown as Record<string, unknown>, getTenantId(c)));
  const erpnextPosAuth = requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']);
  app.use('/api/erpnext-pos/*', async (c, next) => {
    if (c.req.path === '/api/erpnext-pos/webhook' || c.req.path.endsWith('/erpnext-pos/webhook')) {
      return next();
    }
    return erpnextPosAuth(c, next);
  });
  app.all('/api/erpnext-pos/*', (c) =>
    handleErpnextPosRequest(
      c.req.raw,
      c.env as unknown as Record<string, unknown>,
      c.get('user') ? getTenantId(c) : undefined,
    )
  );
  app.use('/api/erpnext-invoices/*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']));
  app.all('/api/erpnext-invoices/*', (c) => handleErpnextInvoicesRequest(c.req.raw, c.env as unknown as Record<string, unknown>, getTenantId(c)));
  app.get('/api/public/products/:productId/availability', (c) =>
    handleErpnextPosRequest(new Request(`https://internal/api/erpnext-pos/products/${c.req.param('productId')}/availability`, c.req.raw), c.env as unknown as Record<string, unknown>, getTenantId(c))
  );

  // Mixpost, Mautic, Zalo, Integrations
  app.use('/api/mixpost/*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']));
  app.route('/api/mixpost', mixpostRouter as unknown as Hono<{ Bindings: Env }>);
  app.all('/api/mixpost/*', (c) => handleMixpostRequest(c.req.raw, c.env as unknown as Record<string, unknown>, getTenantId(c)));
  app.use('/api/mautic-bridge/*', requireAuth(['owner', 'manager', 'supervisor', 'admin']));
  app.all('/api/mautic-bridge/*', (c) => handleMauticBridgeRequest(c.req.raw, c.env as unknown as Record<string, unknown>, getTenantId(c)));
  app.all('/api/zalo/*', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async (c) => {
    const { handleZaloRequest } = await import('./zalo');
    return handleZaloRequest(c.req.raw, c.env as unknown as Record<string, unknown>, getTenantId(c));
  });
  app.route('/api/ha', createHARouter());
  app.route('/api/integrations/tastyigniter', createTIRoutes());
  app.use('/api/integrations/frigate/*', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']));
  app.route('/api/integrations/frigate', createFrigateRoutes());
  app.route('/api/wifi', createWifiRoutes());
}
