/**
 * Checkout & Payment System - Orchestrator
 * AURA SPACE - Order Processing
 */

// ─── Sub-module Imports ───
import {
  loadCartToSummary,
  updateTotals,
  calculateDeliveryFee,
  removeItem as _removeItem,
  updateCartCount,
  handleEmptyCart
} from './checkout/cart-summary.js';

import {
  handleMoMoPayment as _handleMoMoPayment,
  handlePayOSPayment as _handlePayOSPayment,
  handleVNPayPayment as _handleVNPayPayment,
  handleCODSuccess as _handleCODSuccess,
  clearCart as _clearCart,
  sendOrderToWebSocket,
  sendOrderToZalo,
  translatePaymentMethod,
  showSuccessModal,
  submitOrderCOD,
  submitOrderMoMo,
  submitOrderPayOS,
  submitOrderVNPay
} from './checkout/payment.js';

import {
  openPaymentQRModal,
  closePaymentQRModal,
  handlePaymentQR as _handlePaymentQR,
  copyAccountNumber,
  setupPaymentQRHandlers,
  switchPaymentMethodQR,
  generateBankQR,
  generateMoMoQR,
  generateVNPayQR,
  getBankConfig,
  generateVietQR,
  renderQRCode,
  generateSimpleQR,
  generateFinderPattern,
  simpleHash
} from './checkout/qr-code.js';

// ─── Shared State ───
let cart = { items: [], total: 0, count: 0 };
let sessionId = null;
let discount = { code: null, percent: 0, amount: 0 };
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';

// ─── Local Utilities ───

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) { existingToast.remove(); }

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Expose showToast for QR module
window._checkoutShowToast = showToast;

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// ─── Bound wrappers that close over shared state ───

function handlePaymentQR(order, paymentMethod) {
  _handlePaymentQR(order, paymentMethod, sendOrderToWebSocket);
}

async function removeItem(id) {
  cart = await _removeItem(id, API_BASE, sessionId, cart, discount, showToast);
}

async function handleCODSuccess(order) {
  await _handleCODSuccess(order, API_BASE, sessionId);
}

async function handleMoMoPayment(order) {
  await _handleMoMoPayment(order, API_BASE, handlePaymentQR);
}

async function handlePayOSPayment(order) {
  await _handlePayOSPayment(order, API_BASE, sessionId);
}

async function handleVNPayPayment(order) {
  await _handleVNPayPayment(order, API_BASE, handlePaymentQR);
}

async function clearCart() {
  await _clearCart(API_BASE, sessionId);
  cart = { items: [], total: 0, count: 0 };
}

// ─── Init Functions ───

function initSession() {
  sessionId = localStorage.getItem('aura_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('aura_session_id', sessionId);
  }
}

async function loadCartFromAPI() {
  try {
    const response = await fetch(`${API_BASE}/cart?session_id=${sessionId}`);
    const result = await response.json();

    if (result.success) {
      cart = result.cart;
      loadCartToSummary(cart, discount);
    } else {
      handleEmptyCart();
    }
  } catch (error) {
    // Try both localStorage keys — menu.js uses 'aura_cart', legacy uses 'cart'
    cart = JSON.parse(localStorage.getItem('aura_cart'))
        || JSON.parse(localStorage.getItem('cart'))
        || { items: [], total: 0, count: 0 };
    loadCartToSummary(cart, discount);
  }
}

function initCheckout() {
  if (!cart.items || cart.items.length === 0) {
    handleEmptyCart();
  }
}

function initDeliveryTimeToggle() {
  const radioCards = document.querySelectorAll('input[name="deliveryTime"]');
  const scheduledTimeInput = document.getElementById('scheduledTime');

  radioCards.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'scheduled') {
        scheduledTimeInput.classList.remove('hidden');
        scheduledTimeInput.required = true;
      } else {
        scheduledTimeInput.classList.add('hidden');
        scheduledTimeInput.required = false;
      }
    });
  });
}

function initPaymentMethodSelect() {
  const paymentCards = document.querySelectorAll('.payment-card');

  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      radio.checked = true;

      paymentCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const method = e.target.value;
      // QR preview hook (optional UX enhancement)
    });
  });
}

function initDiscountCode() {
  const applyBtn = document.getElementById('applyDiscountBtn');
  const codeInput = document.getElementById('discountCode');

  if (!applyBtn) { return; }

  applyBtn.addEventListener('click', () => {
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
      alert('⚠️ Vui lòng nhập mã giảm giá');
      return;
    }

    const validCodes = {
      'FIRSTORDER': { percent: 10, maxDiscount: 50000 },
      'WELCOME10': { percent: 10, maxDiscount: 30000 },
      'SADEC20': { percent: 20, maxDiscount: 100000 },
      'CONTAINER': { percent: 15, maxDiscount: 75000 }
    };

    if (validCodes[code]) {
      const subtotal = cart.total || 0;
      let discountAmount = (subtotal * validCodes[code].percent) / 100;

      if (validCodes[code].maxDiscount && discountAmount > validCodes[code].maxDiscount) {
        discountAmount = validCodes[code].maxDiscount;
      }

      discount = {
        code: code,
        percent: validCodes[code].percent,
        amount: discountAmount
      };

      alert(`✅ Áp dụng mã giảm giá thành công! Giảm ${validCodes[code].percent}% (tối đa ${formatPrice(validCodes[code].maxDiscount)})`);
      updateTotals(subtotal, discount);
    } else {
      alert('❌ Mã giảm giá không hợp lệ');
      discount = { code: null, percent: 0, amount: 0 };
      updateTotals(cart.total || 0, discount);
    }
  });
}

