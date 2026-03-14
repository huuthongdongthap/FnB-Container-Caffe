/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — Shared Configuration
 *  Centralized config for all modules
 * ═══════════════════════════════════════════════
 */

// API Configuration
export const API_CONFIG = {
    BASE: 'http://localhost:8000/api',
    TIMEOUT: 30000,
    RETRIES: 3
};

// Payment Gateway Config
export const PAYMENT_CONFIG = {
    momo: {
        partnerCode: 'FNBCAFFE2026',
        endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create'
    },
    payos: {
        clientId: 'YOUR_PAYOS_CLIENT_ID',
        checkoutUrl: 'https://pay-portfolio.payos.vn/pay/payment'
    },
    vnpay: {
        tmnCode: 'FNBCAFFE',
        endpoint: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    }
};

// Delivery fee config
export const DELIVERY_CONFIG = {
    default: 15000,
    far: 25000,
    freeThreshold: 500000
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

// WebSocket config
export const WS_CONFIG = {
    URL: 'ws://localhost:8080/ws',
    RECONNECT_DELAY: 3000,
    MAX_RECONNECT: 5
};

// Cache durations (ms)
export const CACHE_CONFIG = {
    MENU: 300000,      // 5 min
    ORDERS: 60000,     // 1 min
    STATS: 300000,     // 5 min
    SESSION: 3600000   // 1 hour
};
