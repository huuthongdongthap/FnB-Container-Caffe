/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — API Client v2
 *  Cloudflare Worker + D1 backend (no Supabase)
 * ═══════════════════════════════════════════════
 */

import { API_CONFIG } from './config.js';

const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;

// ── Core fetch helper ──────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const url = API_CONFIG.WORKER_BASE_URL + path;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timer);

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  } catch (err) {
    clearTimeout(timer);
    if (DEBUG) console.error(`[API] ${options.method || 'GET'} ${path}:`, err.message);
    throw err;
  }
}

// ── ApiService ─────────────────────────────────────────────────────────────
export const ApiService = {

  // ── Categories ──────────────────────────────────────────────────────────
  /** GET /api/categories → { success, data: Category[] } */
  async getCategories() {
    const res = await apiFetch('/api/categories');
    return res.data ?? [];
  },

  // ── Products ────────────────────────────────────────────────────────────
  /**
   * GET /api/products
   * @param {object} [opts]
   * @param {string} [opts.category_id]
   * @param {0|1}    [opts.available]   — default: only available (1)
   */
  async getProducts(opts = {}) {
    const params = new URLSearchParams();
    if (opts.category_id) params.set('category_id', opts.category_id);
    if (opts.available !== undefined) params.set('available', opts.available);
    else params.set('available', '1');

    const qs = params.toString();
    const res = await apiFetch(`/api/products${qs ? '?' + qs : ''}`);
    return res.data ?? [];
  },

  /** GET /api/products/:id */
  async getProduct(id) {
    const res = await apiFetch(`/api/products/${id}`);
    return res.data ?? null;
  },

  // ── Tables ──────────────────────────────────────────────────────────────
  /**
   * GET /api/tables
   * @param {object} [opts]
   * @param {string} [opts.zone]   — 'Ground' | 'Rooftop' | 'Courtyard'
   * @param {string} [opts.status] — 'Available' | 'Occupied' | 'Reserved'
   */
  async getTables(opts = {}) {
    const params = new URLSearchParams(opts).toString();
    const res = await apiFetch(`/api/tables${params ? '?' + params : ''}`);
    return res.data ?? [];
  },

  /** PATCH /api/tables/:id/status */
  async updateTableStatus(id, status) {
    const res = await apiFetch(`/api/tables/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res;
  },

  // ── Orders ──────────────────────────────────────────────────────────────
  /**
   * GET /api/orders
   * @param {object} [opts]
   * @param {string} [opts.status]
   * @param {string} [opts.table_id]
   * @param {number} [opts.limit]
   * @param {number} [opts.offset]
   */
  async getOrders(opts = {}) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined))
    ).toString();
    const res = await apiFetch(`/api/orders${params ? '?' + params : ''}`);
    return res.data ?? [];
  },

  /** GET /api/orders/:id  (includes items[]) */
  async getOrder(id) {
    const res = await apiFetch(`/api/orders/${id}`);
    return res.data ?? null;
  },

  /**
   * POST /api/orders
   * @param {object} orderData
   * @param {string}   orderData.customer_name
   * @param {string}   [orderData.phone]
   * @param {string}   [orderData.table_id]
   * @param {string}   [orderData.notes]
   * @param {Array}    orderData.items  — [{product_id, quantity, price, modifiers?}]
   */
  async createOrder(orderData) {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return res.data ?? res;
  },

  /**
   * PATCH /api/orders/:id/status
   * @param {string} id
   * @param {string} status — 'Bep tiep nhan' | 'Dang pha che' | 'San sang' | 'Hoan thanh' | 'Da huy'
   */
  async updateOrderStatus(id, status) {
    const res = await apiFetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.data ?? res;
  },

  // ── Health ───────────────────────────────────────────────────────────────
  async health() {
    return apiFetch('/api/health');
  },
};

// ── Legacy named exports (backward compat) ─────────────────────────────────

/** @deprecated — use ApiService.getProducts() */
export async function fetchMenu(categoryId = null) {
  try {
    return await ApiService.getProducts(categoryId ? { category_id: categoryId } : {});
  } catch { return []; }
}

/** @deprecated — use ApiService.getProduct(id) */
export async function fetchMenuItem(id) {
  try { return await ApiService.getProduct(id); } catch { return null; }
}

export async function createOrder(orderData) {
  return ApiService.createOrder(orderData);
}

export async function getOrder(id) {
  return ApiService.getOrder(id);
}

export async function getOrderByPhone(phone) {
  try {
    const orders = await ApiService.getOrders();
    return orders.filter(o => o.phone === phone);
  } catch { return []; }
}

export async function updateOrderStatus(id, status) {
  return ApiService.updateOrderStatus(id, status);
}

export async function cancelOrder(id) {
  return ApiService.updateOrderStatus(id, 'Da huy');
}

/** @deprecated — KDS should call ApiService.getOrders() directly */
export async function fetchAdminOrders(params = {}) {
  try { return await ApiService.getOrders(params); } catch { return []; }
}

// Payment stubs — implemented in checkout.js via PAYMENT_CONFIG
export async function createPayOSPayment(data) { return null; }
export async function createVNPayPayment(data) { return null; }
export async function createMoMoPayment(data)  { return null; }

export { apiFetch as apiClient };

export default ApiService;
