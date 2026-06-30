/**
 * ErpnextProductClient — Product availability, delta sync, and two-way product data.
 *
 * Wraps ErpnextClient with product-specific operations:
 * - Availability lookup via Bin doctype with KV caching (30s TTL)
 * - Delta sync: detect changed items via modified timestamp
 * - Batch sync: push ERPNext Item data into local D1
 * - Write-back: push local price/stock updates to ERPNext Item
 *
 * @example
 * const client = createErpnextProductClient(env);
 * const avail = await client.getProductAvailability('ITEM-001');
 * const changed = await client.searchChangedProducts('2026-06-30T00:00:00Z');
 * const result = await client.syncProductsToLocal(env, changed);
 */

import { createErpnextClient } from './erpnext-client.js';

/** Default TTL for product availability cache (seconds) */
const DEFAULT_CACHE_TTL = 30;

/**
 * ErpnextProductClient — product sync and availability operations
 */
export class ErpnextProductClient {
  /**
   * @param {import('./erpnext-client').ErpnextClient} client - Authenticated ERPNext REST client
   * @param {Object} [env] - Cloudflare environment bindings (AURA_DB, AURA_KV)
   */
  constructor(client, env = {}) {
    if (!client) {
      throw new Error('ErpnextProductClient: erpnextClient is required');
    }
    this.client = client;
    this.auraKv = env.AURA_KV || null;
    this.auraDb = env.AURA_DB || null;
    this.cacheTtl = DEFAULT_CACHE_TTL;
  }

  // =====================================================================
  // 1. getProductAvailability(itemCode)
  // =====================================================================

  /**
   * Look up product availability via ERPNext Bin doctype with KV caching.
   *
   * Flow:
   * 1. Check KV cache (key: `erpnext:product:availability:${itemCode}`)
   * 2. On cache miss: call client.getProductAvailability() which queries Item + Bin
   * 3. Cache result in KV for 30s
   * 4. Return formatted availability object
   *
   * @param {string} itemCode - ERPNext Item code
   * @returns {Promise<{available: boolean, stock: number, estimatedRestock: null, cachedAt: string}>}
   * @throws {Error} If itemCode is invalid or ERPNext call fails
   */
  async getProductAvailability(itemCode) {
    if (!itemCode) {
      throw new Error('getProductAvailability: itemCode is required');
    }

    const cacheKey = `erpnext:product:availability:${itemCode}`;

    // 1. Check KV cache
    if (this.auraKv) {
      try {
        const cached = await this.auraKv.get(cacheKey, 'json');
        if (cached !== null) {
          return { ...cached, cachedAt: new Date().toISOString() };
        }
      } catch {
        // Cache read failure is non-fatal — fall through to ERPNext fetch
      }
    }

    // 2. Cache miss: fetch from ERPNext (Item + Bin)
    const result = await this.client.getProductAvailability(itemCode);
    const stockEntries = Array.isArray(result.stock) ? result.stock : [];
    const totalQty = stockEntries.reduce((sum, bin) => {
      const qty = typeof bin.actual_qty === 'number' ? bin.actual_qty : Number(bin.actual_qty) || 0;
      return sum + qty;
    }, 0);
    const available = totalQty > 0;

    const output = {
      available,
      stock: totalQty,
      estimatedRestock: null,
    };

    // 3. Cache in KV
    if (this.auraKv) {
      try {
        await this.auraKv.put(cacheKey, JSON.stringify(output), {
          expirationTtl: this.cacheTtl,
        });
      } catch {
        // Cache write failure is non-fatal
      }
    }

    return { ...output, cachedAt: new Date().toISOString() };
  }

  // =====================================================================
  // 2. searchChangedProducts(since)
  // =====================================================================

  /**
   * Find ERPNext Items modified after a given timestamp.
   *
   * Uses the base client's searchModified method which handles the
   * required ".0" suffix on ERPNext datetime filters.
   *
   * @param {Date|string} since - ISO timestamp or Date of last sync
   * @returns {Promise<Array<{name: string, item_code: string, item_name: string, modified: string|null}>>}
   * @throws {Error} If since is invalid or ERPNext call fails
   */
  async searchChangedProducts(since) {
    if (!since) {
      throw new Error('searchChangedProducts: since timestamp is required');
    }

    const sinceStr = since instanceof Date ? since.toISOString() : String(since);

    const response = await this.client.searchModified('Item', sinceStr, [
      'name',
      'item_code',
      'item_name',
      'stock_uom',
      'modified',
    ]);

    const items = response.data || [];

    return items.map(item => ({
      name: item.name,
      item_code: item.item_code || item.name,
      item_name: item.item_name || '',
      modified: item.modified || null,
    }));
  }

