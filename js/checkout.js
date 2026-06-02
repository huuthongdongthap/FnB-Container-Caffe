/**
 * Checkout & Payment System - Orchestrator
 * AURA CAFE - Order Processing
 */

// ─── Sub-module Imports ───
import {
  loadCartToSummary,
  updateTotals,
  calculateDeliveryFee,
  removeItem as _removeItem
} from './checkout/cart-summary.js';

import {
  handleMoMoPayment as _handleMoMoPayment,
  handlePayOSPayment as _handlePayOSPayment,
  handleVNPayPayment as _handleVNPayPayment,
  handleCODSuccess as _handleCODSuccess
} from './checkout/payment.js';

import {
  openPaymentQRModal,
  closePaymentQRModal,
  handlePaymentQR as _handlePaymentQR
} from './checkout/qr-code.js';

// ─── Shared State ───
let cart = { items: [], total: 0, count: 0 };
let sessionId = null;
let discount = { code: null, percent: 0, amount: 0 };
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';

// ─── Discount Codes ───

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

// ─── Init Functions ───

function initSession() {
  sessionId = localStorage.getItem('aura_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('aura_session_id', sessionId);
  }
}

async function loadCartFromAPI() {
  // Load from localStorage (multi-key + multi-format support)
  // Keys tried in priority: aura_cart (menu.js writes here) → aura_cart_v1 (legacy) → cart (legacy)
  const stored =
    localStorage.getItem('aura_cart') ||
    localStorage.getItem('aura_cart_v1') ||
    localStorage.getItem('cart');

  cart = { items: [], total: 0, count: 0 };

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      let rawItems = null;

      if (Array.isArray(parsed)) {
        rawItems = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        rawItems = parsed.items;
      }

      if (rawItems && rawItems.length > 0) {
        // Normalize: qty → quantity, ensure price/name
        const items = rawItems.map(i => ({
          id: i.id,
          name: i.name || '',
          price: Number(i.price) || 0,
          quantity: Number(i.quantity || i.qty || 1),
          category: i.category || '',
          emoji: i.emoji || ''
        }));
        const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const count = items.reduce((s, i) => s + i.quantity, 0);
        cart = { items, total, count };
        console.log('[checkout] Cart loaded:', count, 'items, total:', total);
      } else {
        console.log('[checkout] Parsed cart has 0 items (rawItems empty)');
      }
    } catch (e) {
      console.error('[checkout] Cart parse error:', e);
    }
  } else {
    console.log('[checkout] No cart data in localStorage (checked aura_cart, aura_cart_v1, cart)');
  }

  loadCartToSummary(cart, discount);
}

function initCheckout() {
  // Cart loading and empty validation now handled in loadCartFromAPI()
  // This function reserved for future checkout-specific initialization
}

function initDeliveryTimeToggle() {
  const cards = document.querySelectorAll('.pay-card[data-time]');
  const scheduledTimeWrap = document.getElementById('scheduledTime');
  const scheduledTimeInput = scheduledTimeWrap && scheduledTimeWrap.querySelector('input[name="scheduledTime"]');

  const syncSelection = (selectedCard) => {
    cards.forEach(c => {
      const radio = c.querySelector('input[type="radio"]');
      const selected = c === selectedCard;
      c.classList.toggle('selected', selected);
      c.setAttribute('aria-checked', String(selected));
      if (radio) { radio.checked = selected; }
    });

    const selectedRadio = selectedCard?.querySelector('input[type="radio"]');
    if (selectedRadio?.value === 'scheduled') {
      if (scheduledTimeWrap) {scheduledTimeWrap.style.display = '';}
      if (scheduledTimeInput) {scheduledTimeInput.required = true;}
    } else {
      if (scheduledTimeWrap) {scheduledTimeWrap.style.display = 'none';}
      if (scheduledTimeInput) {scheduledTimeInput.required = false;}
    }
  };

  cards.forEach(card => {
    card.setAttribute('role', 'radio');
    card.setAttribute('tabindex', '0');

    card.addEventListener('click', () => {
      syncSelection(card);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        syncSelection(card);
      }
    });
  });

  const initiallySelected = Array.from(cards).find(c => c.querySelector('input[type="radio"]')?.checked) || cards[0];
  if (initiallySelected) { syncSelection(initiallySelected); }
}

