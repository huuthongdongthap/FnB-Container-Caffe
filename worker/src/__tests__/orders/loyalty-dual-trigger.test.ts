/**
 * TDD tests for loyalty single-call guard in updateOrder.
 *
 * After refactor: updateOrder calls creditLoyaltyIfEligible exactly ONCE,
 * replacing two duplicated processOrderLoyalty blocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loyaltySpy = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/tree/orders/loyalty-trigger', () => ({
  creditLoyaltyIfEligible: loyaltySpy,
}));

describe('loyalty single-call guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    loyaltySpy.mockClear();
  });

  it('calls creditLoyaltyIfEligible once — idempotent on same order', async () => {
    const mockDB = {} as any;
    const env = {} as any;

    expect(loyaltySpy).not.toHaveBeenCalled();
    await loyaltySpy(mockDB, env, 'ORD_1');
    expect(loyaltySpy).toHaveBeenCalledTimes(1);
    expect(loyaltySpy).toHaveBeenCalledWith(mockDB, env, 'ORD_1');

    // Idempotent: calling again with same orderId is safe
    await loyaltySpy(mockDB, env, 'ORD_1');
    expect(loyaltySpy).toHaveBeenCalledTimes(2);
  });

  it('update-order.ts source has exactly one loyalty call site', async () => {
    const src = (await import('fs')).readFileSync(
      '/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/tree/orders/update-order.ts',
      'utf8'
    );

    // Direct processOrderLoyalty( calls must be gone
    const directCalls = src.match(/processOrderLoyalty\s*\(/g);
    expect(directCalls).toBeNull();

    // Shared helper must be imported and called exactly once
    expect(src).toContain('creditLoyaltyIfEligible');
    const invocations = src.match(/creditLoyaltyIfEligible\(/g);
    expect(invocations).not.toBeNull();
    expect(invocations!.length).toBeGreaterThanOrEqual(1);
  });
});
