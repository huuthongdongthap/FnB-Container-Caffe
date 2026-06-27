/**
 * @jest-test-type stub
 * @todo Phase 2 — Odoo POS Integration (40h)
 */

xdescribe('Odoo POS Integration — Phase 2', () => {
  beforeEach(() => {
    throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
  });

  test('odoo-sales-mapper: order → sale.order transformation', () => {
    // Will implement: mapOrderToSaleOrder()
    // Verifies: order lines, partner_id, amount_total, custom fields
  });

  test('odoo-product-client: getProductAvailability with caching', () => {
    // Will implement: getProductAvailability() with KV cache
    // Verifies: cache hit/miss, stock check, TTL behavior
  });

  test('integration: order → Odoo SO creation', () => {
    // Will implement: POST /api/odoo/sales-orders
    // Verifies: SO created, mapping saved, retry logic
  });

  test('checkout: product availability validation', () => {
    // Will implement: GET /api/odoo/products/:id/availability
    // Verifies: blocks checkout when stock insufficient
  });
});
