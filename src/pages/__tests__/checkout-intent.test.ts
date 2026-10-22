import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHECKOUT_INTENT_KEY, acknowledgeCheckoutOrder, clearCheckoutIntent, getCheckoutIntent, rememberCheckoutOrder } from '../checkout-intent';

const payload = { items: [{ product_id: 'coffee', quantity: 1 }], payment_method: 'payos', customer_phone: '0901234567' };
beforeEach(() => { clearCheckoutIntent(); sessionStorage.clear(); });

describe('Checkout intent identity and retry persistence', () => {
  it('retains the same key before an order creation response arrives', async () => {
    const first = await getCheckoutIntent(payload, 'guest:default');
    expect(await getCheckoutIntent(payload, 'guest:default')).toEqual(first);
    expect(first.key).toMatch(/^[\da-f-]{36}$/);
    expect(sessionStorage.getItem(CHECKOUT_INTENT_KEY)).not.toContain('0901234567');
  });
  it('survives module reload with the same acknowledged order and server total', async () => {
    const intent = await getCheckoutIntent(payload, 'guest:default');
    rememberCheckoutOrder(intent, { id: 'ORD_ONE', total: 20000 });
    vi.resetModules();
    const reloaded = await import('../checkout-intent');
    expect(await reloaded.getCheckoutIntent(payload, 'guest:default')).toMatchObject({ key: intent.key, order: { id: 'ORD_ONE', total: 20000 } });
    reloaded.clearCheckoutIntent();
  });
  it('rotates for changed payload or signed identity/tenant', async () => {
    const initial = await getCheckoutIntent(payload, 'guest:default');
    const changed = await getCheckoutIntent({ ...payload, notes: 'No sugar' }, 'guest:default');
    const newUser = await getCheckoutIntent({ ...payload, notes: 'No sugar' }, 'user-2:cafe-b');
    expect(changed.key).not.toBe(initial.key); expect(newUser.key).not.toBe(changed.key);
  });
  it('acknowledging an old request cannot overwrite a newer checkout', async () => {
    const old = await getCheckoutIntent(payload, 'guest:default');
    const current = await getCheckoutIntent({ ...payload, notes: 'New intent' }, 'guest:default');
    rememberCheckoutOrder(old, { id: 'OLD', total: 20000 }); clearCheckoutIntent(old.key);
    expect(await getCheckoutIntent({ ...payload, notes: 'New intent' }, 'guest:default')).toEqual(current);
  });
  it('only clears the matching checkout when its confirmation is acknowledged', async () => {
    const intent = await getCheckoutIntent(payload, 'guest:default'); rememberCheckoutOrder(intent, { id: 'ORD_ONE', total: 20000 });
    acknowledgeCheckoutOrder('OTHER'); expect(await getCheckoutIntent(payload, 'guest:default')).toMatchObject({ key: intent.key });
    acknowledgeCheckoutOrder('ORD_ONE'); expect((await getCheckoutIntent(payload, 'guest:default')).key).not.toBe(intent.key);
  });

});
