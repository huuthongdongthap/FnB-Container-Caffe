import { describe, it, expect } from 'vitest';
import {
  findLoyaltyVoucherByCode,
  validateLoyaltyVoucher,
  reserveLoyaltyVoucherAtomically,
  rollbackLoyaltyVoucherReservation,
  type LoyaltyVoucherRecord,
} from '../loyalty-voucher';

function createMockD1(options: {
  userReward?: Record<string, unknown> | null;
  loyaltyRedemption?: Record<string, unknown> | null;
  updateChanges?: number;
}) {
  const executedSql: Array<{ sql: string; params: unknown[] }> = [];

  const db = {
    prepare(sql: string) {
      let boundParams: unknown[] = [];
      return {
        bind(...params: unknown[]) {
          boundParams = params;
          return this;
        },
        async first<T>() {
          executedSql.push({ sql, params: boundParams });
          if (sql.includes('FROM user_rewards')) {
            return (options.userReward ?? null) as T | null;
          }
          if (sql.includes('FROM loyalty_redemptions')) {
            return (options.loyaltyRedemption ?? null) as T | null;
          }
          return null;
        },
        async run() {
          executedSql.push({ sql, params: boundParams });
          return {
            success: true,
            meta: { changes: options.updateChanges ?? 1 },
          };
        },
      };
    },
  } as unknown as D1Database;

  return { db, executedSql };
}

describe('loyalty-voucher domain module (#121)', () => {
  it('finds and validates an active user_rewards voucher and computes fixed discount', async () => {
    const { db } = createMockD1({
      userReward: {
        id: 'ur-1',
        customer_id: 'cust-1',
        reward_id: 'rew-1',
        code: 'VCH-ABC123',
        status: 'active',
        expires_at: '2099-12-31T23:59:59.000Z',
        tenant_id: 'tenant-a',
        title: 'Giảm 20k',
        discount_type: 'fixed',
        discount_value: 20000,
        min_order: 50000,
        max_discount: 0,
      },
    });

    const voucher = await findLoyaltyVoucherByCode(db, 'vch-abc123', 'tenant-a');
    expect(voucher).not.toBeNull();
    expect(voucher?.code).toBe('VCH-ABC123');
    expect(voucher?.source).toBe('user_rewards');
    expect(voucher?.min_order).toBe(50000);

    const result = validateLoyaltyVoucher(voucher!, {
      customerId: 'cust-1',
      orderTotal: 80000,
    });
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(20000);
  });

  it('rejects voucher when order total is below min_order', () => {
    const voucher: LoyaltyVoucherRecord = {
      id: 'ur-min',
      source: 'user_rewards',
      code: 'VCH-MIN50K',
      customer_id: 'cust-1',
      reward_id: 'rew-1',
      title: 'Giảm 20k cho đơn từ 50k',
      discount_type: 'fixed',
      discount_value: 20000,
      min_order: 50000,
      max_discount: 0,
      status: 'active',
      expires_at: '2099-12-31T23:59:59.000Z',
      tenant_id: 'tenant-a',
    };

    const result = validateLoyaltyVoucher(voucher, {
      customerId: 'cust-1',
      orderTotal: 30000,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('50');
  });

  it('rejects already-used voucher to prevent double-spend', () => {
    const usedVoucher: LoyaltyVoucherRecord = {
      id: 'ur-2',
      source: 'user_rewards',
      code: 'VCH-USED',
      customer_id: 'cust-1',
      reward_id: 'rew-1',
      title: 'Giảm 20k',
      discount_type: 'fixed',
      discount_value: 20000,
      min_order: 0,
      max_discount: 0,
      status: 'used',
      expires_at: '2099-12-31T23:59:59.000Z',
      tenant_id: 'tenant-a',
    };

    const result = validateLoyaltyVoucher(usedVoucher, {
      customerId: 'cust-1',
      orderTotal: 80000,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects voucher owned by another customer unless staff override is set', () => {
    const otherVoucher: LoyaltyVoucherRecord = {
      id: 'ur-3',
      source: 'user_rewards',
      code: 'VCH-OTHER',
      customer_id: 'cust-owner',
      reward_id: 'rew-1',
      title: 'Giảm 15%',
      discount_type: 'percent',
      discount_value: 15,
      min_order: 0,
      max_discount: 0,
      status: 'active',
      expires_at: '2099-12-31T23:59:59.000Z',
      tenant_id: 'tenant-a',
    };

    const denied = validateLoyaltyVoucher(otherVoucher, {
      customerId: 'cust-attacker',
      orderTotal: 100000,
    });
    expect(denied.valid).toBe(false);

    const staffAllowed = validateLoyaltyVoucher(otherVoucher, {
      customerId: 'cust-attacker',
      allowStaffOverride: true,
      orderTotal: 100000,
    });
    expect(staffAllowed.valid).toBe(true);
    expect(staffAllowed.discountAmount).toBe(15000);
  });

  it('returns false when concurrent atomic UPDATE affects 0 rows', async () => {
    const { db } = createMockD1({ updateChanges: 0 });
    const reserved = await reserveLoyaltyVoucherAtomically(
      db,
      {
        id: 'ur-1',
        source: 'user_rewards',
        code: 'VCH-RACE',
        customer_id: 'cust-1',
        reward_id: 'rew-1',
        title: 'Giảm 20k',
        discount_type: 'fixed',
        discount_value: 20000,
        min_order: 0,
        max_discount: 0,
        status: 'active',
        expires_at: null,
        tenant_id: 'tenant-a',
      },
      'order-1',
      '2026-11-23T00:00:00.000Z',
    );
    expect(reserved).toBe(false);
  });

  it('rolls back a reserved voucher to active status scoped by orderId on order failure', async () => {
    const { db, executedSql } = createMockD1({ updateChanges: 1 });
    await rollbackLoyaltyVoucherReservation(
      db,
      {
        id: 'ur-1',
        source: 'user_rewards',
        code: 'VCH-RB',
        customer_id: 'cust-1',
        reward_id: 'rew-1',
        title: 'Giảm 20k',
        discount_type: 'fixed',
        discount_value: 20000,
        min_order: 0,
        max_discount: 0,
        status: 'active',
        expires_at: null,
        tenant_id: 'tenant-a',
      },
      'ORD-FAIL-1',
    );

    expect(executedSql.some((q) => q.sql.includes("SET status = 'active'"))).toBe(true);
    expect(executedSql.some((q) => q.sql.includes('WHERE order_id = ?'))).toBe(true);
  });
});
