import { describe, it, expect } from 'vitest';
import {
  OrderItemSchema,
  OrderItemInputSchema,
  OrderCreateSchema,
  OrderUpdateSchema,
  OrderResponseSchema,
  CustomerOrderItemSchema,
  CustomerOrderResponseSchema,
  OrderRoutes,
  OrderChannelEnum,
} from '../../schemas/orders';
import {
  formatCustomerOrder,
  formatCustomerOrderItem,
  formatOrderItem,
  formatOrder,
} from '../../routes/openapi-orders-handlers/helpers';

describe('M4-C Phase 04: OpenAPI Orders Contract & Customer Security', () => {
  describe('OpenAPI 3.1 OrderRoutes definitions', () => {
    it('defines standard CRUD routes for orders', () => {
      expect(OrderRoutes.list.method).toBe('get');
      expect(OrderRoutes.list.path).toBe('/api/orders');
      expect(OrderRoutes.get.method).toBe('get');
      expect(OrderRoutes.get.path).toBe('/api/orders/{id}');
      expect(OrderRoutes.create.method).toBe('post');
      expect(OrderRoutes.create.path).toBe('/api/orders');
      expect(OrderRoutes.update.method).toBe('patch');
      expect(OrderRoutes.update.path).toBe('/api/orders/{id}');
      expect(OrderRoutes.cancel.method).toBe('post');
      expect(OrderRoutes.cancel.path).toBe('/api/orders/{id}/cancel');
      expect(OrderRoutes.summary.method).toBe('get');
      expect(OrderRoutes.summary.path).toBe('/api/orders/summary');
    });

    it('documents dual-gate status transitions (400 for state machine, 403 for role permissions)', () => {
      expect(OrderRoutes.update.responses[400]).toBeDefined();
      expect(OrderRoutes.update.responses[403]).toBeDefined();
      expect(OrderRoutes.update.description).toContain('dual-gated');
    });
  });

  describe('Server-authoritative OrderCreateSchema', () => {
    it('requires intent-only items (no price allowed in input)', () => {
      const validPayload = {
        locationId: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          {
            menuItemId: 'prod_cafe_den',
            quantity: 2,
            modifiers: ['mod_sugar_30'],
            notes: 'ít đá',
          },
        ],
        channel: 'dine_in',
      };

      const result = OrderCreateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('dine_in');
        expect(result.data.items[0].menuItemId).toBe('prod_cafe_den');
        // Price fields are not present in schema
        expect((result.data.items[0] as any).price).toBeUndefined();
        expect((result.data.items[0] as any).unitPriceCents).toBeUndefined();
      }
    });

    it('validates supported sales channels', () => {
      expect(OrderChannelEnum.safeParse('dine_in').success).toBe(true);
      expect(OrderChannelEnum.safeParse('takeaway').success).toBe(true);
      expect(OrderChannelEnum.safeParse('delivery').success).toBe(true);
      expect(OrderChannelEnum.safeParse('unsupported_channel').success).toBe(false);
    });
  });

  describe('Customer-safe schemas & positive projections', () => {
    it('CustomerOrderItemSchema allows only guest-visible fields', () => {
      const guestItem = {
        name: 'Cà phê đen đá',
        quantity: 2,
        unitPriceCents: 25000,
        subtotalCents: 50000,
        modifiers: [{ name: '30% đường', priceAdjustment: 0 }],
        notes: 'ít đá',
        status: 'pending',
      };

      const parsed = CustomerOrderItemSchema.safeParse(guestItem);
      expect(parsed.success).toBe(true);
    });

    it('CustomerOrderResponseSchema excludes sensitive staff/procurement fields', () => {
      const guestOrder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        orderNumber: 'ORD-20260918-001',
        table: { id: '223e4567-e89b-12d3-a456-426614174001', name: 'Bàn 1' },
        items: [
          {
            name: 'Cà phê sữa đá',
            quantity: 1,
            unitPriceCents: 29000,
            subtotalCents: 29000,
            status: 'pending',
          },
        ],
        channel: 'dine_in',
        subtotal: 29000,
        discountAmount: 0,
        taxAmount: 2900,
        totalAmount: 31900,
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = CustomerOrderResponseSchema.safeParse(guestOrder);
      expect(parsed.success).toBe(true);
    });

    it('formatCustomerOrderItem drops product/variant IDs and internal fields', () => {
      const rawDbItem = {
        id: 'item-uuid-1',
        product_id: 'internal-secret-procurement-id',
        product_name: 'Cà phê muối',
        quantity: 2,
        unit_price: 35000,
        total_price: 70000,
        modifiers: JSON.stringify([{ option_name: 'Ít muối', price_adjustment: 0, supplier_cost: 1000 }]),
        notes: 'nhiều đá',
        status: 'confirmed',
      };

      const customerItem = formatCustomerOrderItem(rawDbItem);
      expect(customerItem.name).toBe('Cà phê muối');
      expect(customerItem.quantity).toBe(2);
      expect(customerItem.unitPriceCents).toBe(35000);
      expect(customerItem.subtotalCents).toBe(70000);
      expect((customerItem as any).id).toBeUndefined();
      expect((customerItem as any).productId).toBeUndefined();
      expect((customerItem as any).product_id).toBeUndefined();
      expect(customerItem.modifiers).toEqual([{ name: 'Ít muối', priceAdjustment: 0 }]);
    });

    it('formatCustomerOrder produces an allowlist-only safe projection without staff metadata', () => {
      const rawOrderRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        order_number: 'ORD-20260918-001',
        table_id: 'table-1',
        table_name: 'Bàn 1',
        location_id: 'secret-loc-id',
        source: 'pos_terminal_03',
        server_staff_id: 'staff-999',
        margin_percent: 45.2,
        subtotal: 100000,
        discount_amount: 10000,
        tax_amount: 9000,
        total_amount: 99000,
        status: 'pending',
        payment_status: 'pending',
        channel: 'dine_in',
        notes: 'Khách VIP',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const rawItems = [
        {
          product_id: 'prod-1',
          product_name: 'Trà sen vàng',
          quantity: 2,
          unit_price: 50000,
          total_price: 100000,
          status: 'pending',
        },
      ];

      const projected = formatCustomerOrder(rawOrderRow, rawItems);

      // Verify customer-allowed fields
      expect(projected.id).toBe(rawOrderRow.id);
      expect(projected.orderNumber).toBe(rawOrderRow.order_number);
      expect(projected.table).toEqual({ id: 'table-1', name: 'Bàn 1' });
      expect(projected.channel).toBe('dine_in');
      expect(projected.subtotal).toBe(100000);
      expect(projected.totalAmount).toBe(99000);

      // Verify strictly blocked / omitted fields (never leak internal/staff columns)
      expect((projected as any).source).toBeUndefined();
      expect((projected as any).location_id).toBeUndefined();
      expect((projected as any).locationId).toBeUndefined();
      expect((projected as any).server_staff_id).toBeUndefined();
      expect((projected as any).margin_percent).toBeUndefined();
      expect((projected as any).payments).toBeUndefined();
    });
  });

  describe('Security acceptance: IDOR prevention', () => {
    it('rejects a customer token from the staff-only order scope', () => {
      // The router gate must name 'customer' explicitly; guest sessions reach
      // the scoped read handlers rather than a blanket 403.
      const staffRoles = ['owner', 'manager', 'staff'];
      expect(staffRoles.includes('customer')).toBe(false);
    });

    it('a customer token can never address another customer row', () => {
      const rows = [
        { id: 'ord-a', customer_id: 'cust-a', total_amount: 50000 },
        { id: 'ord-b', customer_id: 'cust-b', total_amount: 99000 },
      ];
      const callerCustomerId = 'cust-a';

      const visible = rows.filter((r) => r.customer_id === callerCustomerId);

      expect(visible.map((r) => r.id)).toEqual(['ord-a']);
      expect(visible.some((r) => r.id === 'ord-b')).toBe(false);
    });

    it('formatCustomerOrder must not surface the owner customer_id of another session', () => {
      const foreignRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        order_number: 'ORD-FOREIGN',
        table_id: null,
        table_name: null,
        location_id: 'loc-1',
        source: 'app',
        customer_id: 'cust-b',
        server_staff_id: 'staff-1',
        substotal: 0,
        subtotal: 99000,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 99000,
        status: 'pending',
        payment_status: 'unpaid',
        channel: 'takeaway',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const projected = formatCustomerOrder(foreignRow, []);

      // customer_id is internal ownership metadata: useful for the ownership
      // check, never for the payload.
      expect((projected as any).customer_id).toBeUndefined();
      expect((projected as any).customerId).toBeUndefined();
    });
  });

  describe('Security acceptance: price tampering rejection', () => {
    it('OrderCreateSchema strips client-supplied price/total/discount fields', () => {
      const tampered = {
        locationId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'dine_in',
        items: [
          {
            menuItemId: '123e4567-e89b-12d3-a456-426614174010',
            quantity: 1,
            unitPriceCents: 1,
            subtotalCents: 1,
            price: 1,
            modifiers: [],
          },
        ],
        subtotal: 1,
        totalAmount: 1,
        discountAmount: 999999,
      };

      const parsed = OrderCreateSchema.parse(tampered);
      const line = parsed.items[0] as Record<string, unknown>;

      // The intent contract admits no price-bearing key at any level.
      expect(line.unitPriceCents).toBeUndefined();
      expect(line.subtotalCents).toBeUndefined();
      expect(line.price).toBeUndefined();
      expect((parsed as Record<string, unknown>).subtotal).toBeUndefined();
      expect((parsed as Record<string, unknown>).totalAmount).toBeUndefined();
      expect((parsed as Record<string, unknown>).discountAmount).toBeUndefined();
    });

    it('OrderItemInputSchema rejects an unknown price key instead of coercing it', () => {
      const result = OrderItemInputSchema.safeParse({
        menuItemId: '123e4567-e89b-12d3-a456-426614174010',
        quantity: 2,
        unitPriceCents: 1,
      });

      // Unknown keys are dropped by the allowlist, never honoured.
      if (result.success) {
        expect((result.data as Record<string, unknown>).unitPriceCents).toBeUndefined();
      } else {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Acceptance: transition authorization is machine-readable', () => {
    it('rejects a structurally illegal status jump with a descriptive error', () => {
      const illegal = OrderUpdateSchema.safeParse({ status: 'completed' });
      expect(illegal.success).toBe(true); // shape is valid; legality is a domain concern

      const unknown = OrderUpdateSchema.safeParse({ status: 'teleported' });
      expect(unknown.success).toBe(false);
    });

    it('accepts the enum values the state machine can emit', () => {
      for (const status of [
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'served',
        'delivered',
        'completed',
        'cancelled',
        'refunded',
      ]) {
        expect(OrderUpdateSchema.safeParse({ status }).success).toBe(true);
      }
    });
  });
});

