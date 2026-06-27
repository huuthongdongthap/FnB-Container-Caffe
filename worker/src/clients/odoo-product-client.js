/**
 * OdooProductClient — Phase 2: Product availability, stock sync, and two-way product data
 *
 * Wraps OdooClient with product-specific operations:
 * - Availability lookup with KV caching (30s TTL)
 * - Delta sync: detect changed products via write_date
 * - Batch sync: push Odoo product data into local D1
 * - Write-back: push local price/stock updates to Odoo
 *
 * @example
 * const client = new OdooProductClient(odooClient, env);
 * const { available, stock } = await client.getProductAvailability('prod_abc');
 * const { updated, errors } = await client.syncProductsToLocal(odooProducts);
 */

import { OdooClient, OdooError } from './odoo-client.js';

/** Default TTL for product availability cache (seconds) */
const DEFAULT_CACHE_TTL = 30;

/** Fields fetched from Odoo for availability checks */
const AVAILABILITY_FIELDS = ['qty_available', 'virtual_available'];

/** Fields fetched from Odoo for delta sync */
const SYNC_FIELDS = ['id', 'default_code', 'list_price', 'qty_available', 'write_date'];

/**
 * OdooProductClient — product sync and availability operations
 */
export class OdooProductClient {
  /**
   * @param {import('./odoo-client').OdooClient} odooClient - Authenticated Odoo RPC client
   * @param {Object} [env] - Cloudflare environment bindings (AURA_DB, AURA_KV)
   */
  constructor(odooClient, env = {}) {
    if (!odooClient) {
      throw new Error('OdooProductClient: odooClient is required');
    }
    this.odoo = odooClient;
    this.auraDb = env.AURA_DB || null;
    this.auraKv = env.AURA_KV || null;
    this.cacheTtl = DEFAULT_CACHE_TTL;
    this.logger = env.LOGGER || null;
  }

  // =====================================================================
  // 1. getProductAvailability(productId)
  // =====================================================================

  /**
   * Look up product availability from Odoo with KV caching.
   *
   * Flow:
   * 1. Resolve local productId → odoo_product_id via odoo_product_sync table
   * 2. Check KV cache (key: `odoo:product:availability:${productId}`)
   * 3. On cache miss: call Odoo searchRead for qty_available + virtual_available
   * 4. Cache result in KV for 30s
   * 5. Return formatted availability object
   *
   * @param {string} productId - Local product ID (matches odoo_product_sync.product_id)
   * @returns {Promise<{available: boolean, stock: number, estimatedRestock: string|null, cachedAt: string}>}
   * @throws {Error} If product mapping not found or Odoo call fails
   */
  async getProductAvailability(productId) {
    if (!productId) {
      throw new Error('getProductAvailability: productId is required');
    }

    if (!this.auraDb) {
      throw new Error('getProductAvailability: AURA_DB not configured in env');
    }

    // 1. Resolve local productId → odoo_product_id
    const mapping = await this._findProductMapping(productId);
    if (!mapping) {
      throw new Error(
        `Product mapping not found for local product ${productId}. ` +
        'Run syncProductsToLocal() first to establish the mapping.'
      );
    }

    const odooProductId = mapping.odoo_product_id;
    const cacheKey = `odoo:product:availability:${productId}`;

    // 2. Check KV cache
    if (this.auraKv) {
      try {
        const cached = await this.auraKv.get(cacheKey, 'json');
        if (cached !== null) {
          this._log('debug', 'Product availability cache hit', { productId, odooProductId });
          return { ...cached, cachedAt: new Date().toISOString() };
        }
      } catch (e) {
        // Cache read failure is non-fatal — fall through to Odoo fetch
        this._log('warn', 'KV cache read failed, falling back to Odoo', {
          productId, error: e.message,
        });
      }
    }

    // 3. Cache miss: fetch from Odoo
    this._log('debug', 'Product availability cache miss, fetching from Odoo', {
      productId, odooProductId,
    });

    const [product] = await this.odoo.searchRead(
      'product.product',
      [['id', '=', odooProductId]],
      AVAILABILITY_FIELDS
    );

    if (!product) {
      throw new Error(
        `Odoo product not found: id=${odooProductId} (mapped from local ${productId})`
      );
    }

    const qtyAvailable = Number(product.qty_available) || 0;
    const virtualAvailable = Number(product.virtual_available) || 0;
    const stock = Math.max(qtyAvailable, virtualAvailable);
    const available = stock > 0;

    // Estimate restock: if out of stock, flag for attention (no Odoo restock date in standard fields)
    const estimatedRestock = available ? null : null;

    const result = {
      available,
      stock,
      estimatedRestock,
    };

    // 4. Cache in KV
    if (this.auraKv) {
      try {
        await this.auraKv.put(cacheKey, JSON.stringify(result), {
          expirationTtl: this.cacheTtl,
        });
        this._log('debug', 'Product availability cached', {
          productId, odooProductId, ttl: this.cacheTtl,
        });
      } catch (e) {
        this._log('warn', 'KV cache write failed', {
          productId, error: e.message,
        });
      }
    }

    return { ...result, cachedAt: new Date().toISOString() };
  }

