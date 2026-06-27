/**
 * Odoo Sales Mapper Unit Tests — Phase 2 (POS Integration)
 * Tests for order → sale.order transformation and customer mapping
 *
 * @jest-test-type unit
 */
import {
  mapOrderToSaleOrder,
  mapOrderItemToSaleOrderLine,
  mapCustomerToOdooPartner,
} from '../worker/src/lib/odoo-sales-mapper.js';

describe('Odoo Sales Mapper — Phase 2 (POS)', () => {
  // ── mapOrderItemToSaleOrderLine ──────────────────────────────────────

  describe('mapOrderItemToSaleOrderLine', () => {
    test('should map a normal item', () => {
      const result = mapOrderItemToSaleOrderLine(
        { product_id: 42, quantity: 2, unit_price: 15000, name: 'Cà phê sữa' },
        0,
      );
      expect(result).toEqual({
        product_id: 42,
        product_uom_qty: 2,
        price_unit: 15000,
        name: 'Cà phê sữa',
        sequence: 0,
      });
    });

    test('should handle null item', () => {
      const result = mapOrderItemToSaleOrderLine(null, 0);
      expect(result.product_id).toBeNull();
      expect(result.product_uom_qty).toBe(1);
      expect(result.price_unit).toBe(0);
      expect(result.name).toBe('Product 1');
      expect(result.sequence).toBe(0);
    });

    test('should handle undefined item', () => {
      const result = mapOrderItemToSaleOrderLine(undefined, 3);
      expect(result.product_id).toBeNull();
      expect(result.product_uom_qty).toBe(1);
      expect(result.price_unit).toBe(0);
      expect(result.name).toBe('Product 4');
      expect(result.sequence).toBe(3);
    });

    test('should accept id as product_id fallback', () => {
      const result = mapOrderItemToSaleOrderLine({ id: 99, quantity: 1 }, 0);
      expect(result.product_id).toBe(99);
    });

    test('should handle string quantity', () => {
      const result = mapOrderItemToSaleOrderLine({ quantity: '3', price: 10000 }, 0);
      expect(result.product_uom_qty).toBe(3);
    });

    test('should clamp zero/negative quantity to 1', () => {
      expect(mapOrderItemToSaleOrderLine({ quantity: 0 }, 0).product_uom_qty).toBe(1);
      expect(mapOrderItemToSaleOrderLine({ quantity: -5 }, 0).product_uom_qty).toBe(1);
    });

    test('should handle NaN quantity', () => {
      const result = mapOrderItemToSaleOrderLine({ quantity: NaN }, 0);
      expect(result.product_uom_qty).toBe(1);
    });

    test('should handle NaN price', () => {
      const result = mapOrderItemToSaleOrderLine({ price: NaN }, 0);
      expect(result.price_unit).toBe(0);
    });

    test('should accept price_unit and price as price fields', () => {
      expect(mapOrderItemToSaleOrderLine({ price_unit: 20000 }, 0).price_unit).toBe(20000);
      expect(mapOrderItemToSaleOrderLine({ price: 20000 }, 0).price_unit).toBe(20000);
    });

    test('should accept qty as quantity fallback', () => {
      const result = mapOrderItemToSaleOrderLine({ qty: 4 }, 0);
      expect(result.product_uom_qty).toBe(4);
    });

    test('should accept product_name as name fallback', () => {
      const result = mapOrderItemToSaleOrderLine({ product_name: 'Trà đào' }, 0);
      expect(result.name).toBe('Trà đào');
    });

    test('should truncate name to 256 chars', () => {
      const longName = 'A'.repeat(300);
      const result = mapOrderItemToSaleOrderLine({ name: longName }, 0);
      expect(result.name.length).toBe(256);
    });

    test('should trim name', () => {
      const result = mapOrderItemToSaleOrderLine({ name: '  Bánh mì  ' }, 0);
      expect(result.name).toBe('Bánh mì');
    });

    test('should use correct sequence index', () => {
      const r0 = mapOrderItemToSaleOrderLine({}, 0);
      const r5 = mapOrderItemToSaleOrderLine({}, 5);
      expect(r0.sequence).toBe(0);
      expect(r5.sequence).toBe(5);
    });
  });

  // ── mapCustomerToOdooPartner ────────────────────────────────────────

  describe('mapCustomerToOdooPartner', () => {
    test('should map a normal customer', () => {
      const result = mapCustomerToOdooPartner({
        id: 'cust_001',
        name: 'Nguyen Van A',
        phone: '0912345678',
        email: 'nguyena@example.com',
      });
      expect(result).toEqual({
        name: 'Nguyen Van A',
        phone: '0912345678',
        email: 'nguyena@example.com',
        x_our_customer_id: 'cust_001',
      });
    });

    test('should handle null customer', () => {
      const result = mapCustomerToOdooPartner(null);
      expect(result.name).toBe('Guest');
      expect(result.phone).toBe('');
      expect(result.email).toBe('');
      expect(result.x_our_customer_id).toBeNull();
    });

    test('should handle undefined customer', () => {
      const result = mapCustomerToOdooPartner(undefined);
      expect(result.name).toBe('Guest');
    });

    test('should handle empty object', () => {
      const result = mapCustomerToOdooPartner({});
      expect(result.name).toBe('Guest');
    });

    test('should fallback name to phone', () => {
      const result = mapCustomerToOdooPartner({ phone: '0909999999' });
      expect(result.name).toBe('0909999999');
    });

    test('should trim name and email', () => {
      const result = mapCustomerToOdooPartner({
        name: '  Tran Thi B  ',
        email: '  tranb@test.com  ',
      });
      expect(result.name).toBe('Tran Thi B');
      expect(result.email).toBe('tranb@test.com');
    });

    test('should truncate email to 128 chars', () => {
      const longEmail = 'a'.repeat(200) + '@test.com';
      const result = mapCustomerToOdooPartner({ email: longEmail });
      expect(result.email.length).toBe(128);
    });

    test('should truncate name to 128 chars', () => {
      const longName = 'A'.repeat(200);
      const result = mapCustomerToOdooPartner({ name: longName });
      expect(result.name.length).toBe(128);
    });

    test('should handle empty string name', () => {
      const result = mapCustomerToOdooPartner({ name: '' });
      expect(result.name).toBe('Guest');
    });
  });

  // ── mapOrderToSaleOrder ─────────────────────────────────────────────

  describe('mapOrderToSaleOrder', () => {
    const mockOrder = {
      id: 'ORD-001',
      created_at: '2026-06-26T10:00:00Z',
      status: 'completed',
    };

    const mockItems = [
      { product_id: 1, quantity: 2, unit_price: 15000, name: 'Cà phê sữa' },
      { product_id: 2, quantity: 1, unit_price: 25000, name: 'Bánh mì' },
    ];

    test('should map order with items and partner', () => {
      const result = mapOrderToSaleOrder(mockOrder, mockItems, 10);
      expect(result.partner_id).toBe(10);
      expect(result.order_line).toHaveLength(2);
      expect(result.client_order_ref).toBe('ORD-001');
      expect(result.date_order).toBe('2026-06-26');
      expect(result.state).toBe('sale');
    });

    test('should handle null partnerId', () => {
      const result = mapOrderToSaleOrder(mockOrder, mockItems, null);
      expect(result.partner_id).toBeNull();
    });

    test('should handle undefined partnerId', () => {
      const result = mapOrderToSaleOrder(mockOrder, mockItems, undefined);
      expect(result.partner_id).toBeNull();
    });

    test('should handle empty items array', () => {
      const result = mapOrderToSaleOrder(mockOrder, [], 10);
      expect(result.order_line).toHaveLength(1);
      expect(result.order_line[0].product_id).toBeNull();
    });

    test('should handle null order', () => {
      expect(() => mapOrderToSaleOrder(null, mockItems, 10)).toThrow(
        'Invalid order: order object is required',
      );
    });

    test('should handle undefined order', () => {
      expect(() => mapOrderToSaleOrder(undefined, mockItems, 10)).toThrow(
        'Invalid order: order object is required',
      );
    });

    test('should handle non-object order', () => {
      expect(() => mapOrderToSaleOrder('string', mockItems, 10)).toThrow(
        'Invalid order: order object is required',
      );
    });

    test('should handle null items', () => {
      const result = mapOrderToSaleOrder(mockOrder, null, 10);
      expect(result.order_line).toHaveLength(1);
    });

    test('should handle undefined items', () => {
      const result = mapOrderToSaleOrder(mockOrder, undefined, 10);
      expect(result.order_line).toHaveLength(1);
    });

    test('should filter out falsy items', () => {
      const mixedItems = [
        { product_id: 1, quantity: 1 },
        null,
        undefined,
        false,
        { product_id: 2, quantity: 1 },
      ];
      const result = mapOrderToSaleOrder(mockOrder, mixedItems, 10);
      expect(result.order_line).toHaveLength(2);
    });

    test('should use today date when created_at is missing', () => {
      const orderNoDate = { id: 'ORD-002' };
      const result = mapOrderToSaleOrder(orderNoDate, mockItems, 10);
      const today = new Date().toISOString().split('T')[0];
      expect(result.date_order).toBe(today);
    });

    test('should use today date when created_at is invalid', () => {
      const orderBadDate = { id: 'ORD-003', created_at: 'not-a-date' };
      const result = mapOrderToSaleOrder(orderBadDate, mockItems, 10);
      const today = new Date().toISOString().split('T')[0];
      expect(result.date_order).toBe(today);
    });

    test('should assign correct sequence indices', () => {
      const result = mapOrderToSaleOrder(mockOrder, mockItems, 10);
      expect(result.order_line[0].sequence).toBe(0);
      expect(result.order_line[1].sequence).toBe(1);
    });
  });
});
