/**
 * Staff Mobile Router
 * Authentication, device management, KDS, notifications, tables, and order creation.
 */

import { Hono } from 'hono';
import { errorResponse } from '../middleware/cors';
import { requireStaff } from '../middleware/staff-auth';
import { getCurrentUser } from './auth';
import {
  staffMobileLogin,
  staffTokenRefresh,
  registerStaffDevice,
  revokeStaffDevice,
  listStaffDevices,
} from '@aura/domain-staff';
import { getKdsMobile, updateKdsStatus } from '@aura/domain-kitchen';
import { getTablesMobile, updateTableStatus } from './tables-mobile';
import { getOrdersMobile, createOrderMobile, getOrderDetail } from './orders-mobile';
import { sopMobileRouter } from './sop-mobile';
import { getNotifications, markNotificationRead, subscribePush } from './notifications-mobile';
import type { Env } from '../types/env';

export const staffMobileRouter = new Hono<{ Bindings: Env }>();

// ── Public: device login + token refresh + me ──
const ALL_STAFF_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'admin', 'shipper'];

const enforceMobileTenantScope = async (c: any, next: () => Promise<void>) => {
  const candidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return errorResponse('Cross-tenant access denied', 403);
  }
  const requested = candidates[0] || '';
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user?.id === 'local-staff') {
    await next();
    return;
  }
  if (user && requested) {
    const rawCallerTenant = user.tenantId ?? user.tenant_id;
    const callerTenant = typeof rawCallerTenant === 'string' && rawCallerTenant.trim() ? rawCallerTenant.trim() : 'default';
    const isHq =
      (user.role === 'owner' || user.role === 'admin') &&
      (callerTenant.toLowerCase() === 'hq' || callerTenant === '*');
    if (
      !isHq &&
      (requested === '*' ||
        requested.toLowerCase() === 'hq' ||
        requested !== callerTenant)
    ) {
      return errorResponse('Cross-tenant access denied', 403);
    }
  }
  await next();
};

const mobilePublic = new Hono<{ Bindings: Env }>();
mobilePublic.post('/login', enforceMobileTenantScope, staffMobileLogin);
mobilePublic.post('/refresh', enforceMobileTenantScope, staffTokenRefresh);
mobilePublic.get('/me', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope, (c) => getCurrentUser(c.req.raw, c.env));
staffMobileRouter.route('/', mobilePublic);

// ── Protected: device management (owner|manager|admin) ──
staffMobileRouter.use('/devices', requireStaff(['owner', 'manager', 'admin']), enforceMobileTenantScope);
staffMobileRouter.use('/devices/*', requireStaff(['owner', 'manager', 'admin']), enforceMobileTenantScope);
const mobileDevices = new Hono<{ Bindings: Env }>();
mobileDevices.use('*', requireStaff(['owner', 'manager', 'admin']), enforceMobileTenantScope);
mobileDevices.post('/register', registerStaffDevice);
mobileDevices.delete('/:device_id', revokeStaffDevice);
mobileDevices.get('/', listStaffDevices);
staffMobileRouter.route('/devices', mobileDevices);

// ── Protected: KDS ──
staffMobileRouter.use('/kds/*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
const mobileKds = new Hono<{ Bindings: Env }>();
mobileKds.use('*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
mobileKds.get('/orders', getKdsMobile);
mobileKds.patch('/orders/:id/status', updateKdsStatus);
staffMobileRouter.route('/kds', mobileKds);

// ── Protected: Notifications (mobile PWA) ──
staffMobileRouter.use('/notifications', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
staffMobileRouter.use('/notifications/*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
const mobileNotifs = new Hono<{ Bindings: Env }>();
mobileNotifs.use('*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
mobileNotifs.get('/', getNotifications);
mobileNotifs.post('/subscribe', subscribePush);
mobileNotifs.post('/:id/read', markNotificationRead);
staffMobileRouter.route('/notifications', mobileNotifs);

// ── Protected: Tables ──
staffMobileRouter.use('/tables', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
staffMobileRouter.use('/tables/*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
const mobileTables = new Hono<{ Bindings: Env }>();
mobileTables.use('*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
mobileTables.get('/', getTablesMobile);
mobileTables.patch('/:id', updateTableStatus);
staffMobileRouter.route('/tables', mobileTables);

// ── Protected: Orders ──
staffMobileRouter.use('/orders', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
staffMobileRouter.use('/orders/*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
const mobileOrders = new Hono<{ Bindings: Env }>();
mobileOrders.use('*', requireStaff(ALL_STAFF_ROLES), enforceMobileTenantScope);
mobileOrders.get('/', getOrdersMobile);
mobileOrders.post('/', createOrderMobile);
mobileOrders.get('/:id', getOrderDetail);
staffMobileRouter.route('/orders', mobileOrders);

// ── Protected: SOP checklists (start/tick/complete/abandon) ──
staffMobileRouter.route('/sop', sopMobileRouter);