function initPaymentMethodSelect() {
  const cards = document.querySelectorAll('.pay-card[data-method]');

  const syncSelection = (selectedCard) => {
    cards.forEach(c => {
      const radio = c.querySelector('input[type="radio"]');
      const selected = c === selectedCard;
      c.classList.toggle('selected', selected);
      c.setAttribute('aria-checked', String(selected));
      if (radio) { radio.checked = selected; }
    });
  };

  cards.forEach(card => {
    card.setAttribute('role', 'radio');
    card.setAttribute('tabindex', '0');

    card.addEventListener('click', () => {
      syncSelection(card);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        syncSelection(card);
      }
    });
  });

  const initiallySelected = Array.from(cards).find(c => c.querySelector('input[type="radio"]')?.checked) || cards[0];
  if (initiallySelected) { syncSelection(initiallySelected); }

  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
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

async function loadPromoSuggestions() {
  const container = document.getElementById('promoSuggestions');
  if (!container) {return;}

  try {
    const res = await fetch(`${API_BASE}/promotions`);
    const data = await res.json();
    if (!data.success || !data.promotions || data.promotions.length === 0) {
      const loading = container.querySelector('.promo-loading');
      if (loading) {loading.textContent = '';}
      return;
    }

    const active = data.promotions.filter(p => {
      if (!p.expires_at) {return true;}
      return new Date(p.expires_at) > new Date();
    }).slice(0, 4);

    const loading = container.querySelector('.promo-loading');
    if (loading) {loading.remove();}

    active.forEach(p => {
      const chip = document.createElement('span');
      chip.className = 'promo-chip';
      chip.textContent = p.code;
      chip.title = p.percent > 0
        ? `Giảm ${p.percent}%${p.max_discount > 0 ? ' · Tối đa ' + p.max_discount.toLocaleString('vi-VN') + '₫' : ''}`
        : 'Tặng điểm ×2';
      chip.addEventListener('click', () => {
        const input = document.getElementById('discountCode');
        const applyBtn = document.getElementById('applyDiscountBtn');
        if (input) {
          input.value = p.code;
          container.querySelectorAll('.promo-chip').forEach(c => c.classList.remove('applied'));
          chip.classList.add('applied');
          if (applyBtn) {applyBtn.click();}
        }
      });
      container.appendChild(chip);
    });
  } catch {
    const loading = container.querySelector('.promo-loading');
    if (loading) {loading.textContent = '';}
  }
}

function initPromoSuggestions() {
  loadPromoSuggestions();
}

function initSubmitOrder() {
  const submitBtn = document.getElementById('submitOrderBtn');
  const summaryBtn = document.getElementById('btnPay');

  if (!submitBtn) { return; }

  let isSubmitting = false;

  const setSubmittingState = (submitting, label = 'Xác Nhận Đặt Hàng') => {
    const buttons = [submitBtn, summaryBtn].filter(Boolean);
    buttons.forEach((btn) => {
      btn.disabled = submitting;
      btn.style.opacity = submitting ? '0.7' : '1';
      btn.innerHTML = `<span class="btn-text">${submitting ? 'Đang xử lý...' : label}</span>`;
    });
  };

  const submitOrder = async () => {
    if (isSubmitting) { return; }
    const form = document.getElementById('checkoutForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    isSubmitting = true;

    const items = cart.items || [];
    if (items.length === 0) {
      showToast('Giỏ hàng trống. Vui lòng chọn món!', 'error');
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
      customer_name: formData.get('fullName'),
      customer_phone: formData.get('phone'),
      customer_email: formData.get('email'),
      customer_address: `${formData.get('address')}, ${formData.get('ward')}, Sa Đéc, Đồng Tháp`,
      notes: formData.get('notes'),
      payment_method: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod',
      delivery_time: formData.get('deliveryTime') === 'scheduled' ? formData.get('scheduledTime') : 'now'
    };

    setSubmittingState(true);

    try {
      const response = await fetch(`${API_BASE}/orders`, { // FIX: P0 order flow endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.detail || result.error || result.message || 'Có lỗi xảy ra');
      }

      const order = result.order;
      if (order.payment_method === 'cod') {
        await handleCODSuccess(order);
        return;
      }

      if (order.payment_method === 'momo') {
        await handleMoMoPayment(order);
        return;
      }

      if (order.payment_method === 'payos') {
        await handlePayOSPayment(order);
        return;
      }

      if (order.payment_method === 'vnpay') {
        await handleVNPayPayment(order);
      }
    } catch (error) {
      isSubmitting = false;
      setSubmittingState(false);
      showToast('Lỗi: ' + error.message, 'error');
    }
  };

  submitBtn.addEventListener('click', submitOrder);
  if (summaryBtn) {
    summaryBtn.addEventListener('click', submitOrder);
  }
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

  const savedTheme = localStorage.getItem('theme') || 'light';
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
  initPromoSuggestions();
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
