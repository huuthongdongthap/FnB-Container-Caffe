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
  ? 'http://localhost:8000/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';

// ─── Discount Codes ───
const validCodes = {
  FIRSTORDER: { percent: 15, maxDiscount: 50000 },
  WELCOME10: { percent: 10, maxDiscount: 30000 },
  SADEC20: { percent: 20, maxDiscount: 100000 },
  CONTAINER: { percent: 25, maxDiscount: 150000 }
};

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
  _handlePaymentQR(order, paymentMethod);
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
  // Skip API call — cart is localStorage-only (no /api/cart routes in worker)
  // Load from localStorage directly with robust format handling
  const stored = localStorage.getItem('aura_cart') || localStorage.getItem('cart');

  // Initialize empty cart as fallback
  cart = { items: [], total: 0, count: 0 };

  if (stored) {
    try {
      const parsed = JSON.parse(stored);

      // Handle multiple formats robustly
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        // Format: { items: [...], total: X }
        cart = {
          items: parsed.items,
          total: parsed.total || parsed.items.reduce((s, i) => s + ((i.price || 0) * (i.quantity || i.qty || 1)), 0),
          count: parsed.items.length
        };
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        // Format: [item1, item2, ...] (from menu.js)
        cart = {
          items: parsed,
          total: parsed.reduce((s, i) => s + ((i.price || 0) * (i.quantity || i.qty || 1)), 0),
          count: parsed.length
        };
      }
      // If neither format matches or empty, cart stays as initialized empty object

    } catch (e) {
      // Parse error, cart stays empty
    }
  }

  // Always load summary (handles empty cart display internally)
  loadCartToSummary(cart, discount);
}

function initCheckout() {
  // Cart loading and empty validation now handled in loadCartFromAPI()
  // This function reserved for future checkout-specific initialization
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

  applyBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
      alert('⚠️ Vui lòng nhập mã giảm giá');
      return;
    }

    const subtotal = cart.total || 0;
    applyBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/promotions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert('❌ ' + (data.error || 'Mã giảm giá không hợp lệ'));
        discount = { code: null, percent: 0, amount: 0 };
        updateTotals(subtotal, discount);
        return;
      }
      discount = {
        code: data.code,
        percent: data.percent,
        amount: data.amount,
      };
      alert(`✅ Áp dụng mã giảm giá thành công! Giảm ${data.percent}% (−${formatPrice(data.amount)})`);
      updateTotals(subtotal, discount);
    } catch (e) {
      alert('❌ Lỗi kết nối: ' + e.message);
    } finally {
      applyBtn.disabled = false;
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


// ─── DOMContentLoaded ───
document.addEventListener('DOMContentLoaded', () => {
  initSession();
  loadCartFromAPI();
  initDeliveryTimeToggle();
  initPaymentMethodSelect();
  initDiscountCode();
  initSubmitOrder();
  initThemeToggle();
});

// ─── Global Exports ───
window.checkoutUtils = {
  removeItem,
  formatPrice
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
  loadCartFromAPI,
  showToast,
  formatPrice,
  saveOrderToLocalStorage
};
