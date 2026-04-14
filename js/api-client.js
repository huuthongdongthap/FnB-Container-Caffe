/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — API Client v2
 *  Cloudflare Worker + D1 backend (no Supabase)
 * ═══════════════════════════════════════════════
 */

import { API_CONFIG } from './config.js';

const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;

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
    if (!res.ok) {throw new Error(json.error || `HTTP ${res.status}`);}
    return json;
  } catch (err) {
    clearTimeout(timer);
    if (DEBUG) {console.error(`[API] ${options.method || 'GET'} ${path}:`, err.message);}
    throw err;
  }
}

export const ApiService = {
  async getCategories() {
    const res = await apiFetch('/api/categories');
    return res.data ?? [];
  },
  async getProducts(opts = {}) {
    const params = new URLSearchParams();
    if (opts.category_id) {params.set('category_id', opts.category_id);}
    if (opts.available !== undefined) {params.set('available', opts.available);}
    else {params.set('available', '1');}
    const qs = params.toString();
    const res = await apiFetch(`/api/products${qs ? '?' + qs : ''}`);
    return res.data ?? [];
  },
  async getProduct(id) {
    const res = await apiFetch(`/api/products/${id}`);
    return res.data ?? null;
  },
  async getTables(opts = {}) {
    const params = new URLSearchParams(opts).toString();
    const res = await apiFetch(`/api/tables${params ? '?' + params : ''}`);
    return res.data ?? [];
  },
  async updateTableStatus(id, status) {
    return apiFetch(`/api/tables/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  async getOrders(opts = {}) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined))
    ).toString();
    const res = await apiFetch(`/api/orders${params ? '?' + params : ''}`);
    return res.data ?? [];
  },
  async getOrder(id) {
    const res = await apiFetch(`/api/orders/${id}`);
    return res.data ?? null;
  },
  async createOrder(orderData) {
    const res = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(orderData) });
    return res.data ?? res;
  },
  async updateOrderStatus(id, status) {
    const res = await apiFetch(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    return res.data ?? res;
  },
  async health() { return apiFetch('/api/health'); },
};

export async function fetchMenu(categoryId = null) {
  try { return await ApiService.getProducts(categoryId ? { category_id: categoryId } : {}); } catch { return []; }
}
export async function fetchMenuItem(id) {
  try { return await ApiService.getProduct(id); } catch { return null; }
}
export async function createOrder(orderData) { return ApiService.createOrder(orderData); }
export async function getOrder(id) { return ApiService.getOrder(id); }
export async function getOrderByPhone(phone) {
  try { const orders = await ApiService.getOrders(); return orders.filter(o => o.phone === phone); } catch { return []; }
}
export async function updateOrderStatus(id, status) { return ApiService.updateOrderStatus(id, status); }
export async function cancelOrder(id) { return ApiService.updateOrderStatus(id, 'Da huy'); }
export async function fetchAdminOrders(params = {}) {
  try { return await ApiService.getOrders(params); } catch { return []; }
}
export async function createPayOSPayment(data) { return null; }
export async function createVNPayPayment(data) { return null; }
export async function createMoMoPayment(data) { return null; }
export { apiFetch as apiClient };
export default ApiService;
