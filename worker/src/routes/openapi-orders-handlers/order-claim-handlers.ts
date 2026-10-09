/**
 * Canonical Order Claim Handler
 * Allows an authenticated customer to explicitly and auditably claim a guest order.
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { claimGuestOrder } from '@aura/domain-customer';

export async function handleClaimOrder(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const id = c.req.param('id');
  const user = c.get('user');

  const result = await claimGuestOrder({
    db: db as any,
    orderId: id,
    actor: user,
  });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, (result.statusCode || 400) as any);
  }

  return c.json({
    success: true,
    data: {
      orderId: result.orderId,
      customerId: result.customerId,
      idempotent: result.idempotent ?? false,
    },
  });
}
