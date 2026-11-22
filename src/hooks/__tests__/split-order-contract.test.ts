import { describe, expect, it } from 'vitest';
import { buildSplitOrders, computeSplits } from '../split-bill-helpers';
import { calculateOrderSnapshot, type D1Like } from '../../../packages/domain/order/policies/order-snapshot';

const item = { id: 'tc001-extra_shot', productId: 'tc001', name: 'Tea', price: 1, quantity: 2, modifiers: ['extra_shot'], notes: 'Less ice' };
function payload(modifiers = item.modifiers) {
  return buildSplitOrders(computeSplits([{ ...item, modifiers }], { [item.id]: 0 }, 1), {
    customer_name: 'Guest', customer_phone: '0900000000', payment_method: 'cod',
  }, '05')[0]!;
}

// Database boundary fixture; catalog resolution, modifier validation and pricing run unchanged.
const db: D1Like = {
  prepare(sql) {
    return { bind(...args) {
      return {
        async first<T>(): Promise<T | null> {
          let row: unknown = null;
          if (sql.includes('FROM menu_items WHERE id = ?') && args[0] === 'tc001') row = { id: 'tc001', name: 'Canonical Tea', price: 25000, available: 1, category: 'tea' };
          if (sql.includes('FROM modifier_choices WHERE id = ?') && args[0] === 'extra_shot') row = { id: 'extra_shot', group_id: 'extras', name: 'Extra Shot', price_delta: 5000 };
          if (sql.includes('FROM modifier_groups WHERE id = ?')) row = { id: 'extras', name: 'Extras', type: 'multiple', required: 0, is_active: 1 };
          if (sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) row = { product_id: args[0], group_id: args[1] };
          return row as T | null;
        },
        async all<T>() { return { results: [] as T[] }; },
        async run() { return { success: true }; },
      };
    } };
  },
};

describe('split order catalog contract', () => {
  it('preserves canonical identity, modifiers, quantity and item notes', () => {
    expect(payload().items[0]).toMatchObject({ id: item.id, productId: 'tc001', modifiers: ['extra_shot'], quantity: 2, notes: 'Less ice' });
  });
  it('reprices customized items using the server catalog rather than client prices', async () => {
    const snapshot = await calculateOrderSnapshot(db, payload());
    expect(snapshot.rejected).toBeNull();
    expect(snapshot.subtotal).toBe(60000);
    expect(snapshot.items[0]).toMatchObject({ menuItemId: 'tc001', price: 30000, quantity: 2, notes: 'Less ice', modifiers: [expect.objectContaining({ id: 'extra_shot', price_delta: 5000 })] });
  });
  it('retains invalid modifier input so the server rejects it instead of silently dropping it', async () => {
    const snapshot = await calculateOrderSnapshot(db, payload(['unknown-choice']));
    expect(snapshot.rejected).not.toBeNull();
    expect(snapshot.items).toEqual([]);
  });
  it('supports uncustomized legacy items without a separate productId', () => {
    const splits = computeSplits([{ id: 'tc001', name: 'Tea', price: 25000, quantity: 1 }], { tc001: 0 }, 1);
    const order = buildSplitOrders(splits, { customer_name: 'Guest', customer_phone: '', payment_method: 'cod' }, '05')[0]!;
    expect(order.items[0]).toMatchObject({ productId: 'tc001', modifiers: [] });
  });
});
