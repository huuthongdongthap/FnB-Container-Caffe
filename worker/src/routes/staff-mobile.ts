/**
 * Staff Mobile Router
 * Authentication, device management, KDS, notifications, tables, and order creation.
 */

import { Hono } from 'hono';
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
import { getNotifications, markNotificationRead, subscribePush } from './notifications-mobile';
import type { Env } from '../types/env';

export const staffMobileRouter = new Hono<{ Bindings: Env }>();

// ── Public: device login + token refresh + me ──
const mobilePublic = new Hono<{ Bindings: Env }>();
mobilePublic.post('/login', staffMobileLogin);
mobilePublic.post('/refresh', staffTokenRefresh);
mobilePublic.get('/me', (c) => getCurrentUser(c.req.raw, c.env));
staffMobileRouter.route('/', mobilePublic);

// ── Protected: device management (owner|manager|admin) ──
staffMobileRouter.use('/devices', requireStaff(['owner', 'manager', 'admin']));
staffMobileRouter.use('/devices/*', requireStaff(['owner', 'manager', 'admin']));
const mobileDevices = new Hono<{ Bindings: Env }>();
mobileDevices.use('*', requireStaff(['owner', 'manager', 'admin']));
mobileDevices.post('/register', registerStaffDevice);
mobileDevices.delete('/:device_id', revokeStaffDevice);
mobileDevices.get('/', listStaffDevices);
staffMobileRouter.route('/devices', mobileDevices);

// ── Protected: KDS ──
staffMobileRouter.use('/kds/*', requireStaff(['owner', 'manager', 'staff', 'kitchen', 'barista', 'chef', 'admin']));
const mobileKds = new Hono<{ Bindings: Env }>();
mobileKds.use('*', requireStaff(['owner', 'manager', 'staff', 'kitchen', 'barista', 'chef', 'admin']));
mobileKds.get('/orders', getKdsMobile);
mobileKds.patch('/orders/:id/status', updateKdsStatus);
staffMobileRouter.route('/kds', mobileKds);

// ── Protected: Notifications (mobile PWA) ──
staffMobileRouter.use('/notifications', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
staffMobileRouter.use('/notifications/*', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
const mobileNotifs = new Hono<{ Bindings: Env }>();
mobileNotifs.use('*', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
mobileNotifs.get('/', getNotifications);
mobileNotifs.post('/subscribe', subscribePush);
mobileNotifs.post('/:id/read', markNotificationRead);
staffMobileRouter.route('/notifications', mobileNotifs);

// ── Protected: Tables ──
staffMobileRouter.use('/tables', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
staffMobileRouter.use('/tables/*', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
const mobileTables = new Hono<{ Bindings: Env }>();
mobileTables.use('*', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
mobileTables.get('/', getTablesMobile);
mobileTables.patch('/:id', updateTableStatus);
staffMobileRouter.route('/tables', mobileTables);

// ── Protected: Orders ──
staffMobileRouter.use('/orders', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
staffMobileRouter.use('/orders/*', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
const mobileOrders = new Hono<{ Bindings: Env }>();
mobileOrders.use('*', requireStaff(['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin']));
mobileOrders.get('/', getOrdersMobile);
mobileOrders.post('/', createOrderMobile);
mobileOrders.get('/:id', getOrderDetail);
staffMobileRouter.route('/orders', mobileOrders);
