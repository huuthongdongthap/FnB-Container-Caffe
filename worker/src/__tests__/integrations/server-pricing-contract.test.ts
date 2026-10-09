import { describe, it, expect } from 'vitest';
import { calculateOrderSnapshot } from '@aura/domain-order';
import { resolveServerProductPrice, resolveItemPrice } from '@aura/domain-catalog';
import { createPricingMockDB } from './server-pricing-test-helpers';

describe('Server-Side Pricing Contract Integration', () => {
  const { db } = createPricingMockDB();
  const channelDeltas = { dine_in: 0, takeaway: 2000, online: 5000, delivery: 5000 };

  it('evaluates dine_in canonical base price strictly from products.price', async () => {
    const res = await resolveServerProductPrice(db, {
      productId: 'prod-coffee',
      channel: 'dine_in',
      channelDeltas,
    });
    expect(res.available).toBe(true);
    expect(res.basePriceCents).toBe(30000);
    expect(res.channelDelta).toBe(0);
    expect(res.unitPriceCents).toBe(30000);
  });

  it('evaluates takeaway channel delta correctly', async () => {
    const res = await resolveServerProductPrice(db, {
      productId: 'prod-coffee',
      channel: 'takeaway',
      channelDeltas,
    });
    expect(res.basePriceCents).toBe(30000);
    expect(res.channelDelta).toBe(2000);
    expect(res.unitPriceCents).toBe(32000);
  });

  it('evaluates online channel delta correctly', async () => {
    const res = await resolveServerProductPrice(db, {
      productId: 'prod-coffee',
      channel: 'online',
      channelDeltas,
    });
    expect(res.basePriceCents).toBe(30000);
    expect(res.channelDelta).toBe(5000);
    expect(res.unitPriceCents).toBe(35000);
  });

  it('validates modifiers against DB and ignores tampered client modifier prices', async () => {
    const res = await resolveServerProductPrice(db, {
      productId: 'prod-coffee',
      channel: 'dine_in',
      modifiers: [
        { id: 'mod-jelly', price_delta: 999999 }, // tampered client delta
        'mod-pudding',
      ],
      channelDeltas,
    });
    // DB values: jelly is 5000, pudding is 7000. Tampered 999999 is discarded.
    expect(res.modifierDelta).toBe(12000);
    expect(res.unitPriceCents).toBe(42000);
    expect(res.validatedModifiers).toHaveLength(2);
    expect(res.validatedModifiers[0].price_delta).toBe(5000);
    expect(res.validatedModifiers[1].price_delta).toBe(7000);
  });

  it('applies happy-hour discount when evaluation timestamp matches active window', async () => {
    // 2026-10-07 is Wednesday (day 3), 15:00 is between 14:00 and 16:00
    const happyHourTime = new Date('2026-10-07T15:00:00');
    const res = await resolveServerProductPrice(db, {
      productId: 'prod-coffee',
      channel: 'dine_in',
      now: happyHourTime,
      channelDeltas,
    });
    // 30,000 VND with 20% discount = 24,000 VND
    expect(res.unitPriceCents).toBe(24000);
  });

  it('rejects unavailable product with item_unavailable code', async () => {
    const snapshot = await calculateOrderSnapshot(db, {
      items: [{ productId: 'prod-soldout', quantity: 1 }],
      channel: 'dine_in',
    });
    expect(snapshot.rejected).not.toBeNull();
    expect(snapshot.rejected?.code).toBe('item_unavailable');
    expect(snapshot.total).toBe(0);
  });

  it('discards all client-supplied item prices and totals in order snapshot', async () => {
    const snapshot = await calculateOrderSnapshot(db, {
      items: [
        {
          productId: 'prod-coffee',
          price: 1, // Tampered client price of 1 VND
          quantity: 2,
          modifiers: [{ id: 'mod-jelly', price_delta: 0 }],
        },
      ],
      channel: 'takeaway',
      channelDeltas,
    });

    expect(snapshot.rejected).toBeNull();
    expect(snapshot.items).toHaveLength(1);
    // Server price per unit: 30,000 (base) + 2,000 (takeaway) + 5,000 (jelly) = 37,000 VND
    expect(snapshot.items[0].unitPriceCents).toBe(37000);
    expect(snapshot.items[0].subtotalCents).toBe(74000);
    expect(snapshot.total).toBe(74000);
  });

  it('enforces full evaluation sequence: base -> channel -> modifier -> happy hour', () => {
    const happyHourTime = new Date('2026-10-07T15:00:00'); // Wednesday 15:00 (20% discount)
    const price = resolveItemPrice({
      basePriceCents: 30000,
      channel: 'online',
      modifierChoices: [{ id: 'mod-jelly', group_id: 'g', name: 'Jelly', price_delta: 5000, is_default: 0, sort_order: 0 }],
      happyHourWindows: [{
        id: 'hh1',
        name: 'Gold Hour',
        day_of_week: 3,
        start_time: '14:00',
        end_time: '16:00',
        discount_rate: 20,
        active: 1,
        priority: 1,
      }],
      now: happyHourTime,
      channelDeltas,
    });
    // Base 30000 + online 5000 + modifier 5000 = 40000 -> 20% discount = 32000
    expect(price).toBe(32000);
  });
});
