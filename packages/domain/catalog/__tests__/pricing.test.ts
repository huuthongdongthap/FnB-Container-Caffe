/**
 * Pricing Policy — unit tests for channel price resolution.
 *
 * Contract: `resolveItemPrice` is the single server-authoritative source of
 * unit price. Client input never carries a price; only intent
 * (menuItemId, quantity, channel, modifier ids).
 */
import { describe, test, expect } from 'vitest';
import { resolveItemPrice, happyHourDiscountFor } from '../policies/pricing';
import type { Channel, ChannelDeltaConfig } from '../policies/pricing';
import type { HappyHourWindow, ModifierChoice } from '../model/catalog-types';

const NO_DELTAS: ChannelDeltaConfig = { dine_in: 0, takeaway: 0, delivery: 0 };

const modifier = (id: string, price_delta: number): ModifierChoice => ({
  id,
  group_id: 'g1',
  name: id,
  price_delta,
  is_default: 0,
  sort_order: 0,
});

const window_ = (
  overrides: Partial<HappyHourWindow> = {},
): HappyHourWindow => ({
  id: 'hh1',
  name: 'Happy Hour',
  day_of_week: 3, // Wednesday
  start_time: '14:00',
  end_time: '17:00',
  discount_rate: 10,
  apply_to: 'all',
  apply_ids: null,
  priority: 0,
  active: 1,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  ...overrides,
});

// 2026-09-16 is a Wednesday; 15:00 falls inside the default window.
const WEDNESDAY_INSIDE = new Date('2026-09-16T15:00:00');
const WEDNESDAY_OUTSIDE = new Date('2026-09-16T20:00:00');
const THURSDAY_INSIDE = new Date('2026-09-17T15:00:00');

