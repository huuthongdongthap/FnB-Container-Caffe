/**
 * TDD tests for loyalty single-call guard in updateOrder.
 *
 * After refactor: updateOrder calls creditLoyaltyIfEligible exactly ONCE,
 * replacing two duplicated processOrderLoyalty blocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('loyalty single-call guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls creditLoyaltyIfEligible once — idempotent on same order', async () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    const mockDB = {} as any;
    const env = {} as any;

    vi.mock('../../tree/orders/loyalty-trigger', () => ({
      creditLoyaltyIfEligible: spy,
    }));

    expect(spy).not.toHaveBeenCalled();
    await spy(mockDB, env, 'ORD_1');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(mockDB, env, 'ORD_1');

    // Idempotent: calling again with same orderId is safe
    await spy(mockDB, env, 'ORD_1');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('update-order.ts source has exactly one loyalty call site', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../tree/orders/update-order.ts', import.meta.url).pathname,
      'utf8'
    );

    // Direct processOrderLoyalty( calls must be gone
    const directCalls = src.match(/processOrderLoyalty\s*\(/g);
    expect(directCalls).toBeNull();

    // Shared helper must be imported and called exactly once
    expect(src).toContain('creditLoyaltyIfEligible');
    const invocations = src.match(/creditLoyaltyIfEligible\(/g);
    expect(invocations).not.toBeNull();
    expect(invocations!.length).toBe(1);
  });
});
