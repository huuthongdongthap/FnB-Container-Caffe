/**
 * Checkout & Payment System
 * F&B Caffe Container - Order Processing
 */

// Cart state - synced from main site
let cart = JSON.parse(localStorage.getItem('cart')) || {};
let discount = { code: null, percent: 0, amount: 0 };

// Payment Gateway Config
const PAYMENT_CONFIG = {
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

// Delivery fee config by ward
const DELIVERY_FEES = {
    default: 15000,
    far: 25000,
    freeThreshold: 500000 // Free delivery for orders >= 500K
};

document.addEventListener('DOMContentLoaded', () => {
    initCheckout();
    initDeliveryTimeToggle();
    initPaymentMethodSelect();
    initDiscountCode();
    initSubmitOrder();
    loadCartToSummary();
});

/**
 * Initialize Checkout
 */
function initCheckout() {
    // Check if cart is empty
    if (Object.keys(cart).length === 0) {
        // Redirect to menu if cart is empty
        if (confirm('🛒 Giỏ hàng trống. Chuyển đến menu để đặt hàng?')) {
            window.location.href = 'menu.html';
        }
    }
}

/**
 * Delivery Time Toggle
 */
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

/**
 * Payment Method Selection
 */
function initPaymentMethodSelect() {
    const paymentCards = document.querySelectorAll('.payment-card');

    paymentCards.forEach(card => {
        card.addEventListener('click', () => {
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;

            // Visual feedback
            paymentCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

/**
 * Load Cart to Summary
 */
function loadCartToSummary() {
    const summaryContainer = document.getElementById('orderSummary');
    if (!summaryContainer) return;

    const items = Object.values(cart);

    if (items.length === 0) {
        summaryContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Giỏ hàng trống</p>';
        updateTotals(0);
        return;
    }

    summaryContainer.innerHTML = items.map(item => `
        <div class="summary-item" data-id="${item.id}">
            <div class="summary-item-info">
                <div class="summary-item-name">${item.name}</div>
                <div class="summary-item-meta">
                    <span class="summary-item-qty">x${item.qty}</span>
                    · ${formatPrice(item.price)}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="summary-item-price">${formatPrice(item.price * item.qty)}</span>
                <button class="summary-item-remove" onclick="removeItem('${item.id}')">×</button>
            </div>
        </div>
    `).join('');

    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    updateTotals(subtotal);
}

/**
 * Update Totals
 */
function updateTotals(subtotal) {
    const deliveryFee = calculateDeliveryFee(subtotal);
    const discountAmount = (subtotal * discount.percent) / 100;
    const total = subtotal + deliveryFee - discountAmount;

    // Update display
    document.getElementById('summarySubtotal').textContent = formatPrice(subtotal);
    document.getElementById('summaryDelivery').textContent = deliveryFee === 0 ? 'Miễn phí' : formatPrice(deliveryFee);
    document.getElementById('summaryTotal').textContent = formatPrice(total);
    document.getElementById('btnTotal').textContent = formatPrice(total);

    // Update discount display
    if (discount.percent > 0) {
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountCode').textContent = discount.code;
        document.getElementById('summaryDiscount').textContent = `-${formatPrice(discountAmount)}`;
    } else {
        document.getElementById('discountRow').style.display = 'none';
    }
}

/**
 * Calculate Delivery Fee
 */
function calculateDeliveryFee(subtotal) {
    // Free delivery for orders >= 500K
    if (subtotal >= DELIVERY_FEES.freeThreshold) {
        return 0;
    }

    const ward = document.getElementById('ward')?.value;
    // Far wards (example logic)
    const farWards = ['my-phuoc', 'tan-kien-dung', 'khac'];

    if (farWards.includes(ward)) {
        return DELIVERY_FEES.far;
    }

    return DELIVERY_FEES.default;
}

/**
 * Remove Item from Cart
 */
function removeItem(id) {
    delete cart[id];
    localStorage.setItem('cart', JSON.stringify(cart));
    loadCartToSummary();

    // Update cart count in main site
    updateCartCount();

    if (Object.keys(cart).length === 0) {
        setTimeout(() => {
            if (confirm('🛒 Giỏ hàng trống. Quay lại menu?')) {
                window.location.href = 'menu.html';
            }
        }, 500);
    }
}

/**
 * Update Cart Count (sync with main site)
 */
function updateCartCount() {
    const count = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
    // Dispatch event for main site to listen
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count } }));
}

/**
 * Discount Code Handler
 */
function initDiscountCode() {
    const applyBtn = document.getElementById('applyDiscountBtn');
    const codeInput = document.getElementById('discountCode');

    if (!applyBtn) return;

    applyBtn.addEventListener('click', () => {
        const code = codeInput.value.trim().toUpperCase();

        if (!code) {
            alert('⚠️ Vui lòng nhập mã giảm giá');
            return;
        }

        // Validate discount code
        const validCodes = {
            'FIRSTORDER': { percent: 10, maxDiscount: 50000 },
            'WELCOME10': { percent: 10, maxDiscount: 30000 },
            'SADEC20': { percent: 20, maxDiscount: 100000 },
            'CONTAINER': { percent: 15, maxDiscount: 75000 }
        };

        if (validCodes[code]) {
            discount = {
                code: code,
                percent: validCodes[code].percent,
                maxDiscount: validCodes[code].maxDiscount
            };

            const subtotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
            let discountAmount = (subtotal * discount.percent) / 100;

            // Cap at max discount
            if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
                discountAmount = discount.maxDiscount;
            }

            discount.amount = discountAmount;

            alert(`✅ Áp dụng mã giảm giá thành công! Giảm ${discount.percent}% (tối đa ${formatPrice(discount.maxDiscount)})`);
            updateTotals(subtotal);
        } else {
            alert('❌ Mã giảm giá không hợp lệ');
            discount = { code: null, percent: 0, amount: 0 };
            const subtotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
            updateTotals(subtotal);
        }
    });
}

/**
 * Submit Order Handler
 */
function initSubmitOrder() {
    const submitBtn = document.getElementById('submitOrderBtn');

    if (!submitBtn) return;

    submitBtn.addEventListener('click', async () => {
        // Validate form
        const form = document.getElementById('checkoutForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Validate cart
        const items = Object.values(cart);
        if (items.length === 0) {
            alert('🛒 Giỏ hàng trống. Vui lòng chọn món!');
            return;
        }

        // Get form data
        const formData = new FormData(form);
        const orderData = {
            customer: {
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                address: formData.get('address'),
                ward: formData.get('ward'),
                notes: formData.get('notes')
            },
            deliveryTime: formData.get('deliveryTime'),
            scheduledTime: formData.get('scheduledTime'),
            paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value,
            items: items,
            totals: {
                subtotal: items.reduce((sum, item) => sum + item.price * item.qty, 0),
                delivery: calculateDeliveryFee(items.reduce((sum, item) => sum + item.price * item.qty, 0)),
                discount: discount.amount,
                total: items.reduce((sum, item) => sum + item.price * item.qty, 0) +
                       calculateDeliveryFee(items.reduce((sum, item) => sum + item.price * item.qty, 0)) -
                       discount.amount
            }
        };

        // Disable button during processing
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-text">⏳ Đang xử lý...</span>';

        try {
            // Handle different payment methods
            if (orderData.paymentMethod === 'cod') {
                await submitOrderCOD(orderData);
            } else if (orderData.paymentMethod === 'momo') {
                await submitOrderMoMo(orderData);
            } else if (orderData.paymentMethod === 'payos') {
                await submitOrderPayOS(orderData);
            } else if (orderData.paymentMethod === 'vnpay') {
                await submitOrderVNPay(orderData);
            }
        } catch (error) {
            console.error('Order submission error:', error);
            alert('⚠️ Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại!');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="btn-text">✅ Xác Nhận Đặt Hàng</span><span class="btn-total">' + formatPrice(orderData.totals.total) + '</span>';
        }
    });
}

/**
 * Submit Order - COD (Cash on Delivery)
 */
async function submitOrderCOD(orderData) {
    // Save order to localStorage (in production, send to backend)
    const orderId = 'ORD' + Date.now();
    orderData.id = orderId;
    orderData.status = 'pending';
    orderData.createdAt = new Date().toISOString();

    localStorage.setItem('lastOrder', JSON.stringify(orderData));

    // Clear cart
    localStorage.removeItem('cart');

    // Show success modal
    showSuccessModal(orderData);

    // Send to Zalo (in production, send to backend API)
    sendOrderToZalo(orderData);
}

/**
 * Submit Order - MoMo
 */
async function submitOrderMoMo(orderData) {
    // In production, create payment request to backend
    // Backend will communicate with MoMo API

    const orderId = 'ORD' + Date.now();

    // Redirect to MoMo payment
    const paymentUrl = buildMoMoPaymentUrl(orderData);

    // Save pending order
    orderData.id = orderId;
    orderData.paymentUrl = paymentUrl;
    localStorage.setItem('pendingOrder', JSON.stringify(orderData));

    // Redirect to payment
    window.location.href = paymentUrl;
}

/**
 * Build MoMo Payment URL (placeholder)
 */
function buildMoMoPaymentUrl(orderData) {
    const amount = orderData.totals.total;
    const orderId = orderData.id;
    const orderInfo = `Don hang ${orderId} - F&B Container`;

    // This is a placeholder - actual implementation requires backend signature
    return `${PAYMENT_CONFIG.momo.endpoint}?partnerCode=${PAYMENT_CONFIG.momo.partnerCode}&amount=${amount}&orderInfo=${encodeURIComponent(orderInfo)}`;
}

/**
 * Submit Order - PayOS
 */
async function submitOrderPayOS(orderData) {
    const orderId = 'ORD' + Date.now();

    // Build PayOS checkout URL
    const checkoutUrl = buildPayOSCheckoutUrl(orderData);

    orderData.id = orderId;
    localStorage.setItem('pendingOrder', JSON.stringify(orderData));

    window.location.href = checkoutUrl;
}

/**
 * Build PayOS Checkout URL (placeholder)
 */
function buildPayOSCheckoutUrl(orderData) {
    // Placeholder - actual implementation requires backend API
    return `${PAYMENT_CONFIG.payos.checkoutUrl}?client_id=${PAYMENT_CONFIG.payos.clientId}&amount=${orderData.totals.total}`;
}

/**
 * Submit Order - VNPay
 */
async function submitOrderVNPay(orderData) {
    const orderId = 'ORD' + Date.now();

    // Build VNPay payment URL
    const paymentUrl = buildVNPayPaymentUrl(orderData);

    orderData.id = orderId;
    localStorage.setItem('pendingOrder', JSON.stringify(orderData));

    window.location.href = paymentUrl;
}

/**
 * Build VNPay Payment URL (placeholder)
 */
function buildVNPayPaymentUrl(orderData) {
    // Placeholder - actual VNPay integration requires server-side hash generation
    return `${PAYMENT_CONFIG.vnpay.endpoint}?vnp_Amount=${orderData.totals.total}&vnp_OrderInfo=${encodeURIComponent('Don hang ' + orderData.id)}`;
}

/**
 * Send Order to Zalo
 */
function sendOrderToZalo(orderData) {
    const itemsText = orderData.items.map(item => `• ${item.name} x${item.qty} - ${formatPrice(item.price * item.qty)}`).join('\n');

    const zaloMessage = `
🛒 *ĐƠN HÀNG MỚI - F&B CONTAINER*
━━━━━━━━━━━━━━━━━━━━━━
📋 Mã đơn: ${orderData.id}
━━━━━━━━━━━━━━━━━━━━━━
👤 Khách hàng: ${orderData.customer.name}
📞 SĐT: ${orderData.customer.phone}
📍 Địa chỉ: ${orderData.customer.address}
⏰ Giao hàng: ${orderData.deliveryTime === 'now' ? '🚀 Ngay (15-20p)' : '📅 ' + orderData.scheduledTime}
━━━━━━━━━━━━━━━━━━━━━━
${itemsText}
━━━━━━━━━━━━━━━━━━━━━━
💰 Tạm tính: ${formatPrice(orderData.totals.subtotal)}
🚛 Phí giao: ${formatPrice(orderData.totals.delivery)}
${orderData.totals.discount > 0 ? `🏷️ Giảm giá: -${formatPrice(orderData.totals.discount)}\n` : ''}
💵 *Tổng cộng: ${formatPrice(orderData.totals.total)}*
💳 Thanh toán: ${translatePaymentMethod(orderData.paymentMethod)}
━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    // Open Zalo with pre-filled message
    const zaloUrl = `https://zalo.me/0901234567?text=${encodeURIComponent(zaloMessage)}`;
    window.open(zaloUrl, '_blank');
}

/**
 * Show Success Modal
 */
function showSuccessModal(orderData) {
    const modal = document.getElementById('successModal');
    const orderDetails = document.getElementById('orderDetails');

    if (!modal || !orderDetails) return;

    orderDetails.innerHTML = `
        <h3>Thông tin đơn hàng</h3>
        <div class="order-details-row">
            <span>Mã đơn:</span>
            <span>${orderData.id}</span>
        </div>
        <div class="order-details-row">
            <span>Tổng cộng:</span>
            <span>${formatPrice(orderData.totals.total)}</span>
        </div>
        <div class="order-details-row">
            <span>Thanh toán:</span>
            <span>${translatePaymentMethod(orderData.paymentMethod)}</span>
        </div>
    `;

    modal.classList.add('active');

    // Prevent background scroll
    document.body.style.overflow = 'hidden';
}

/**
 * Translate Payment Method
 */
function translatePaymentMethod(method) {
    const translations = {
        cod: 'Tiền mặt (COD)',
        momo: 'Ví MoMo',
        payos: 'PayOS',
        vnpay: 'VNPay'
    };
    return translations[method] || method;
}

/**
 * Format Price
 */
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

// Export for global access
window.checkoutUtils = {
    removeItem,
    formatPrice
};
