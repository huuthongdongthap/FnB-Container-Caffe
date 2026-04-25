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
  async getMenu(category = null) {
    const res = await apiFetch(`/api/menu${category ? '?category=' + category : ''}`);
    return res.data ?? [];
  },
  async getMenuItem(id) {
    const res = await apiFetch(`/api/menu/${id}`);
    return res.data ?? null;
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
  async getTables(zone = null) {
    const res = await apiFetch(`/api/tables${zone ? '?zone=' + zone : ''}`);
    return res.data ?? [];
  },
  async updateTableStatus(id, status) {
    return apiFetch(`/api/tables/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  },
  async getOrders(opts = {}) {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined))
    ).toString();
    const res = await apiFetch(`/api/orders${params ? '?' + params : ''}`);
    return res.data ?? [];
  },
  async getOrdersByStatus(status) {
    const res = await apiFetch(`/api/orders?status=${status}`);
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
    const res = await apiFetch(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    return res.data ?? res;
  },
  async health() { return apiFetch('/api/health'); },

  // Task 3.4: Reservations, Payments, Contact, Reviews
  async createReservation(data) {
    return apiFetch('/api/reservations', { method: 'POST', body: JSON.stringify(data) });
  },
  async checkAvailability(date) {
    return apiFetch(`/api/reservations?date=${date}`);
  },
  async createPayment(data) {
    return apiFetch('/api/payments', { method: 'POST', body: JSON.stringify(data) });
  },
  async updatePaymentStatus(id, status) {
    return apiFetch(`/api/payments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  },
  async submitContact(data) {
    return apiFetch('/api/contact', { method: 'POST', body: JSON.stringify(data) });
  },
  async getReviews(limit, rating) {
    const params = new URLSearchParams();
    if (limit) {params.set('limit', limit);}
    if (rating) {params.set('rating', rating);}
    const qs = params.toString();
    return apiFetch(`/api/reviews${qs ? '?' + qs : ''}`);
  },
  async submitReview(data) {
    return apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify(data) });
  },

  // Task 3.5: Loyalty
  async getMember(phone) {
    return apiFetch(`/api/loyalty/member/${phone}`);
  },
  async registerMember(data) {
    return apiFetch('/api/loyalty/register', { method: 'POST', body: JSON.stringify(data) });
  },
  async getWallet(userId) {
    return apiFetch(`/api/loyalty/wallet/${userId}`);
  },
  async getTransactions(userId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.type) {params.set('type', opts.type);}
    if (opts.limit) {params.set('limit', opts.limit);}
    const qs = params.toString();
    return apiFetch(`/api/loyalty/transactions/${userId}${qs ? '?' + qs : ''}`);
  },
  async getPointsHistory(userId) {
    return apiFetch(`/api/loyalty/points/${userId}`);
  },
  async processCashback(orderId, userId) {
    return apiFetch('/api/loyalty/process-cashback', { method: 'POST', body: JSON.stringify({ orderId, userId }) });
  },
  async spendCashback(data) {
    return apiFetch('/api/loyalty/spend-cashback', { method: 'POST', body: JSON.stringify(data) });
  },
  async getRewards(userId) {
    return apiFetch(`/api/loyalty/rewards/${userId}`);
  },
  async redeemReward(userId, rewardId) {
    return apiFetch('/api/loyalty/redeem', { method: 'POST', body: JSON.stringify({ userId, rewardId }) });
  },
  async getTiers() {
    return apiFetch('/api/loyalty/tiers');
  },
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
export async function cancelOrder(id) { return ApiService.updateOrderStatus(id, 'cancelled'); }
export async function fetchAdminOrders(params = {}) {
  try { return await ApiService.getOrders(params); } catch { return []; }
}

export { apiFetch as apiClient };
export default ApiService;
