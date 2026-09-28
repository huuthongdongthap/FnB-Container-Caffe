/**
 * M4-D: Customer Order Projection & Security Contract Tests
 *
 * Verifies:
 * 1. Customer-safe projection: only safe allowlisted fields returned.
 * 2. No leakage of internal IDs (product_id, modifier option IDs), margins, source, or audit actors.
 * 3. Schema conformance: projection passes `CustomerOrderResponseSchema` parse.
 * 4. Dual-gating: staff formatOrder exposes internals, customer formatCustomerOrder hides them.
 */

import { describe, it, expect } from 'vitest';
import {
  formatCustomerOrder,
  formatCustomerOrderItem,
  formatOrder,
  formatOrderItem,
} from '../worker/src/routes/openapi-orders-handlers/helpers';
import {
  CustomerOrderResponseSchema,
  CustomerOrderItemSchema,
  OrderResponseSchema,
} from '../worker/src/schemas/orders';

const RAW_ORDER_ROW = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  order_number: 'ORD-20260920-001',
  table_id: '123e4567-e89b-12d3-a456-426614174001',
  table_name: 'Table 5',
  location_id: '123e4567-e89b-12d3-a456-426614174002',
  source: 'kiosk',
  customer_id: '123e4567-e89b-12d3-a456-426614174003',
  server_staff_id: 'staff-99',
  server_staff_name: 'John Server',
  channel: 'dine_in',
  happy_hour_applied: 1,
  subtotal: 85000,
  discount_amount: 5000,
  tax_amount: 8000,
  total_amount: 88000,
  status: 'confirmed',
  payment_status: 'pending',
  notes: 'Less sugar, please',
  served_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:05:00.000Z',
};

const RAW_ITEMS_ROWS = [
  {
    id: '123e4567-e89b-12d3-a456-426614174010',
    order_id: '123e4567-e89b-12d3-a456-426614174000',
    product_id: 'prod-cafe-den',
    product_name: 'Cà phê đen đá',
    quantity: 2,
    unit_price: 25000,
    total_price: 50000,
    modifiers: JSON.stringify([
      { optionName: 'Ít đường', priceAdjustment: 0, modifierId: 'mod-1', optionId: 'opt-1' },
    ]),
    notes: 'Less sugar',
    status: 'pending',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174011',
    order_id: '123e4567-e89b-12d3-a456-426614174000',
    product_id: 'prod-banh-mi',
    product_name: 'Bánh mì thịt nướng',
    quantity: 1,
    unit_price: 35000,
    total_price: 35000,
    modifiers: null,
    notes: null,
    status: 'pending',
  },
];

const RAW_PAYMENTS_ROWS = [
  {
    id: '123e4567-e89b-12d3-a456-426614174020',
    order_id: '123e4567-e89b-12d3-a456-426614174000',
    amount: 88000,
    method: 'cash',
    status: 'pending',
    transactionId: undefined,
    payosOrderCode: undefined,
    paidAt: null,
  },
];

