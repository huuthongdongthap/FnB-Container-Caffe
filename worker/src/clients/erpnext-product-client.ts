/**
 * ErpnextProductClient — Product availability, delta sync, and two-way product data.
 *
 * Wraps ErpnextClient with product-specific operations:
 * - Availability lookup via Bin doctype with KV caching (30s TTL)
 * - Delta sync: detect changed items via modified timestamp
 * - Batch sync: push ERPNext Item data into local D1
 * - Write-back: push local price/stock updates to ERPNext Item
 */

import { createErpnextClient, ErpnextClient } from './erpnext-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductAvailability {
  available: boolean;
  stock: number;
  estimatedRestock: null;
  cachedAt?: string;
}

export interface ChangedProduct {
  name: string;
  item_code: string;
  item_name: string;
  modified: string | null;
}

export interface SyncResult {
  updated: number;
  errors: Array<{ productId: string; error: string }>;
}

export interface KVNamespace {
  get: (key: string, type?: 'json' | 'text') => Promise<unknown>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export interface ProductEnv {
  AURA_DB?: D1Database;
  AURA_KV?: KVNamespace;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
}

interface D1Database {
  prepare: (sql: string) => D1Statement;
}

interface D1Statement {
  bind: (...args: Array<string | number | null>) => D1Statement;
  run: () => Promise<{ success: boolean }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CACHE_TTL = 30;

// ---------------------------------------------------------------------------
// ErpnextProductClient
// ---------------------------------------------------------------------------

export class ErpnextProductClient {
  client: ErpnextClient;
  auraKv: KVNamespace | null;
  auraDb: D1Database | null;
  cacheTtl: number;

  constructor(client: ErpnextClient, env: ProductEnv = {}) {
    if (!client) {
      throw new Error('ErpnextProductClient: erpnextClient is required');
    }
    this.client = client;
    this.auraKv = env.AURA_KV || null;
    this.auraDb = env.AURA_DB || null;
    this.cacheTtl = DEFAULT_CACHE_TTL;
  }

  async getProductAvailability(itemCode: string): Promise<ProductAvailability> {
    if (!itemCode) {
      throw new Error('getProductAvailability: itemCode is required');
    }

    const cacheKey = `erpnext:product:availability:${itemCode}`;

    if (this.auraKv) {
      try {
        const cached = await this.auraKv.get(cacheKey, 'json');
        if (cached !== null) {
          return { ...(cached as ProductAvailability), cachedAt: new Date().toISOString() };
        }
      } catch {
        // Cache read failure is non-fatal
      }
    }

    const result = await this.client.getProductAvailability(itemCode);
    const stockEntries = Array.isArray(result.stock) ? result.stock : [];
    const totalQty = stockEntries.reduce((sum, bin) => {
      const qty = typeof bin.actual_qty === 'number' ? bin.actual_qty : Number(bin.actual_qty) || 0;
      return sum + qty;
    }, 0);
    const available = totalQty > 0;

    const output: ProductAvailability = { available, stock: totalQty, estimatedRestock: null };

    if (this.auraKv) {
      try {
        await this.auraKv.put(cacheKey, JSON.stringify(output), { expirationTtl: this.cacheTtl });
      } catch {
        // Cache write failure is non-fatal
      }
    }

    return { ...output, cachedAt: new Date().toISOString() };
  }

  async searchChangedProducts(since: Date | string): Promise<ChangedProduct[]> {
    if (!since) {
      throw new Error('searchChangedProducts: since timestamp is required');
    }

    const sinceStr = since instanceof Date ? since.toISOString() : String(since);

    const response = await this.client.searchModified('Item', sinceStr, [
      'name', 'item_code', 'item_name', 'stock_uom', 'modified',
    ]);

    const items = (response.data as Array<Record<string, unknown>>) || [];

    return items.map(item => ({
      name: item.name as string,
      item_code: (item.item_code as string) || (item.name as string),
      item_name: (item.item_name as string) || '',
      modified: (item.modified as string) || null,
    }));
  }

  async syncProductsToLocal(env: ProductEnv, products: ChangedProduct[]): Promise<SyncResult> {
    if (!env.AURA_DB) {
      throw new Error('syncProductsToLocal: AURA_DB not configured in env');
    }

    if (!Array.isArray(products) || products.length === 0) {
      return { updated: 0, errors: [] };
    }

    const db = env.AURA_DB;
    const now = new Date().toISOString();
    let updated = 0;
    const errors: Array<{ productId: string; error: string }> = [];

    for (const product of products) {
      const localId = product.item_code || product.name;

      if (!localId) {
        errors.push({ productId: String(product.name || 'unknown'), error: 'Missing item_code — cannot map to local product' });
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
        `).bind(localId, product.name, now, product.modified || now).run();

        updated++;
      } catch (e: unknown) {
        errors.push({ productId: localId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return { updated, errors };
  }

  async updateProduct(itemCode: string, data: Record<string, unknown>): Promise<boolean> {
    if (!itemCode) throw new Error('updateProduct: itemCode is required');
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error('updateProduct: data object must not be empty');
    }

    const allowedFields = new Set(['item_name', 'stock_uom', 'standard_rate', 'custom_aura_price']);

    const sanitizedUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.has(key)) {
        sanitizedUpdates[key] = value;
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('updateProduct: no valid fields after filtering');
    }

    await this.client.update('Item', itemCode, sanitizedUpdates);

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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createErpnextProductClient(env: ProductEnv): ErpnextProductClient | null {
  const client = createErpnextClient(env);
  if (!client) return null;
  return new ErpnextProductClient(client, env);
}

export default ErpnextProductClient;
