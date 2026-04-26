/**
 * Payment Module
 * AURA SPACE - Payment handlers, order submission, success flow
 */


/**
 * Format Price (local)
 */
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

/**
 * Translate Payment Method
 */
export function translatePaymentMethod(method) {
  const translations = {
    cod: 'Tiền mặt (COD)',
    momo: 'Ví MoMo',
    payos: 'PayOS',
    vnpay: 'VNPay'
  };
  return translations[method] || method;
}

/**
 * Clear Cart
 * @param {string} API_BASE
 * @param {string} sessionId
 */
export async function clearCart(API_BASE, sessionId) {
  try {
    await fetch(`${API_BASE}/cart/clear?session_id=${sessionId}`, { method: 'POST' });
  } catch (error) {
    // Silent fail
  }
  // Clear ALL cart storage keys (legacy + menu.js + cart-summary.js)
  localStorage.removeItem('cart');
  localStorage.removeItem('aura_cart');
  localStorage.removeItem('aura_cart_v1');
  // Reset in-memory CART if exposed globally
  if (typeof window !== 'undefined') {
    if (Array.isArray(window.CART)) {window.CART.length = 0;}
    if (window.cart && typeof window.cart === 'object') {
      window.cart.items = [];
      window.cart.total = 0;
      window.cart.count = 0;
    }
  }
}


/**
 * Send Order to Zalo
 */
export function sendOrderToZalo(order) {
  const itemsText = order.items.map(item => `• ${item.name} x${item.quantity} - ${formatPrice(item.price * item.quantity)}`).join('\n');

  const zaloMessage = `
🛒 *ĐƠN HÀNG MỚI - AURA SPACE*
━━━━━━━━━━━━━━━━━━━━━━
📋 Mã đơn: ${order.id}
━━━━━━━━━━━━━━━━━━━━━━
👤 Khách hàng: ${order.customer.full_name}
📞 SĐT: ${order.customer.phone}
📍 Địa chỉ: ${order.customer.address}
⏰ Giao hàng: ${order.deliveryTime === 'now' ? '🚀 Ngay (15-20p)' : '📅 ' + order.scheduledTime}
━━━━━━━━━━━━━━━━━━━━━━
${itemsText}
━━━━━━━━━━━━━━━━━━━━━━
💰 Tạm tính: ${formatPrice(order.subtotal)}
🚛 Phí giao: ${formatPrice(order.shipping_fee)}
${order.discount > 0 ? `🏷️ Giảm giá: -${formatPrice(order.discount)}\n` : ''}
💵 *Tổng cộng: ${formatPrice(order.total)}*
💳 Thanh toán: ${translatePaymentMethod(order.payment_method)}
━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

  const zaloUrl = `https://zalo.me/0913211434?text=${encodeURIComponent(zaloMessage)}`;
  const popup = window.open(zaloUrl, '_blank');
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    // Popup blocked — multi-channel fallback
    console.warn('[Zalo] Popup blocked, fallback to multi-channel');
    alert(
      `📞 Đơn hàng đã ghi nhận!\n\n` +
      `Mã đơn: ${order.id}\n\n` +
      `Liên hệ xác nhận qua:\n` +
      `• Gọi: 0913 211 434\n` +
      `• Zalo: zalo.me/0913211434\n` +
      `• SMS: 0913 211 434\n\n` +
      `Hoặc xem các nút liên hệ trên trang xác nhận.`
    );
  }
}

/**
 * Show Success Modal
 */
