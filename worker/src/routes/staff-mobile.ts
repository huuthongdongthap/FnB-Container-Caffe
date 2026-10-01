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

// ── Protected: device management (owner|manager only) ──
staffMobileRouter.use('/devices/*', requireStaff(['owner', 'manager']));
const mobileDevices = new Hono<{ Bindings: Env }>();
mobileDevices.post('/register', registerStaffDevice);
mobileDevices.delete('/:device_id', revokeStaffDevice);
mobileDevices.get('/', listStaffDevices);
staffMobileRouter.route('/devices', mobileDevices);

// ── Protected: KDS ──
staffMobileRouter.use('/kds/orders/:id/status', requireStaff(['owner', 'manager', 'staff']));
const mobileKds = new Hono<{ Bindings: Env }>();
mobileKds.get('/orders', getKdsMobile);
mobileKds.patch('/orders/:id/status', updateKdsStatus);
staffMobileRouter.route('/kds', mobileKds);

// ── Protected: Notifications (mobile PWA) ──
staffMobileRouter.use('/notifications/:id/read', requireStaff(['owner', 'manager', 'staff', 'waiter']));
const mobileNotifs = new Hono<{ Bindings: Env }>();
mobileNotifs.get('/', getNotifications);
mobileNotifs.post('/subscribe', subscribePush);
mobileNotifs.post('/:id/read', markNotificationRead);
staffMobileRouter.route('/notifications', mobileNotifs);

// ── Protected: Tables ──
staffMobileRouter.use('/tables/:id', requireStaff(['owner', 'manager', 'staff', 'waiter']));
const mobileTables = new Hono<{ Bindings: Env }>();
mobileTables.get('/', getTablesMobile);
mobileTables.patch('/:id', updateTableStatus);
staffMobileRouter.route('/tables', mobileTables);

// ── Protected: Orders ──
staffMobileRouter.use('/orders', requireStaff(['owner', 'manager', 'staff', 'waiter']));
const mobileOrders = new Hono<{ Bindings: Env }>();
mobileOrders.get('/', getOrdersMobile);
mobileOrders.post('/', createOrderMobile);
mobileOrders.get('/:id', getOrderDetail);
staffMobileRouter.route('/orders', mobileOrders);