  // =====================================================================
  // 3. syncProductsToLocal(products)
  // =====================================================================

  /**
   * Batch-update the local erpnext_product_sync table with ERPNext Item data.
   *
   * For each product:
   * - Upsert into erpnext_product_sync (product_id = item_code, erpnext_item_code = name)
   * - Track last_synced_at and erpnext_modified for delta sync
   *
   * @param {Object} env - Cloudflare Worker environment (must have AURA_DB)
   * @param {Array<{name: string, item_code: string, item_name: string, modified: string|null}>} products - Product data from ERPNext
   * @returns {Promise<{updated: number, errors: Array<{productId: string, error: string}>}>}
   * @throws {Error} If AURA_DB is not configured
   */
  async syncProductsToLocal(env, products) {
    if (!env.AURA_DB) {
      throw new Error('syncProductsToLocal: AURA_DB not configured in env');
    }

    if (!Array.isArray(products) || products.length === 0) {
      return { updated: 0, errors: [] };
    }

    const db = env.AURA_DB;
    const now = new Date().toISOString();
    let updated = 0;
    const errors = [];

    for (const product of products) {
      const localId = product.item_code || product.name;

      if (!localId) {
        errors.push({
          productId: String(product.name || 'unknown'),
          error: 'Missing item_code — cannot map to local product',
        });
        continue;
      }

      try {
        await db.prepare(`
          INSERT INTO erpnext_product_sync
            (product_id, erpnext_item_code, last_synced_at, erpnext_modified)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(product_id) DO UPDATE SET
            erpnext_item_code = excluded.erpnext_item_code,
            last_synced_at    = excluded.last_synced_at,
            erpnext_modified  = excluded.erpnext_modified
        `).bind(
          localId,
          product.name,
          now,
          product.modified || now,
        ).run();

        updated++;
      } catch (e) {
        errors.push({
          productId: localId,
          error: e.message,
        });
      }
    }

    return { updated, errors };
  }

  // =====================================================================
  // 4. updateProduct(itemCode, data)
  // =====================================================================

  /**
   * Push local product changes to ERPNext Item.
   *
   * Only whitelisted fields are written to prevent accidental overwrite
   * of sensitive ERPNext fields.
   *
   * @param {string} itemCode - ERPNext Item code
   * @param {Object} data - Fields to update (item_name, stock_uom, standard_rate, custom_aura_price)
   * @returns {Promise<boolean>} True if ERPNext accepted the update
   * @throws {Error} If parameters are invalid or update fails
   */
  async updateProduct(itemCode, data) {
    if (!itemCode) {
      throw new Error('updateProduct: itemCode is required');
    }

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error('updateProduct: data object must not be empty');
    }

    // Whitelist allowed fields to prevent accidental writes to sensitive ERPNext fields
    const allowedFields = new Set([
      'item_name',
      'stock_uom',
      'standard_rate',
      'custom_aura_price',
    ]);

    const sanitizedUpdates = {};
    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.has(key)) {
        sanitizedUpdates[key] = value;
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('updateProduct: no valid fields after filtering');
    }

    await this.client.update('Item', itemCode, sanitizedUpdates);

    // Invalidate KV cache for this product
    if (this.auraKv) {
      try {
        await this.auraKv.delete(`erpnext:product:availability:${itemCode}`);
      } catch {
        // Cache invalidation failure is non-fatal
      }
    }

    return true;
  }
}

/**
 * Factory: create ErpnextProductClient with environment bindings.
 *
 * @param {Object} env - Cloudflare environment (ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET, AURA_DB, AURA_KV)
 * @returns {ErpnextProductClient|null}
 */
export function createErpnextProductClient(env) {
  const client = createErpnextClient(env);
  if (!client) {return null;}
  return new ErpnextProductClient(client, env);
}

export default ErpnextProductClient;