export function showSuccessModal(order) {
  const modal = document.getElementById('successModal');
  const orderDetails = document.getElementById('orderDetails');

  if (!modal || !orderDetails) { return; }

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  orderDetails.innerHTML = `
        <h3>Thông tin đơn hàng</h3>
        <div class="order-details-row">
            <span>Mã đơn:</span>
            <span>${esc(order.id)}</span>
        </div>
        <div class="order-details-row">
            <span>Tổng cộng:</span>
            <span>${esc(formatPrice(order.total))}</span>
        </div>
        <div class="order-details-row">
            <span>Thanh toán:</span>
            <span>${esc(translatePaymentMethod(order.payment_method))}</span>
        </div>
    `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Handle COD Success
 * @param {object} order
 * @param {string} API_BASE
 * @param {string} sessionId
 */
export async function handleCODSuccess(order, API_BASE, sessionId) {
  await clearCart(API_BASE, sessionId);
  // Zalo popup removed — Telegram bot xử lý notify bếp.
  // Khách cần liên hệ → dùng nút Tel/Zalo/SMS trên success.html
  // FIX: P0 order flow - Redirect directly to success.html
  window.location.href = `success.html?order_id=${order.id}`;
}

/**
 * Handle MoMo Payment
 * @param {object} order
 * @param {string} API_BASE
 * @param {Function} handlePaymentQR
 */
export async function handleMoMoPayment(order, API_BASE, handlePaymentQR) {
  try {
    const response = await fetch(
      `${API_BASE}/payment/create-url?order_id=${order.id}&payment_method=momo&amount=${order.total}`
    );
    const result = await response.json();

    if (result.success && result.payment_url) {
      localStorage.setItem('pendingOrder', JSON.stringify(order));
      window.location.href = result.payment_url;
    } else {
      throw new Error('Không thể tạo liên kết thanh toán MoMo');
    }
  } catch (error) {
    handlePaymentQR(order, 'momo');
  }
}

/**
 * Handle PayOS Payment
 * @param {object} order
 * @param {string} API_BASE
 * @param {string} sessionId
 */
export async function handlePayOSPayment(order, API_BASE, sessionId) {
  try {
    const response = await fetch(`${API_BASE}/payment/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: order.id,
        amount: Math.round(order.total || 0),
        description: `Don hang #${order.id}`.slice(0, 25),
        customer_name: order.customer?.full_name || 'Khach hang',
      }),
    });
    const result = await response.json();

    if (result.success && result.checkoutUrl) {
      localStorage.setItem('pendingOrder', JSON.stringify(order));
      window.location.href = result.checkoutUrl;
    } else {
      throw new Error(result.error || 'Không thể tạo liên kết thanh toán PayOS');
    }
  } catch (error) {
    await handleCODSuccess(order, API_BASE, sessionId);
  }
}

/**
 * Handle VNPay Payment
 * @param {object} order
 * @param {string} API_BASE
 * @param {Function} handlePaymentQR
 */
export async function handleVNPayPayment(order, API_BASE, handlePaymentQR) {
  try {
    const response = await fetch(
      `${API_BASE}/payment/create-url?order_id=${order.id}&payment_method=vnpay&amount=${order.total}`
    );
    const result = await response.json();

    if (result.success && result.payment_url) {
      localStorage.setItem('pendingOrder', JSON.stringify(order));
      window.location.href = result.payment_url;
    } else {
      handlePaymentQR(order, 'vnpay');
    }
  } catch (error) {
    handlePaymentQR(order, 'vnpay');
  }
}

/**
 * Submit Order - COD
 */
export async function submitOrderCOD(orderData, API_BASE) {
  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...orderData, payment_method: 'cod' })
  });
  return await response.json();
}

/**
 * Submit Order - MoMo
 */
export async function submitOrderMoMo(orderData, API_BASE) {
  const response = await fetch(`${API_BASE}/payment/create-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...orderData, payment_method: 'momo' })
  });
  return await response.json();
}

/**
 * Submit Order - PayOS
 */
export async function submitOrderPayOS(orderData, API_BASE) {
  const response = await fetch(`${API_BASE}/payment/create-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...orderData, payment_method: 'payos' })
  });
  return await response.json();
}

/**
 * Submit Order - VNPay
 */
export async function submitOrderVNPay(orderData, API_BASE) {
  const response = await fetch(`${API_BASE}/payment/create-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...orderData, payment_method: 'vnpay' })
  });
  return await response.json();
}
