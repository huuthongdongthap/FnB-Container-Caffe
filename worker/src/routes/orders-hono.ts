/**
 * Orders (Hono) Routes — /api/orders
 * Re-exported from modular orders-hono-handlers/
 * - kds-handlers.ts: KDS orders list, order status change, mark-cod-paid
 * - checkout-handlers.ts: POS/KDS staff checkout, inventory deduction, ERPNext sync, metrics
 * - guest-handlers.ts: QR table checkin, guest checkout
 * - query-handlers.ts: Order listings, my-orders, single order lookup
 * - types.ts: Shared order interfaces and ID generator
 */

import { ordersRouter, ALLOWED_KDS_STATUSES, makeOrderId } from './orders-hono-handlers';

export { ordersRouter, ALLOWED_KDS_STATUSES, makeOrderId } from './orders-hono-handlers';
export type { OrderItem, OrderRecord, KdsOrder } from './orders-hono-handlers';
export default ordersRouter;