function initSubmitOrder() {
  const submitBtn = document.getElementById('submitOrderBtn');

  if (!submitBtn) { return; }

  submitBtn.addEventListener('click', async () => {
    const form = document.getElementById('checkoutForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const items = cart.items || [];
    if (items.length === 0) {
      showToast('🛒 Giỏ hàng trống. Vui lòng chọn món!', 'error');
      return;
    }

    const formData = new FormData(form);

    const subtotal = cart.total || 0;
    const deliveryFee = calculateDeliveryFee(subtotal);
    const discountAmount = discount.amount || 0;
    const total = subtotal + deliveryFee - discountAmount;

    const orderData = {
      session_id: sessionId,
      items: items,
      total: total,
      subtotal: subtotal,
      shipping_fee: deliveryFee,
      discount: discountAmount,
      customer_name: formData.get('name'),
      customer_phone: formData.get('phone'),
      customer_email: formData.get('email'),
      customer_address: `${formData.get('address')}, ${formData.get('ward')}, Sa Đéc, Đồng Tháp`,
      notes: formData.get('notes'),
      payment_method: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod',
      delivery_time: formData.get('deliveryTime') === 'scheduled' ? formData.get('scheduledTime') : 'now'
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-text">⏳ Đang xử lý...</span>';
    submitBtn.style.opacity = '0.7';

    try {
      const response = await fetch(`${API_BASE}/orders`, { // FIX: P0 order flow endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (result.success) {
        const order = result.order;

        if (order.payment_method === 'cod') {
          await handleCODSuccess(order);
        } else if (order.payment_method === 'momo') {
          await handleMoMoPayment(order);
        } else if (order.payment_method === 'payos') {
          await handlePayOSPayment(order);
        } else if (order.payment_method === 'vnpay') {
          await handleVNPayPayment(order);
        }
      } else {
        throw new Error(result.detail || 'Có lỗi xảy ra');
      }
    } catch (error) {
      showToast('⚠️ Lỗi: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-text">✅ Xác Nhận Đặt Hàng</span>';
      submitBtn.style.opacity = '1';
    }
  });
}

function saveOrderToLocalStorage(order) {
  localStorage.setItem('lastOrder', JSON.stringify(order));
  localStorage.setItem('pendingOrder', JSON.stringify(order));
}

// ─── Dark Mode Theme Toggle ───
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');

  if (!themeToggle) { return; }

  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  }

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (themeIcon) {
      themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    }
  });
}

// ─── WebSocket Real-time Order Tracking ───
let orderWebSocket = null;

async function initializeWebSocketTracking() {
  if (!window.WebSocketClient) {
    return;
  }

  try {
    orderWebSocket = new window.WebSocketClient();

    orderWebSocket.on('connected', (data) => {
      showToast('📡 Đã kết nối theo dõi đơn hàng', 'success');
    });

    orderWebSocket.on('new_order', (data) => {
      showToast('✅ Đơn hàng đã được tạo!', 'success');

      if (data.id) {
        localStorage.setItem('trackingOrderId', data.id);
      }
    });

    orderWebSocket.on('order_updated', (data) => {
      const statusLabels = {
        pending: 'Chờ xử lý',
        confirmed: 'Đã xác nhận',
        preparing: 'Đang chế biến',
        ready: 'Sẵn sàng',
        delivered: 'Đã giao',
        cancelled: 'Đã hủy'
      };
      showToast(`📦 Đơn hàng: ${statusLabels[data.status] || data.status}`, 'info');
    });

    orderWebSocket.on('error', (data) => {
      showToast('⚠️ Lỗi kết nối: ' + (data.message || 'Không xác định'), 'error');
    });

    const trackingOrderId = localStorage.getItem('trackingOrderId');
    await orderWebSocket.connect('customer', trackingOrderId);

    orderWebSocket.startHeartbeat(30000);
  } catch (error) {
    // Silent fail for production
  }
}

// ─── DOMContentLoaded ───
document.addEventListener('DOMContentLoaded', () => {
  initSession();
  loadCartFromAPI();
  initDeliveryTimeToggle();
  initPaymentMethodSelect();
  initDiscountCode();
  initSubmitOrder();
  initThemeToggle();
  initializeWebSocketTracking();
});

// ─── Global Exports ───
window.checkoutUtils = {
  removeItem,
  formatPrice
};

window.orderTracking = {
  connect: () => orderWebSocket?.connect('customer', localStorage.getItem('trackingOrderId')),
  disconnect: () => orderWebSocket?.disconnect(),
  getStatus: (orderId) => orderWebSocket?.getOrderStatus(orderId),
  isConnected: () => orderWebSocket?.ws?.readyState === WebSocket.OPEN
};

window.paymentQR = {
  open: openPaymentQRModal,
  close: closePaymentQRModal,
  handlePayment: handlePaymentQR
};

// ─── ES Module Exports ───
export {
  cart,
  sessionId,
  discount,
  API_BASE,
  initCheckout,
  initSession,
  initDeliveryTimeToggle,
  initPaymentMethodSelect,
  initDiscountCode,
  initSubmitOrder,
  initThemeToggle,
  initializeWebSocketTracking,
  loadCartFromAPI,
  showToast,
  formatPrice,
  saveOrderToLocalStorage
};
