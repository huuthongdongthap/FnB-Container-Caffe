/**
 * ═══════════════════════════════════════════════
 *  AURA CAFE — Shared Configuration
 *  Centralized config for all modules
 * ═══════════════════════════════════════════════
 */

// API Configuration — Cloudflare Worker (D1 backend)
const IS_LOCAL = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_CONFIG = {
  WORKER_BASE_URL: IS_LOCAL
    ? 'http://127.0.0.1:8787' // local wrangler dev
    : 'https://aura-space-worker.sadec-marketing-hub.workers.dev', // production Worker
  get BASE() { return this.WORKER_BASE_URL + '/api'; },
  TIMEOUT: 30000,
  RETRIES: 3
};

// Payment Gateway Config
// Production: PayOS only (MoMo/VNPay disabled — no backend routes)
export const PAYMENT_CONFIG = {
  momo: {
    partnerCode: 'AURASPACE2026',
    endpoint: 'https://payment.momo.vn/v2/gateway/api/create',
    enabled: false
  },
  payos: {
    checkoutUrl: 'https://pay-portfolio.payos.vn/pay/payment'
    // clientId handled by backend via env bindings (worker/src/routes/payment.js)
  },
  vnpay: {
    tmnCode: 'AURASPACE',
    endpoint: 'https://pay.vnpay.vn/vpcpay.html',
    enabled: false
  }
};

// Delivery fee config
// Free delivery for orders >= 300,000 VND (updated from 500K)
export const DELIVERY_CONFIG = {
  default: 15000,
  far: 25000,
  freeThreshold: 300000 // Miễn phí giao hàng cho đơn từ 300K
};

// Order status labels
export const STATUS_LABELS = {
  pending: 'Chờ Xử Lý',
  confirmed: 'Đã Xác Nhận',
  preparing: 'Đang Chế Biến',
  ready: 'Sẵn Sàng',
  delivered: 'Đã Giao',
  cancelled: 'Đã Hủy'
};


// Cache durations (ms)
export const CACHE_CONFIG = {
  MENU: 300000, // 5 min
  ORDERS: 60000, // 1 min
  STATS: 300000, // 5 min
  SESSION: 3600000 // 1 hour
};
