import type { Hono, Context } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { createOrderFromAlias } from '../../../../packages/domain/order/commands/create-order-alias';

export async function handlePosCheckout(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<Record<string, unknown>>();
  let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
  try { ctx = c.executionCtx; } catch { /* no execution context in unit tests */ }
  return createOrderFromAlias(c.req.raw, c.env, {
    ...body,
    customer_name: body.customer_name || 'Walk-in',
    customer_phone: body.customer_phone || '0000000000',
    payment_method: body.payment_method || 'cod',
    order_type: body.order_type || (body.table_id ? 'dine_in' : 'takeaway'),
  }, ctx, c.get('user'));
}

export function registerCheckoutHandlers(app: Hono<{ Bindings: Env }>) {
  app.post('/checkout', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), audit('order_create_checkout'), handlePosCheckout);
}
