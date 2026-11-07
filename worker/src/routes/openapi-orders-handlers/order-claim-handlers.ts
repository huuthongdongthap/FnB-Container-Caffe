/**
 * Canonical Order Claim Handler
 * Allows an authenticated customer to explicitly and auditably claim a guest order.
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { getDatabase } from '../../lib/db';
import { claimGuestOrder } from '@aura/domain-customer';
import { resolveOpenApiOrdersTenant } from './helpers';

export async function handleClaimOrder(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'write');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const db = getDatabase(c);
  const id = c.req.param('id')!;
  const user = c.get('user');

  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const verificationType =
    typeof body.verificationType === 'string'
      ? body.verificationType
      : typeof body.verification_type === 'string'
        ? body.verification_type
        : undefined;
  const verificationValue =
    typeof body.verificationValue === 'string'
      ? body.verificationValue
      : typeof body.verification_value === 'string'
        ? body.verification_value
        : undefined;
  const phone =
    typeof body.phone === 'string'
      ? body.phone
      : typeof body.customer_phone === 'string'
        ? body.customer_phone
        : typeof body.customerPhone === 'string'
          ? body.customerPhone
          : undefined;
  const tableId =
    typeof body.table_id === 'string'
      ? body.table_id
      : typeof body.tableId === 'string'
        ? body.tableId
        : undefined;
  const orderToken =
    (typeof body.order_token === 'string'
      ? body.order_token
      : typeof body.orderToken === 'string'
        ? body.orderToken
        : typeof body.token === 'string'
          ? body.token
          : undefined) ||
    c.req.header('x-order-token') ||
    c.req.header('X-Order-Token') ||
    c.req.query('order_token') ||
    undefined;

  const result = await claimGuestOrder({
    db: db as any,
    orderId: id,
    actor: user,
    tenantId: tenantCheck.tenantId,
    verificationType,
    verificationValue,
    phone,
    tableId,
    orderToken,
    requireVerification: true,
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
