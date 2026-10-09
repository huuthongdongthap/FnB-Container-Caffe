/**
 * Canonical Unified Orders Router
 * Single Authoritative Runtime Owner for /api/orders and /api/kds/orders.
 * Enforces strict route precedence: static literal routes precede parameterized paths.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { audit } from '../middleware/audit-log';
import { rateLimitMiddleware, ORDER_RATE_LIMIT } from '../middleware/rate-limit';

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
} from './openapi-orders-handlers/order-read-handlers';
import { handleGetOrderSummary } from './openapi-orders-handlers/order-summary-handlers';

import { handleCancelOrder } from './openapi-orders-handlers/order-cancel-handlers';
import { handleClaimOrder } from './openapi-orders-handlers/order-claim-handlers';

export const ordersUnifiedRouter = new Hono<{ Bindings: Env }>();

// ── 1. Static Literal Routes (NO PARAMETERS) ──
ordersUnifiedRouter.post('/guest-checkin', rateLimitMiddleware(ORDER_RATE_LIMIT), handleGuestCheckin);
ordersUnifiedRouter.post('/guest-checkout', handleGuestCheckout);

ordersUnifiedRouter.post('/sync', handleSyncOrders);
ordersUnifiedRouter.post('/split', handleSplitOrders);
ordersUnifiedRouter.get('/latest', handleLatestOrderTimestamp);

ordersUnifiedRouter.get('/kds', requireAuth(['owner', 'staff']), handleGetKdsOrders);
ordersUnifiedRouter.post('/checkout', requireAuth(['owner', 'staff']), audit('order_create_checkout'), handlePosCheckout);

ordersUnifiedRouter.get('/summary', requireAuth(['owner', 'manager', 'staff']), handleGetOrderSummary);

ordersUnifiedRouter.post('/', orderRateLimit, handleCreateOrder);
ordersUnifiedRouter.get('/', requireAuth(['owner', 'manager', 'staff', 'customer']), (c) => {
  if (c.req.path.startsWith('/api/kds/orders')) {
    return handleGetKdsOrders(c);
  }
  return handleListOrders(c);
});

// ── 2. Parameterized Routes with Sub-paths (/:id/...) ──
ordersUnifiedRouter.get('/:id/events', handleOrderStreamEvents);

ordersUnifiedRouter.patch('/:id/status', requireAuth(['owner', 'staff']), audit('order_status_change'), handleUpdateOrderStatus);
ordersUnifiedRouter.patch('/:id/mark-cod-paid', requireAuth(['owner']), audit('order_cod_paid'), handleMarkCodPaid);

ordersUnifiedRouter.post('/:id/cancel', requireAuth(['owner', 'manager', 'staff', 'customer']), handleCancelOrder);
ordersUnifiedRouter.post('/:id/claim', requireAuth(['owner', 'manager', 'staff', 'customer']), handleClaimOrder);

// ── 3. Parameterized Base Record Handlers (/:id) ──
ordersUnifiedRouter.get('/:id', requireAuth(['owner', 'manager', 'staff', 'customer']), handleGetOrderById);
ordersUnifiedRouter.patch('/:id', requireAuth(['owner', 'staff']), handleUpdateOrder);

export default ordersUnifiedRouter;
