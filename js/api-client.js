/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — API Client
 *  Centralized API client for all frontend modules
 * ═══════════════════════════════════════════════
 *
 * Provides unified interface for:
 * - Menu fetching
 * - Order management (create, read, update)
 * - Admin operations
 */

import { API_CONFIG } from './config.js';

// ─── API Client Core ───
const apiClient = {
    /**
     * Generic GET request with error handling
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<any>} Response data
     */
    async get(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE}${endpoint}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API GET error (${endpoint}):`, error.message);
            throw error;
        }
    },

    /**
     * Generic POST request with error handling
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @returns {Promise<any>} Response data
     */
    async post(endpoint, data = {}) {
        const url = `${API_CONFIG.BASE}${endpoint}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API POST error (${endpoint}):`, error.message);
            throw error;
        }
    },

    /**
     * Generic PUT request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @returns {Promise<any>} Response data
     */
    async put(endpoint, data = {}) {
        const url = `${API_CONFIG.BASE}${endpoint}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API PUT error (${endpoint}):`, error.message);
            throw error;
        }
    }
};

// ─── Menu API ───

/**
 * Fetch full menu from API
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>} Menu items
 */
export async function fetchMenu(category = null) {
    const endpoint = category
        ? `/menu?category=${encodeURIComponent(category)}`
        : '/menu';

    const result = await apiClient.get(endpoint);
    return result.data || result.menu || [];
}

/**
 * Fetch single menu item by ID
 * @param {number|string} itemId - Menu item ID
 * @returns {Promise<object>} Menu item
 */
export async function fetchMenuItem(itemId) {
    const result = await apiClient.get(`/menu/${itemId}`);
    return result.data || result.item || null;
}

// ─── Order API ───

/**
 * Create new order
 * @param {object} orderData - Order information
 * @param {Array} orderData.items - Order items
 * @param {string} orderData.fullName - Customer name
 * @param {string} orderData.phone - Customer phone
 * @param {string} orderData.address - Delivery address
 * @param {string} orderData.paymentMethod - Payment method
 * @param {number} orderData.total - Order total
 * @param {string} [orderData.notes] - Order notes
 * @returns {Promise<object>} Created order
 */
export async function createOrder(orderData) {
    const result = await apiClient.post('/orders', orderData);
    return result.data || result.order || result;
}

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<object>} Order details
 */
export async function getOrder(orderId) {
    const result = await apiClient.get(`/orders/${orderId}`);
    return result.data || result.order || null;
}

/**
 * Get orders by customer phone
 * @param {string} phone - Customer phone number
 * @returns {Promise<Array>} Customer orders
 */
export async function getOrderByPhone(phone) {
    const result = await apiClient.get(`/orders?phone=${encodeURIComponent(phone)}`);
    return result.data || result.orders || [];
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status (pending, confirmed, preparing, ready, delivered, cancelled)
 * @param {string} [action] - Additional action (optional)
 * @returns {Promise<object>} Updated order
 */
export async function updateOrderStatus(orderId, status, action = 'update') {
    const result = await apiClient.put(`/orders/${orderId}/status`, {
        status,
        action
    });
    return result.data || result.order || result;
}

/**
 * Cancel order
 * @param {string} orderId - Order ID
 * @param {string} [reason] - Cancellation reason
 * @returns {Promise<object>} Updated order
 */
export async function cancelOrder(orderId, reason = '') {
    return updateOrderStatus(orderId, 'cancelled', reason);
}

// ─── Admin API ───

/**
 * Fetch all orders (admin)
 * @param {object} params - Query parameters
 * @param {string} [params.status] - Filter by status
 * @param {number} [params.limit] - Max results
 * @param {string} [params.sortBy] - Sort field
 * @param {string} [params.sortOrder] - Sort order (asc, desc)
 * @returns {Promise<Array>} Orders list
 */
export async function fetchAdminOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
        ? `/admin/orders?${queryString}`
        : '/admin/orders';

    const result = await apiClient.get(endpoint);
    return result.data || result.orders || [];
}

/**
 * Fetch dashboard statistics
 * @param {number} days - Number of days for stats
 * @returns {Promise<object>} Dashboard stats
 */
export async function fetchDashboardStats(days = 7) {
    const result = await apiClient.get(`/admin/stats?days=${days}`);
    return result.data || result.stats || null;
}

/**
 * Fetch revenue data
 * @param {number} days - Number of days
 * @returns {Promise<Array>} Revenue data
 */
export async function fetchRevenue(days = 7) {
    const result = await apiClient.get(`/admin/revenue?days=${days}`);
    return result.data || result.revenue || [];
}

/**
 * Fetch top products
 * @param {number} limit - Max products
 * @returns {Promise<Array>} Top products
 */
export async function fetchTopProducts(limit = 10) {
    const result = await apiClient.get(`/admin/products/top?limit=${limit}`);
    return result.data || result.products || [];
}

/**
 * Get order detail (admin)
 * @param {string} orderId - Order ID
 * @returns {Promise<object>} Order details
 */
export async function getAdminOrderDetail(orderId) {
    const result = await apiClient.get(`/admin/orders/${orderId}`);
    return result.data || result.order || null;
}

// ─── Payment API ───

/**
 * Create PayOS payment link
 * @param {object} paymentData - Payment info
 * @returns {Promise<string>} Checkout URL
 */
export async function createPayOSPayment(paymentData) {
    const result = await apiClient.post('/payment/payos', paymentData);
    return result.checkoutUrl || result.url || null;
}

/**
 * Create VNPay payment link
 * @param {object} paymentData - Payment info
 * @returns {Promise<string>} Payment URL
 */
export async function createVNPayPayment(paymentData) {
    const result = await apiClient.post('/payment/vnpay', paymentData);
    return result.paymentUrl || result.url || null;
}

/**
 * Create MoMo payment link
 * @param {object} paymentData - Payment info
 * @returns {Promise<string>} Payment URL
 */
export async function createMoMoPayment(paymentData) {
    const result = await apiClient.post('/payment/momo', paymentData);
    return result.payUrl || result.url || null;
}

// ─── Export API Client for custom use ───
export { apiClient };

// Default export
export default {
    fetchMenu,
    fetchMenuItem,
    createOrder,
    getOrder,
    getOrderByPhone,
    updateOrderStatus,
    cancelOrder,
    fetchAdminOrders,
    fetchDashboardStats,
    fetchRevenue,
    fetchTopProducts,
    getAdminOrderDetail,
    createPayOSPayment,
    createVNPayPayment,
    createMoMoPayment,
    apiClient
};
