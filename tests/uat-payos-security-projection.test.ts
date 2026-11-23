import { describe, expect, it } from 'vitest';
import { canAccessPaymentOrder } from '../packages/domain/payment/policies/payment-access';
import { formatCustomerOrder } from '../worker/src/routes/openapi-orders-handlers/helpers';
import { projectCustomerOrderPayload } from '../packages/domain/order/policies/customer-order-payload';

function mockContext(opts?: {
  user?: Record<string, unknown>;
  headers?: Record<string, string>;
  tenantId?: string;
}) {
  const headers = opts?.headers ?? {};
  return {
    get: (key: string) => {
      if (key === 'user') return opts?.user;
      if (key === 'tenantId') return opts?.tenantId ?? 'default';
      return undefined;
    },
    req: {
      header: (name: string) => {
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === lower) return v;
        }
        return undefined;
      },
      query: () => undefined,
    },
  };
}

describe('Payment security & customer order projection regressions', () => {
  describe('canAccessPaymentOrder', () => {
    it('blocks anonymous access when guest_token_hash is set and X-Order-Token header is omitted', () => {
      const ctx = mockContext();
      const allowed = canAccessPaymentOrder(
        ctx,
        {
          tenant_id: 'default',
          customer_id: null,
          guest_token_hash: 'sha256:abcdef1234567890',
          orderTokenVerified: false,
        },
        true
      );
      expect(allowed).toBe(false);
    });

    it('allows anonymous access when orderTokenVerified is true', () => {
      const ctx = mockContext({ headers: { 'X-Order-Token': 'valid-token' } });
      const allowed = canAccessPaymentOrder(
        ctx,
        {
          tenant_id: 'default',
          customer_id: null,
          guest_token_hash: 'sha256:abcdef1234567890',
          orderTokenVerified: true,
        },
        true
      );
      expect(allowed).toBe(true);
    });

    it('allows legacy anonymous guest order without customer_id, order_token, or guest_token_hash', () => {
      const ctx = mockContext();
      const allowed = canAccessPaymentOrder(
        ctx,
        {
          tenant_id: 'default',
          customer_id: null,
          order_token: null,
          guest_token_hash: null,
        },
        true
      );
      expect(allowed).toBe(true);
    });
  });

  describe('formatCustomerOrder & projectCustomerOrderPayload', () => {
    it('includes paymentMethod, order_type channel, discount, and subtotal fallback in formatCustomerOrder', () => {
      const formatted = formatCustomerOrder(
        {
          id: 'ord-120',
          order_number: 'ORD-120',
          order_type: 'delivery',
          payment_method: 'payos',
          payment_status: 'unpaid',
          status: 'pending',
          discount: 15000,
          total: 85000,
          created_at: '2026-11-23T00:00:00Z',
          updated_at: '2026-11-23T00:00:00Z',
        },
        []
      );

      expect(formatted.paymentMethod).toBe('payos');
      expect(formatted.channel).toBe('delivery');
      expect(formatted.discountAmount).toBe(15000);
      expect(formatted.totalAmount).toBe(85000);
      expect(formatted.subtotal).toBe(100000);
    });

    it('maps order.discount fallback in projectCustomerOrderPayload', () => {
      const projected = projectCustomerOrderPayload({
        id: 'ord-120-sse',
        order_number: 'ORD-120-SSE',
        order_type: 'takeaway',
        payment_method: 'cod',
        payment_status: 'unpaid',
        status: 'pending',
        discount: 10000,
        total: 50000,
      });

      expect(projected.paymentMethod).toBe('cod');
      expect(projected.channel).toBe('takeaway');
      expect(projected.discountAmount).toBe(10000);
      expect(projected.subtotal).toBe(60000);
      expect(projected.totalAmount).toBe(50000);
    });
  });
});
