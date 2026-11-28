/**
 * Canonical Unified Orders Router
 * Single Authoritative Runtime Owner for /api/orders and /api/kds/orders.
 * Enforces strict route precedence: static literal routes precede parameterized paths.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import { rateLimitMiddleware, ORDER_RATE_LIMIT, ORDER_TRACK_RATE_LIMIT, POS_CHECKOUT_RATE_LIMIT } from '../middleware/rate-limit';

import {
  orderRateLimit,
  handleCreateOrder,
  handleSyncOrders,
  handleSplitOrders,
  LATEST_ORDER_ROLES,
  handleLatestOrderTimestamp,
  handleUpdateOrder,
} from './orders-core';

import { handleOrderStreamEvents } from './order-stream';

import {
  handleGuestCheckin,
  handleGuestCheckout,
} from './orders-hono-handlers/guest-handlers';

import {
  handleGetKdsOrders,
  handleGetKdsRecentOrders,
  handleRecallKdsOrder,
  COD_COLLECTION_ROLES,
  KDS_PREP_ROLES,
  KDS_ROLES,
  handleUpdateOrderStatus,
  handleMarkCodPaid,
} from './orders-hono-handlers/kds-handlers';
import { handlePosCheckout } from './orders-hono-handlers/checkout-handlers';

import {
  handleListOrders,
  handleGetOrderById,
  handleTrackOrder,
} from './openapi-orders-handlers/order-read-handlers';
import { handleGetOrderSummary } from './openapi-orders-handlers/order-summary-handlers';

import { handleCancelOrder } from './openapi-orders-handlers/order-cancel-handlers';
import { handleClaimOrder } from './openapi-orders-handlers/order-claim-handlers';

export const ordersUnifiedRouter = new Hono<{ Bindings: Env }>();

// ── 1. Static Literal Routes (NO PARAMETERS) ──
ordersUnifiedRouter.post('/guest-checkin', rateLimitMiddleware(ORDER_RATE_LIMIT), handleGuestCheckin);
ordersUnifiedRouter.post('/guest-checkout', rateLimitMiddleware(ORDER_RATE_LIMIT), handleGuestCheckout);

const SPLIT_ORDER_ROLES = ['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier'];

ordersUnifiedRouter.post('/sync', orderRateLimit, handleSyncOrders);
ordersUnifiedRouter.post('/split', orderRateLimit, requireAuth(SPLIT_ORDER_ROLES), handleSplitOrders);
ordersUnifiedRouter.get('/latest', requireAuth(LATEST_ORDER_ROLES), handleLatestOrderTimestamp);

ordersUnifiedRouter.get('/kds/recent', requireAuth(KDS_ROLES), handleGetKdsRecentOrders);
ordersUnifiedRouter.get('/kds', requireAuth(KDS_ROLES), handleGetKdsOrders);
// POS checkout is staff-only, but a stuck till retrying in a loop must still be
// throttled before it reaches order creation.
ordersUnifiedRouter.post('/checkout', rateLimitMiddleware(POS_CHECKOUT_RATE_LIMIT), requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), audit('order_create_checkout'), handlePosCheckout);

ordersUnifiedRouter.get('/summary', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), handleGetOrderSummary);

ordersUnifiedRouter.post('/', orderRateLimit, handleCreateOrder);
ordersUnifiedRouter.get('/', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef', 'shipper', 'rider', 'customer']), handleListOrders);

// ── 2. Parameterized Routes with Sub-paths (/:id/...) ──
// Tracking links are shared, so these stay reachable without credentials — but
// rate limiting curbs brute-force enumeration and optionalAuth populates c.get('user')
// when a token is present so the handler's ownership check can tell a returning
// customer from an anonymous guest.
ordersUnifiedRouter.get('/:id/events', rateLimitMiddleware(ORDER_TRACK_RATE_LIMIT), optionalAuth(), handleOrderStreamEvents);
ordersUnifiedRouter.get('/:id/track', rateLimitMiddleware(ORDER_TRACK_RATE_LIMIT), optionalAuth(), handleTrackOrder);

ordersUnifiedRouter.patch('/:id/status', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef', 'shipper', 'rider']), audit('order_status_change'), handleUpdateOrderStatus);
ordersUnifiedRouter.patch('/:id/mark-cod-paid', requireAuth(COD_COLLECTION_ROLES), audit('order_cod_paid'), handleMarkCodPaid);
ordersUnifiedRouter.post('/:id/recall', requireAuth(KDS_PREP_ROLES), audit('order_status_change'), handleRecallKdsOrder);

const ORDER_CANCEL_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'shipper', 'rider', 'customer'];
ordersUnifiedRouter.post(
  '/:id/cancel',
  async (c, next) => {
    const hasOrderToken = Boolean(
      (c.req.header('X-Order-Token') || c.req.header('x-order-token') || c.req.query('order_token') || '').trim()
    );
    const hasAuthHeader = Boolean((c.req.header('Authorization') || c.req.header('authorization') || '').trim());
    if (hasOrderToken && !hasAuthHeader) {
      let authPassed = false;
      const authResult = await optionalAuth()(c, async () => {
        authPassed = true;
      });
      if (!authPassed) {
        return authResult;
      }
      const user = c.get('user') as { role?: string } | undefined;
      if (user?.role && !ORDER_CANCEL_ROLES.includes(String(user.role).toLowerCase())) {
        return c.json({ success: false, error: 'Insufficient permissions to cancel order' }, 403);
      }
      await next();
      return;
    }
    return requireAuth(ORDER_CANCEL_ROLES)(c, next);
  },
  handleCancelOrder,
);
ordersUnifiedRouter.post('/:id/claim', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'customer']), handleClaimOrder);

// ── 3. Parameterized Base Record Handlers (/:id) ──
const ORDER_DETAIL_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef', 'shipper', 'rider', 'customer'];
ordersUnifiedRouter.get(
  '/:id',
  async (c, next) => {
    const hasOrderToken = Boolean(
      (c.req.header('X-Order-Token') || c.req.header('x-order-token') || c.req.query('order_token') || '').trim()
    );
    if (hasOrderToken) {
      return optionalAuth()(c, next);
    }
    return requireAuth(ORDER_DETAIL_ROLES)(c, next);
  },
  handleGetOrderById,
);
ordersUnifiedRouter.patch('/:id', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef', 'shipper', 'rider']), handleUpdateOrder);

export default ordersUnifiedRouter;
