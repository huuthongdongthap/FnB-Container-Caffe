import { calculateOrderSnapshot } from './order-snapshot';
import type { D1Like, OrderSnapshotInput } from './order-snapshot-types';

/** Matches the existing storefront policy: delivery 15k, free from two items; no service fee. */
export async function calculateCheckoutSnapshot(db: D1Like, input: OrderSnapshotInput) {
  const snapshot = await calculateOrderSnapshot(db, { ...input, shipping_fee: 0, discount: 0, service_fee: 0 });
  if (snapshot.rejected) return snapshot;
  const quantity = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
  snapshot.shipping_fee = (input.order_type || input.channel) === 'delivery' && quantity < 2 ? 15_000 : 0;
  snapshot.total = snapshot.subtotal + snapshot.shipping_fee + snapshot.tip_amount;
  return snapshot;
}
