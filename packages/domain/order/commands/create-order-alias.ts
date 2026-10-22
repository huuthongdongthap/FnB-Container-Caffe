import { createOrder } from './create-order';
import type { OrderCreationActor } from '../policies/order-creation-scope';

/** Legacy writers translate their input, then share the exact same validation, prices and tenant boundary. */
export function createOrderFromAlias(
  request: Request, env: Record<string, unknown>, payload: Record<string, unknown>,
  ctx?: { waitUntil?: (promise: Promise<unknown>) => void }, actor?: OrderCreationActor,
) {
  const headers = new Headers(request.headers);
  headers.set('Content-Type', 'application/json');
  const items = Array.isArray(payload.items) ? payload.items.map(value => {
    const item = value as Record<string, unknown>;
    return {
      ...item,
      product_id: item.product_id || item.productId || item.menuItemId || item.item_id || item.id,
      name: item.name || 'Item',
      quantity: item.quantity ?? item.qty,
      notes: item.notes ?? item.note,
    };
  }) : payload.items;
  return createOrder(new Request(request.url, {
    method: 'POST', headers,
    body: JSON.stringify({ ...payload, total: payload.total ?? 1000, items }),
  }), env, ctx, actor);
}