describe('M4-D: Customer Order Projection (formatCustomerOrder)', () => {
  it('projects only customer-safe fields', () => {
    const projection = formatCustomerOrder(RAW_ORDER_ROW, RAW_ITEMS_ROWS);

    // Verifies positive allowlist fields
    expect(projection.id).toBe(RAW_ORDER_ROW.id);
    expect(projection.orderNumber).toBe(RAW_ORDER_ROW.order_number);
    expect(projection.table).toEqual({ id: RAW_ORDER_ROW.table_id, name: RAW_ORDER_ROW.table_name });
    expect(projection.items).toHaveLength(2);
    expect(projection.channel).toBe('dine_in');
    expect(projection.subtotal).toBe(85000);
    expect(projection.discountAmount).toBe(5000);
    expect(projection.taxAmount).toBe(8000);
    expect(projection.totalAmount).toBe(88000);
    expect(projection.status).toBe('confirmed');
    expect(projection.paymentStatus).toBe('pending');
    expect(projection.notes).toBe('Less sugar, please');
    expect(projection.createdAt).toBe(RAW_ORDER_ROW.created_at);
    expect(projection.updatedAt).toBe(RAW_ORDER_ROW.updated_at);

    // Must NOT leak internal staff/audit fields
    expect((projection as any).source).toBeUndefined();
    expect((projection as any).payments).toBeUndefined();
    expect((projection as any).customer_id).toBeUndefined();
    expect((projection as any).server_staff_id).toBeUndefined();
    expect((projection as any).server_staff_name).toBeUndefined();
    expect((projection as any).location_id).toBeUndefined();
    expect((projection as any).locationId).toBeUndefined();
    expect((projection as any).table_id).toBeUndefined();
    expect((projection as any).happy_hour_applied).toBeUndefined();
    expect((projection as any).happyHourApplied).toBeUndefined();
    expect((projection as any).served_at).toBeUndefined();
    expect((projection as any).completed_at).toBeUndefined();
    expect((projection as any).cancelled_at).toBeUndefined();
  });

  it('items in customer projection omit product IDs and modifier internal keys', () => {
    const projection = formatCustomerOrder(RAW_ORDER_ROW, RAW_ITEMS_ROWS);

    const item1 = projection.items[0];
    expect(item1.name).toBe('Cà phê đen đá');
    expect(item1.quantity).toBe(2);
    expect(item1.unitPriceCents).toBe(25000);
    expect(item1.subtotalCents).toBe(50000);
    expect(item1.status).toBe('pending');
    expect(item1.notes).toBe('Less sugar');

    // Modifiers contain name + priceAdjustment ONLY
    expect(item1.modifiers).toEqual([
      { name: 'Ít đường', priceAdjustment: 0 },
    ]);

    // Item must not expose internal IDs
    expect((item1 as any).id).toBeUndefined();
    expect((item1 as any).product_id).toBeUndefined();
    expect((item1 as any).menuItemId).toBeUndefined();
    expect((item1 as any).order_id).toBeUndefined();
  });

  it('validates strictly against CustomerOrderResponseSchema', () => {
    const projection = formatCustomerOrder(RAW_ORDER_ROW, RAW_ITEMS_ROWS);
    const parsed = CustomerOrderResponseSchema.safeParse(projection);
    if (!parsed.success) {
      throw new Error('Validation failed: ' + JSON.stringify(parsed.error.flatten()));
    }
    expect(parsed.success).toBe(true);
  });

  it('formatCustomerOrderItem produces customer-safe line items', () => {
    const singleRawItem = RAW_ITEMS_ROWS[0];
    const customerItem = formatCustomerOrderItem(singleRawItem);
    const parsed = CustomerOrderItemSchema.safeParse(customerItem);
    expect(parsed.success).toBe(true);
    expect((customerItem as any).product_id).toBeUndefined();
    expect((customerItem as any).id).toBeUndefined();
  });

  it('differentiates customer projection from staff formatOrder', () => {
    const customerProj = formatCustomerOrder(RAW_ORDER_ROW, RAW_ITEMS_ROWS);
    const staffProj = formatOrder(RAW_ORDER_ROW, RAW_ITEMS_ROWS, RAW_PAYMENTS_ROWS);

    // Staff projection includes source, payments, happyHourApplied, and serverStaff info
    expect(staffProj.payments).toEqual(RAW_PAYMENTS_ROWS);
    expect(staffProj.source).toBe('kiosk');
    expect(staffProj.happyHourApplied).toBe(true);
    expect(staffProj.server_staff_id).toBe('staff-99');

    // Customer projection does NOT
    expect((customerProj as any).payments).toBeUndefined();
    expect((customerProj as any).source).toBeUndefined();
    expect((customerProj as any).happyHourApplied).toBeUndefined();
    expect((customerProj as any).server_staff_id).toBeUndefined();

    // Staff items have IDs, customer items do not
    expect(staffProj.items[0].id).toBe(RAW_ITEMS_ROWS[0].id);
    expect((customerProj.items[0] as any).id).toBeUndefined();
  });
});