  // =====================================================================
  // 2. searchChangedProducts(since)
  // =====================================================================

  /**
   * Find Odoo products modified after a given timestamp.
   *
   * Used for delta sync: only pull products that changed since last sync.
   * Odoo's `write_date` is updated on every write operation.
   *
   * @param {Date|string} since - ISO timestamp or Date of last sync
   * @returns {Promise<Array<{id: number, default_code: string, list_price: number, qty_available: number, write_date: string}>>}
   * @throws {Error} If Odoo call fails
   */
  async searchChangedProducts(since) {
    if (!since) {
      throw new Error('searchChangedProducts: since timestamp is required');
    }

    const sinceStr = since instanceof Date ? since.toISOString() : String(since);

    this._log('info', 'Searching changed products in Odoo', { since: sinceStr });

    const products = await this.odoo.searchRead(
      'product.product',
      [['write_date', '>', sinceStr]],
      SYNC_FIELDS
    );

    this._log('info', 'Changed products found', {
      since: sinceStr,
      count: products.length,
    });

    return products.map(p => ({
      id: p.id,
      default_code: p.default_code || null,
      list_price: p.list_price != null ? Number(p.list_price) : null,
      qty_available: p.qty_available != null ? Number(p.qty_available) : null,
      write_date: p.write_date || null,
    }));
  }

  // =====================================================================
  // 3. syncProductsToLocal(products)
  // =====================================================================

  /**
   * Batch-update the local odoo_product_sync table with Odoo product data.
   *
   * For each product:
   * - Upsert into odoo_product_sync (product_id = default_code, odoo_product_id = id)
   * - Update cached_stock and cached_price
   * - Track last_synced_at and odoo_write_date for delta sync
   *
   * @param {Array<{id: number, default_code: string, list_price: number, qty_available: number, write_date: string}>} products - Product data from Odoo
   * @returns {Promise<{updated: number, errors: Array<{productId: string, error: string}>}>}
   * @throws {Error} If AURA_DB is not configured
   */
  async syncProductsToLocal(products) {
    if (!this.auraDb) {
      throw new Error('syncProductsToLocal: AURA_DB not configured in env');
    }

    if (!Array.isArray(products) || products.length === 0) {
      return { updated: 0, errors: [] };
    }

    const now = new Date().toISOString();
    let updated = 0;
    const errors = [];

    for (const product of products) {
      const localProductId = product.default_code;
      if (!localProductId) {
        errors.push({
          productId: String(product.id),
          error: 'Missing default_code — cannot map to local product',
        });
        continue;
      }

      try {
        await this.auraDb.prepare(`
          INSERT INTO odoo_product_sync
            (product_id, odoo_product_id, last_synced_at, odoo_write_date, cached_stock, cached_price)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(product_id) DO UPDATE SET
            odoo_product_id = excluded.odoo_product_id,
            last_synced_at  = excluded.last_synced_at,
            odoo_write_date = excluded.odoo_write_date,
            cached_stock    = excluded.cached_stock,
            cached_price    = excluded.cached_price
        `).bind(
          localProductId,
          product.id,
          now,
          product.write_date || now,
          product.qty_available != null ? Math.round(product.qty_available) : null,
          product.list_price != null ? Math.round(product.list_price * 100) / 100 : null,
        ).run();

        updated++;
      } catch (e) {
        this._log('error', 'Failed to sync product to local DB', {
          localProductId, odooProductId: product.id, error: e.message,
        });
        errors.push({
          productId: localProductId,
          error: e.message,
        });
      }
    }

    this._log('info', 'Product sync to local DB complete', {
      total: products.length,
      updated,
      errors: errors.length,
    });

    return { updated, errors };
  }

