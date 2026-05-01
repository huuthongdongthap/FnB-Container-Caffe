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
// ⚠️ CẦN CONFIG: Đăng ký PayOS production account tại https://payos.vn
// Sau khi đăng ký, thay thế YOUR_PAYOS_CLIENT_ID bằng clientId thật từ dashboard PayOS
export const PAYMENT_CONFIG = {
  momo: {
    partnerCode: 'AURASPACE2026',
    endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create'
  },
  payos: {
    // PayOS client ID - configure via environment variable in production
    clientId: typeof process !== 'undefined' && process.env ? process.env.PAYOS_CLIENT_ID : 'YOUR_PAYOS_CLIENT_ID',
    checkoutUrl: 'https://pay-portfolio.payos.vn/pay/payment'
  },
  vnpay: {
    tmnCode: 'AURASPACE',
    endpoint: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
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
