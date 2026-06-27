/**
 * Odoo Sales Order Mapper — Phase 2 Stub
 * Transforms our orders into Odoo sale.order format
 *
 * @todo Phase 2 implementation (40h)
 * - Map order → sale.order with order lines
 * - Handle customer mapping (create partner if needed)
 * - Transform products to Odoo product IDs
 * - Add tax/compliance fields for Vietnam
 */

/**
 * Transform our order to Odoo sale.order values
 * @param {Object} order - Our order from D1
 * @param {Object} items - Order items with product details
 * @param {string|null} odooCustomerId - Existing Odoo partner ID or null
 * @returns {Promise<Object>} Odoo sale.order values
 */
export function mapOrderToSaleOrder(order, items, odooCustomerId) {
  // STUB: Phase 2 implementation
  // Expected Odoo structure:
  // {
  //   partner_id: odooCustomerId,
  //   date_order: order.created_at,
  //   order_line: [
  //     { product_id: odooProductId, product_uom_qty: quantity, price_unit: unit_price },
  //     ...
  //   ],
  //   amount_total: order.total,
  //   x_our_order_id: order.id  // custom field for mapping
  // }

  throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
}

/**
 * Map product availability response
 * @param {Object} odooProduct - Product from Odoo
 * @returns {Object}
 */
export function mapProductAvailability(odooProduct) {
  // STUB: Phase 2 implementation
  throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
}
