/**
 * Odoo Product Client — Phase 2 Stub
 * Handles product availability, stock sync, and two-way product data
 *
 * @todo Phase 2 implementation (40h)
 * - Implement getProductAvailability() with KV caching
 * - Implement searchChangedProducts() for delta sync
 * - Add batch operations for bulk updates
 * - Integrate with odoo-client.js base class
 */

export class OdooProductClient {
  /**
   * @param {import('./odoo-client').OdooClient} odooClient
   */
  constructor(odooClient) {
    this.odoo = odooClient;
    this.CACHE_TTL = 30; // seconds
  }

  /**
   * Get product availability from Odoo
   * @param {string} productId - Our local product ID
   * @returns {Promise<{available: boolean, stock: number, estimatedRestock: string|null}>}
   */
  async getProductAvailability(productId) {
    // STUB: Phase 2 implementation
    // 1. Look up odoo_product_id from mapping
    // 2. Call odoo.searchRead('product.product', [['id', '=', odooId]], ['qty_available', 'virtual_available'])
    // 3. Cache in KV with TTL
    // 4. Return formatted result
    throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
  }

  /**
   * Search for products changed since last sync
   * @param {Date} since - Last sync timestamp
   * @returns {Promise<Array<{id: number, default_code: string, list_price: number, qty_available: number}>>}
   */
  async searchChangedProducts(since) {
    // STUB: Phase 2 implementation
    // Use odoo.searchRead with write_date domain
    throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
  }

  /**
   * Update local products with Odoo data
   * @param {Array} products - Product data from Odoo
   * @returns {Promise<{updated: number, errors: Array}>}
   */
  async syncProductsToLocal(products) {
    // STUB: Phase 2 implementation
    // Batch update D1 products table
    throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
  }

  /**
   * Push product changes to Odoo (admin price/stock updates)
   * @param {string} odooProductId - Odoo product ID
   * @param {Object} updates - { list_price?, qty_available? }
   * @returns {Promise<boolean>}
   */
  async updateOdooProduct(odooProductId, updates) {
    // STUB: Phase 2 implementation
    // Call odoo.write('product.product', odooProductId, updates)
    throw new Error('NOT_IMPLEMENTED: Phase 2 — Odoo POS Integration');
  }
}