  // =====================================================================
  // 4. updateOdooProduct(odooProductId, updates)
  // =====================================================================

  /**
   * Push local product changes to Odoo.
   *
   * Calls Odoo's `write` method on `product.product`.
   * Typical use: admin updates price or stock in our system → reflect in Odoo.
   *
   * @param {number} odooProductId - Odoo product.product ID
   * @param {Object} updates - Fields to update, e.g. `{ list_price: 45000, qty_available: 100 }`
   * @returns {Promise<boolean>} True if Odoo accepted the write
   * @throws {Error} If write fails or parameters are invalid
   */
  async updateOdooProduct(odooProductId, updates) {
    if (!odooProductId || typeof odooProductId !== 'number') {
      throw new Error(
        `updateOdooProduct: odooProductId must be a number, got ${typeof odooProductId}`
      );
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new Error('updateOdooProduct: updates object must not be empty');
    }

    // Whitelist allowed fields to prevent accidental writes to sensitive Odoo fields
    const allowedFields = new Set([
      'list_price',
      'qty_available',
      'virtual_available',
      'standard_price',
      'sale_ok',
      'active',
      'name',
      'default_code',
    ]);

    const sanitizedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.has(key)) {
        this._log('warn', 'Skipping disallowed field in updateOdooProduct', {
          odooProductId, field: key,
        });
        continue;
      }
      sanitizedUpdates[key] = value;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('updateOdooProduct: no valid fields after filtering');
    }

    this._log('info', 'Updating Odoo product', {
      odooProductId, fields: Object.keys(sanitizedUpdates),
    });

    const success = await this.odoo.update('product.product', odooProductId, sanitizedUpdates);

    if (!success) {
      throw new Error(
        `Odoo write returned false for product.product id=${odooProductId}`
      );
    }

    this._log('info', 'Odoo product updated successfully', { odooProductId });

    // Invalidate KV cache for this product if we know the local productId
    if (this.auraDb && this.auraKv) {
      try {
        const mapping = await this._findProductMappingByOdooId(odooProductId);
        if (mapping) {
          const cacheKey = `odoo:product:availability:${mapping.product_id}`;
          await this.auraKv.delete(cacheKey);
          this._log('debug', 'Invalidated product availability cache', {
            productId: mapping.product_id,
          });
        }
      } catch (e) {
        // Cache invalidation failure is non-fatal
        this._log('warn', 'Cache invalidation failed', {
          odooProductId, error: e.message,
        });
      }
    }

    return true;
  }

  // =====================================================================
  // Private helpers
  // =====================================================================

  /**
   * Find product mapping by local product_id
   * @private
   */
  async _findProductMapping(productId) {
    const stmt = this.auraDb.prepare(
      'SELECT product_id, odoo_product_id, last_synced_at, odoo_write_date, cached_stock, cached_price ' +
      'FROM odoo_product_sync WHERE product_id = ? LIMIT 1'
    ).bind(productId);
    return await stmt.first();
  }

  /**
   * Find product mapping by odoo_product_id (reverse lookup)
   * @private
   */
  async _findProductMappingByOdooId(odooProductId) {
    const stmt = this.auraDb.prepare(
      'SELECT product_id, odoo_product_id FROM odoo_product_sync WHERE odoo_product_id = ? LIMIT 1'
    ).bind(odooProductId);
    return await stmt.first();
  }

  /**
   * Structured logging wrapper
   * @private
   */
  _log(level, message, meta = {}) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, meta);
    }
  }
}

/**
 * Factory: create OdooProductClient with environment bindings
 *
 * @param {Object} env - Cloudflare environment (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, AURA_DB, AURA_KV)
 * @returns {OdooProductClient|null}
 */
export function createOdooProductClient(env) {
  try {
    const odooClient = new OdooClient({
      url: env.ODOO_URL,
      db: env.ODOO_DB,
      username: env.ODOO_USERNAME,
      apiKey: env.ODOO_API_KEY,
      auraDb: env.AURA_DB,
    });
    return new OdooProductClient(odooClient, env);
  } catch {
    return null;
  }
}

export default OdooProductClient;
