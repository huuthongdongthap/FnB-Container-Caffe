// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveOrderCreationScope, OrderCreationError } from '../../../packages/domain/order/policies/order-creation-scope';
import { evaluateOrderClaimPolicy } from '../../../packages/domain/customer/policies/order-ownership-policy';
import { getLatestOrderTimestamp } from '../../../packages/domain/order/queries/latest-timestamp';
import { FINANCIAL_ROLES } from '../../../packages/domain/payment/policies/payment-access';
import { canTransitionViolation } from '../../../packages/domain/sop/src/model/sop-state';
import { SopApplySanctionSchema } from '../schemas/sop-violations';
import { splitOrders } from '../../../packages/domain/order/commands/split-orders';

describe('Issues #258, #259, #260 Security, RBAC & Promo Regressions', () => {
  describe('#258 Multi-Tenant, Order Split & Guest Claim', () => {
    it('blocks cross-tenant order creation when default customer overrides X-Tenant-ID', async () => {
      const req = new Request('https://api.aura.test/api/orders', {
        method: 'POST',
        headers: { 'X-Tenant-ID': 'cafe-b' },
      });
      await expect(
        resolveOrderCreationScope(req, {}, { id: 'cust-1', role: 'customer', tenantId: 'default' }),
      ).rejects.toThrow(OrderCreationError);
    });

    it('rejects guest order claim by tableId alone when guest_token_hash is set', () => {
      const result = evaluateOrderClaimPolicy({
        actor: { id: 'cust-attacker', role: 'customer' },
        order: {
          id: 'ord-guest-1',
          customer_id: null,
          customer_phone: 'Guest',
          table_id: 't07',
          guest_token_hash: 'a'.repeat(64),
        },
        tableId: 't07',
        orderTokenVerified: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it('allows guest order claim when orderTokenVerified is true', () => {
      const result = evaluateOrderClaimPolicy({
        actor: { id: 'cust-owner', role: 'customer' },
        order: {
          id: 'ord-guest-1',
          customer_id: null,
          customer_phone: 'Guest',
          table_id: 't07',
          guest_token_hash: 'a'.repeat(64),
        },
        orderTokenVerified: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('isolates /api/orders/latest KV key per tenant', async () => {
      const kvMap = new Map<string, string>([
        ['latest_order_ts:default', '1700000000001'],
        ['latest_order_ts:cafe-b', '1700000000999'],
      ]);
      const fakeKv = { get: async (k: string) => kvMap.get(k) ?? null };

      const resDefault = await getLatestOrderTimestamp(
        new Request('https://api.aura.test/api/orders/latest'),
        { AUTH_KV: fakeKv },
      );
      const bodyDefault = (await resDefault.json()) as { ts: string | null };
      expect(bodyDefault.ts).toBe('1700000000001');

      const resCafeB = await getLatestOrderTimestamp(
        new Request('https://api.aura.test/api/orders/latest?tenant_id=cafe-b'),
        { AUTH_KV: fakeKv },
      );
      const bodyCafeB = (await resCafeB.json()) as { ts: string | null };
      expect(bodyCafeB.ts).toBe('1700000000999');

      const resCafeC = await getLatestOrderTimestamp(
        new Request('https://api.aura.test/api/orders/latest?tenant_id=cafe-c'),
        { AUTH_KV: fakeKv },
      );
      const bodyCafeC = (await resCafeC.json()) as { ts: string | null };
      expect(bodyCafeC.ts).toBeNull();
    });

    it('rejects unauthenticated POST /api/orders/split with 401', async () => {
      const req = new Request('https://api.aura.test/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: 't01',
          orders: [
            {
              items: [{ id: 'p1', name: 'Coffee', price: 30000, quantity: 1 }],
              total: 30000,
              customer_name: 'Guest 1',
              customer_phone: '0900000001',
              payment_method: 'cod',
            },
            {
              items: [{ id: 'p2', name: 'Tea', price: 30000, quantity: 1 }],
              total: 30000,
              customer_name: 'Guest 2',
              customer_phone: '0900000002',
              payment_method: 'cod',
            },
          ],
        }),
      });
      const res = await splitOrders(req, {});
      expect(res.status).toBe(401);
    });
  });

  describe('#259 RBAC Hierarchy & SOP Policy', () => {
    it('enforces monotonic FINANCIAL_ROLES (supervisor included, cashier excluded)', () => {
      expect(FINANCIAL_ROLES).toContain('owner');
      expect(FINANCIAL_ROLES).toContain('admin');
      expect(FINANCIAL_ROLES).toContain('manager');
      expect(FINANCIAL_ROLES).toContain('supervisor');
      expect(FINANCIAL_ROLES).not.toContain('cashier');
      expect(FINANCIAL_ROLES).not.toContain('staff');
    });

    it('allows appealed -> confirmed SOP violation transition', () => {
      expect(canTransitionViolation('appealed', 'confirmed')).toBe(true);
    });

    it('accepts SopApplySanctionSchema payload without step', () => {
      const parsed = SopApplySanctionSchema.safeParse({ sanctionNote: 'Confirmed by manager' });
      expect(parsed.success).toBe(true);
    });
  });
});
