/**
 * Cart Summary Module
 * AURA CAFE - Cart display, totals, delivery fee
 */

import { DELIVERY_CONFIG } from '../config.js';

/**
 * Format Price
 */
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

/**
 * Handle Empty Cart
 */
export function handleEmptyCart() {
  const itemsContainer = document.getElementById('summaryItems');
  if (itemsContainer) {
    itemsContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem 0;">
        <p style="color: var(--txt); margin-bottom: 1rem;">🛒 Giỏ hàng trống</p>
        <a href="menu.html" style="display: inline-block; padding: 8px 16px; border-radius: 8px; color: var(--gold); border: 1px solid var(--gold); text-decoration: none;">Quay lại menu</a>
      </div>
    `;
  }
  // Hide order details rows + pay buttons when empty
  const orderDetails = document.getElementById('orderDetails');
  if (orderDetails) {orderDetails.style.display = 'none';}
  const btnPay = document.getElementById('btnPay');
  if (btnPay) { btnPay.disabled = true; btnPay.style.display = 'none'; }
  const submitBtn = document.getElementById('submitOrderBtn');
  if (submitBtn) {submitBtn.disabled = true;}
}

/**
 * Calculate Delivery Fee
 */
export function calculateDeliveryFee(subtotal) {
  if (subtotal >= DELIVERY_CONFIG.freeThreshold) {
    return 0;
  }

  const ward = document.getElementById('ward')?.value;
  const farWards = ['my-phuoc', 'tan-kien-dung', 'khac'];

  if (farWards.includes(ward)) {
    return DELIVERY_CONFIG.far;
  }

  return DELIVERY_CONFIG.default;
}

/**
 * Update Totals
 * @param {number} subtotal
 * @param {{ code: string|null, percent: number, amount: number }} discount
 */
export function updateTotals(subtotal, discount) {
  const deliveryFee = calculateDeliveryFee(subtotal);
  const discountAmount = discount.amount || 0;
  const total = subtotal + deliveryFee - discountAmount;

  const summarySubtotalEl = document.getElementById('summarySubtotal');
  const summaryDeliveryEl = document.getElementById('summaryDelivery');
  const summaryTotalEl = document.getElementById('summaryTotal');
  const btnTotalEl = document.getElementById('btnTotal');

  if (summarySubtotalEl) { summarySubtotalEl.textContent = formatPrice(subtotal); }
  if (summaryDeliveryEl) { summaryDeliveryEl.textContent = deliveryFee === 0 ? 'Miễn phí' : formatPrice(deliveryFee); }
  if (summaryTotalEl) { summaryTotalEl.textContent = formatPrice(total); }
  if (btnTotalEl) { btnTotalEl.textContent = formatPrice(total); }

  const discountRow = document.getElementById('discountRow');
  if (discount.percent > 0 && discountRow) {
    discountRow.style.display = 'flex';
    const discountCodeEl = document.getElementById('discountCode');
    const summaryDiscountEl = document.getElementById('summaryDiscount');
    if (discountCodeEl) { discountCodeEl.textContent = discount.code; }
    if (summaryDiscountEl) { summaryDiscountEl.textContent = `-${formatPrice(discountAmount)}`; }
  } else if (discountRow) {
    discountRow.style.display = 'none';
  }
}

/**
 * Load Cart to Summary
 * @param {{ items: Array, total: number }} cart
 * @param {{ code: string|null, percent: number, amount: number }} discount
 */
export function loadCartToSummary(cart, discount) {
  // Render into #summaryItems (child) — NOT #orderSummary (parent card)
  const itemsContainer = document.getElementById('summaryItems');
  if (!itemsContainer) { return; }

  const items = cart.items || [];

  if (items.length === 0) {
    handleEmptyCart();
    return;
  }

  // Re-enable buttons + restore order details (in case handleEmptyCart ran first)
  const orderDetails = document.getElementById('orderDetails');
  if (orderDetails) {orderDetails.style.display = '';}
  const btnPay = document.getElementById('btnPay');
  if (btnPay) { btnPay.disabled = false; btnPay.style.display = ''; }
  const submitBtn = document.getElementById('submitOrderBtn');
  if (submitBtn) {submitBtn.disabled = false;}

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  itemsContainer.innerHTML = items.map(item => `
        <div class="summary-item" data-id="${esc(item.id)}">
            <div class="summary-item-info">
                <div class="summary-item-name">${esc(item.name)}</div>
                <div class="summary-item-meta">
                    <span class="summary-item-qty">x${Number(item.quantity)}</span>
                    · ${esc(formatPrice(item.price))}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="summary-item-price">${esc(formatPrice(item.price * item.quantity))}</span>
                <button class="summary-item-remove" onclick="removeItem('${esc(item.id)}')">×</button>
            </div>
        </div>
    `).join('');

  updateTotals(cart.total || 0, discount);
}

/**
 * Remove Item from Cart
 * @param {string} id
 * @param {string} API_BASE
 * @param {string} sessionId
 * @param {{ items: Array, total: number }} cart - mutable ref
 * @param {{ code: string|null, percent: number, amount: number }} discount
 * @param {Function} showToast
 * @returns {{ cart: object }} updated cart
 */
export async function removeItem(id, API_BASE, sessionId, cart, discount, showToast) {
  if (!confirm('Xóa món này khỏi giỏ hàng?')) { return cart; }

  try {
    const response = await fetch(`${API_BASE}/cart/remove?item_id=${id}&session_id=${sessionId}`, {
      method: 'POST'
    });
    const result = await response.json();

    if (result.success) {
      cart = result.cart;
      localStorage.setItem('aura_cart_v1', JSON.stringify(cart.items || []));
      loadCartToSummary(cart, discount);
      updateCartCount(cart);
      showToast('Đã xóa sản phẩm', 'success');
    } else {
      showToast('Không thể xóa sản phẩm', 'error');
    }
  } catch (error) {
    delete cart[id];
    localStorage.setItem('aura_cart_v1', JSON.stringify(cart.items || []));
    loadCartToSummary(cart, discount);
    showToast('Đã xóa sản phẩm', 'success');
  }

  if (!cart.items || cart.items.length === 0) {
    handleEmptyCart();
  }

  return cart;
}

/**
 * Update Cart Count (sync with main site)
 */
export function updateCartCount(cart) {
  const count = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count } }));
}