describe('resolveItemPrice — base price', () => {
  test('returns base price when no modifiers, no deltas, no happy hour', () => {
    const price = resolveItemPrice({
      basePriceCents: 4500,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(4500);
  });

  test('returns integer cents, never fractional', () => {
    const price = resolveItemPrice({
      basePriceCents: 3333,
      channel: 'takeaway',
      modifierChoices: [modifier('m1', 111)],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(Number.isInteger(price)).toBe(true);
    expect(price).toBe(3444);
  });

  test('zero base price resolves to zero', () => {
    const price = resolveItemPrice({
      basePriceCents: 0,
      channel: 'delivery',
      modifierChoices: [],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(0);
  });
});

describe('resolveItemPrice — channel deltas', () => {
  const deltas: ChannelDeltaConfig = {
    dine_in: 0,
    takeaway: 500,
    delivery: 1500,
  };

  test.each<[Channel, number]>([
    ['dine_in', 10000],
    ['takeaway', 10500],
    ['delivery', 11500],
  ])('channel %s applies its configured delta', (channel, expected) => {
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel,
      modifierChoices: [],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
      channelDeltas: deltas,
    });
    expect(price).toBe(expected);
  });

  test('negative channel delta discounts the base price', () => {
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'takeaway',
      modifierChoices: [],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
      channelDeltas: { ...NO_DELTAS, takeaway: -2000 },
    });
    expect(price).toBe(8000);
  });

  test('default channel deltas are zero when not supplied', () => {
    for (const channel of ['dine_in', 'takeaway', 'delivery'] as Channel[]) {
      const price = resolveItemPrice({
        basePriceCents: 7000,
        channel,
        modifierChoices: [],
        happyHourWindows: [],
        now: WEDNESDAY_INSIDE,
      });
      expect(price).toBe(7000);
    }
  });
});

describe('resolveItemPrice — modifiers', () => {
  test('aggregates multiple modifier price deltas additively', () => {
    const price = resolveItemPrice({
      basePriceCents: 5000,
      channel: 'dine_in',
      modifierChoices: [
        modifier('extra-shot', 800),
        modifier('oat-milk', 1200),
        modifier('no-sugar', 0),
      ],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(7000);
  });

  test('negative modifier delta is honoured', () => {
    const price = resolveItemPrice({
      basePriceCents: 5000,
      channel: 'dine_in',
      modifierChoices: [modifier('small-size', -1000)],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(4000);
  });

  test('empty modifier list is a no-op', () => {
    const price = resolveItemPrice({
      basePriceCents: 5000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(5000);
  });
});

describe('resolveItemPrice — happy hour', () => {
  test('applies discount when inside the active window', () => {
    // 10% off 10000 = 1000 discount → 9000
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [window_()],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(9000);
  });

  test('does not apply discount outside the time window', () => {
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [window_()],
      now: WEDNESDAY_OUTSIDE,
    });
    expect(price).toBe(10000);
  });

  test('does not apply discount on a non-matching weekday', () => {
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [window_()],
      now: THURSDAY_INSIDE,
    });
    expect(price).toBe(10000);
  });

  test('does not apply discount when window is inactive', () => {
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [window_({ active: 0 })],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(10000);
  });

  test('discount applies after modifiers and channel delta', () => {
    // base 10000 + takeaway 500 + modifier 1500 = 12000; 10% off → 10800
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'takeaway',
      modifierChoices: [modifier('m1', 1500)],
      happyHourWindows: [window_()],
      now: WEDNESDAY_INSIDE,
      channelDeltas: { ...NO_DELTAS, takeaway: 500 },
    });
    expect(price).toBe(10800);
  });

  test('fractional discount floors to whole cents (no rounding up)', () => {
    // 10% of 3333 = 333.3 → floor 333 → 3000
    const price = resolveItemPrice({
      basePriceCents: 3333,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [window_()],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(3000);
  });

  test('highest-priority window wins', () => {
    const price = resolveItemPrice({
      basePriceCents: 10000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [
        window_({ id: 'low', discount_rate: 5, priority: 0 }),
        window_({ id: 'high', discount_rate: 20, priority: 10 }),
      ],
      now: WEDNESDAY_INSIDE,
    });
    // priority 10 window: 20% off → 8000
    expect(price).toBe(8000);
  });
});

describe('resolveItemPrice — invariants', () => {
  test('never returns a negative price', () => {
    const price = resolveItemPrice({
      basePriceCents: 1000,
      channel: 'dine_in',
      modifierChoices: [modifier('huge-discount', -5000)],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    expect(price).toBe(0);
  });

  test('is deterministic for identical inputs', () => {
    const input = {
      basePriceCents: 4200,
      channel: 'delivery' as Channel,
      modifierChoices: [modifier('m1', 300)],
      happyHourWindows: [window_()],
      now: WEDNESDAY_INSIDE,
    };
    expect(resolveItemPrice(input)).toBe(resolveItemPrice(input));
  });

  test('does not mutate the input modifier array', () => {
    const choices = [modifier('m1', 300)];
    const snapshot = JSON.stringify(choices);
    resolveItemPrice({
      basePriceCents: 4200,
      channel: 'dine_in',
      modifierChoices: choices,
      happyHourWindows: [window_()],
      now: WEDNESDAY_INSIDE,
    });
    expect(JSON.stringify(choices)).toBe(snapshot);
  });

  test('channel delta and modifiers are independent of each other', () => {
    const withModifierOnly = resolveItemPrice({
      basePriceCents: 5000,
      channel: 'dine_in',
      modifierChoices: [modifier('m1', 1000)],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
    });
    const withDeltaOnly = resolveItemPrice({
      basePriceCents: 5000,
      channel: 'dine_in',
      modifierChoices: [],
      happyHourWindows: [],
      now: WEDNESDAY_INSIDE,
      channelDeltas: { ...NO_DELTAS, dine_in: 1000 },
    });
    expect(withModifierOnly).toBe(withDeltaOnly);
  });
});

describe('happyHourDiscountFor — regression guard', () => {
  test('excludes wrap-around windows (start > end)', () => {
    const result = happyHourDiscountFor(
      [window_({ start_time: '22:00', end_time: '02:00' })],
      WEDNESDAY_INSIDE,
    );
    expect(result).toBeNull();
  });

  test('window end is exclusive', () => {
    const atEnd = new Date('2026-09-16T17:00:00');
    expect(happyHourDiscountFor([window_()], atEnd)).toBeNull();
  });

  test('window start is inclusive', () => {
    const atStart = new Date('2026-09-16T14:00:00');
    expect(happyHourDiscountFor([window_()], atStart)?.id).toBe('hh1');
  });
});
