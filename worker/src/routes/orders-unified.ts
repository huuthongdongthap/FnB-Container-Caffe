/**
 * Canonical Unified Orders Router
 * Single Authoritative Runtime Owner for /api/orders and /api/kds/orders.
 * Enforces strict route precedence: static literal routes precede parameterized paths.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import { rateLimitMiddleware, ORDER_RATE_LIMIT, POS_CHECKOUT_RATE_LIMIT } from '../middleware/rate-limit';

import {
  orderRateLimit,
  handleCreateOrder,
  handleSyncOrders,
  handleSplitOrders,
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

ordersUnifiedRouter.post('/sync', orderRateLimit, handleSyncOrders);
ordersUnifiedRouter.post('/split', orderRateLimit, handleSplitOrders);
ordersUnifiedRouter.get('/latest', handleLatestOrderTimestamp);

ordersUnifiedRouter.get('/kds', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef']), handleGetKdsOrders);
// POS checkout is staff-only, but a stuck till retrying in a loop must still be
// throttled before it reaches order creation.
ordersUnifiedRouter.post('/checkout', rateLimitMiddleware(POS_CHECKOUT_RATE_LIMIT), requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), audit('order_create_checkout'), handlePosCheckout);

ordersUnifiedRouter.get('/summary', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), handleGetOrderSummary);

ordersUnifiedRouter.post('/', orderRateLimit, handleCreateOrder);
ordersUnifiedRouter.get('/', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef', 'customer']), (c) => {
  if (c.req.path.startsWith('/api/kds/orders')) {
    return handleGetKdsOrders(c);
  }
  return handleListOrders(c);
});

// ── 2. Parameterized Routes with Sub-paths (/:id/...) ──
// Tracking links are shared, so these stay reachable without credentials — but
// optionalAuth populates c.get('user') when a token is present so the handler's
// ownership check can tell a returning customer from an anonymous guest.
ordersUnifiedRouter.get('/:id/events', optionalAuth(), handleOrderStreamEvents);
ordersUnifiedRouter.get('/:id/track', optionalAuth(), handleTrackOrder);

ordersUnifiedRouter.patch('/:id/status', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef']), audit('order_status_change'), handleUpdateOrderStatus);
ordersUnifiedRouter.patch('/:id/mark-cod-paid', requireAuth(['owner', 'manager', 'cashier', 'admin']), audit('order_cod_paid'), handleMarkCodPaid);

ordersUnifiedRouter.post('/:id/cancel', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'customer']), handleCancelOrder);
ordersUnifiedRouter.post('/:id/claim', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'customer']), handleClaimOrder);

// ── 3. Parameterized Base Record Handlers (/:id) ──
ordersUnifiedRouter.get('/:id', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef', 'customer']), handleGetOrderById);
ordersUnifiedRouter.patch('/:id', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef']), handleUpdateOrder);

export default ordersUnifiedRouter;
