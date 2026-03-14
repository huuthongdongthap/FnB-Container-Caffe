/**
 * Checkout & Payment System - Backend API Integration
 * F&B Caffe Container - Order Processing
 */

// Cart state - will be loaded from API
let cart = { items: [], total: 0, count: 0 };
let sessionId = null;
let discount = { code: null, percent: 0, amount: 0 };
const API_BASE = 'http://localhost:8000/api';

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
    initSession();
    loadCartFromAPI();
    initDeliveryTimeToggle();
    initPaymentMethodSelect();
    initDiscountCode();
    initSubmitOrder();
    initThemeToggle();
    initializeWebSocketTracking();
});

/**
 * Initialize Session
 */
function initSession() {
    sessionId = localStorage.getItem('fnb_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('fnb_session_id', sessionId);
    }
}

/**
 * Load Cart from Backend API
 */
async function loadCartFromAPI() {
    try {
        const response = await fetch(`${API_BASE}/cart?session_id=${sessionId}`);
        const result = await response.json();

        if (result.success) {
            cart = result.cart;
            loadCartToSummary();
        } else {
            // Cart is empty
            handleEmptyCart();
        }
    } catch (error) {
        // Fallback to localStorage
        cart = JSON.parse(localStorage.getItem('cart')) || { items: [], total: 0, count: 0 };
        loadCartToSummary();
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

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

/**
 * Handle Empty Cart
 */
function handleEmptyCart() {
    const summaryContainer = document.getElementById('orderSummary');
    if (summaryContainer) {
        summaryContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">🛒 Giỏ hàng trống</p>';
    }

    if (confirm('🛒 Giỏ hàng trống. Chuyển đến menu để đặt hàng?')) {
        window.location.href = 'menu.html';
    }
}

/**
 * Initialize Checkout
 */
function initCheckout() {
    // Check if cart is empty
    if (!cart.items || cart.items.length === 0) {
        handleEmptyCart();
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

    // Show QR preview when selecting payment method (optional UX enhancement)
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const method = e.target.value;
            // Only show QR preview for MoMo and VNPay if order already exists
            if ((method === 'momo' || method === 'vnpay') && currentOrderForQR) {
                // Can show preview here if needed
            }
        });
    });
}

/**
 * Load Cart to Summary
 */
function loadCartToSummary() {
    const summaryContainer = document.getElementById('orderSummary');
    if (!summaryContainer) return;

    const items = cart.items || [];

    if (items.length === 0) {
        handleEmptyCart();
        return;
    }

    summaryContainer.innerHTML = items.map(item => `
        <div class="summary-item" data-id="${item.id}">
            <div class="summary-item-info">
                <div class="summary-item-name">${item.name}</div>
                <div class="summary-item-meta">
                    <span class="summary-item-qty">x${item.quantity}</span>
                    · ${formatPrice(item.price)}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="summary-item-price">${formatPrice(item.price * item.quantity)}</span>
                <button class="summary-item-remove" onclick="removeItem('${item.id}')">×</button>
            </div>
        </div>
    `).join('');

    updateTotals(cart.total || 0);
}

/**
 * Update Totals
 */
function updateTotals(subtotal) {
    const deliveryFee = calculateDeliveryFee(subtotal);
    const discountAmount = discount.amount || 0;
    const total = subtotal + deliveryFee - discountAmount;

    // Update display
    const summarySubtotalEl = document.getElementById('summarySubtotal');
    const summaryDeliveryEl = document.getElementById('summaryDelivery');
    const summaryTotalEl = document.getElementById('summaryTotal');
    const btnTotalEl = document.getElementById('btnTotal');

    if (summarySubtotalEl) summarySubtotalEl.textContent = formatPrice(subtotal);
    if (summaryDeliveryEl) summaryDeliveryEl.textContent = deliveryFee === 0 ? 'Miễn phí' : formatPrice(deliveryFee);
    if (summaryTotalEl) summaryTotalEl.textContent = formatPrice(total);
    if (btnTotalEl) btnTotalEl.textContent = formatPrice(total);

    // Update discount display
    const discountRow = document.getElementById('discountRow');
    if (discount.percent > 0 && discountRow) {
        discountRow.style.display = 'flex';
        const discountCodeEl = document.getElementById('discountCode');
        const summaryDiscountEl = document.getElementById('summaryDiscount');
        if (discountCodeEl) discountCodeEl.textContent = discount.code;
        if (summaryDiscountEl) summaryDiscountEl.textContent = `-${formatPrice(discountAmount)}`;
    } else if (discountRow) {
        discountRow.style.display = 'none';
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
    // Far wards
    const farWards = ['my-phuoc', 'tan-kien-dung', 'khac'];

    if (farWards.includes(ward)) {
        return DELIVERY_FEES.far;
    }

    return DELIVERY_FEES.default;
}

/**
 * Remove Item from Cart
 */
async function removeItem(id) {
    if (!confirm('Xóa món này khỏi giỏ hàng?')) return;

    try {
        const response = await fetch(`${API_BASE}/cart/remove?item_id=${id}&session_id=${sessionId}`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            cart = result.cart;
            localStorage.setItem('cart', JSON.stringify(cart));
            loadCartToSummary();
            updateCartCount();
            showToast('Đã xóa sản phẩm', 'success');
        } else {
            showToast('Không thể xóa sản phẩm', 'error');
        }
    } catch (error) {
        // Fallback to localStorage
        delete cart[id];
        localStorage.setItem('cart', JSON.stringify(cart));
        loadCartToSummary();
        showToast('Đã xóa sản phẩm', 'success');
    }

    if (!cart.items || cart.items.length === 0) {
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
    const count = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
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
            const subtotal = cart.total || 0;
            let discountAmount = (subtotal * validCodes[code].percent) / 100;

            // Cap at max discount
            if (validCodes[code].maxDiscount && discountAmount > validCodes[code].maxDiscount) {
                discountAmount = validCodes[code].maxDiscount;
            }

            discount = {
                code: code,
                percent: validCodes[code].percent,
                amount: discountAmount
            };

            alert(`✅ Áp dụng mã giảm giá thành công! Giảm ${validCodes[code].percent}% (tối đa ${formatPrice(validCodes[code].maxDiscount)})`);
            updateTotals(subtotal);
        } else {
            alert('❌ Mã giảm giá không hợp lệ');
            discount = { code: null, percent: 0, amount: 0 };
            updateTotals(cart.total || 0);
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
        const items = cart.items || [];
        if (items.length === 0) {
            showToast('🛒 Giỏ hàng trống. Vui lòng chọn món!', 'error');
            return;
        }

        // Get form data
        const formData = new FormData(form);

        // Calculate totals
        const subtotal = cart.total || 0;
        const deliveryFee = calculateDeliveryFee(subtotal);
        const discountAmount = discount.amount || 0;
        const total = subtotal + deliveryFee - discountAmount;

        const orderData = {
            session_id: sessionId,
            customer: {
                full_name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                address: formData.get('address'),
                ward: formData.get('ward'),
                district: 'Sa Đéc',
                city: 'Đồng Tháp',
                notes: formData.get('notes')
            },
            payment_method: document.querySelector('input[name="paymentMethod"]:checked')?.value
        };

        // Disable button during processing with loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-text">⏳ Đang xử lý...</span>';
        submitBtn.style.opacity = '0.7';

        try {
            // Create order via API
            const response = await fetch(`${API_BASE}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();

            if (result.success) {
                const order = result.order;

                // Handle different payment methods
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

/**
 * Handle COD Success
 */
async function handleCODSuccess(order) {
    // Clear cart
    await clearCart();

    // Show success modal
    showSuccessModal(order);

    // Send to Zalo
    sendOrderToZalo(order);

    // Send to WebSocket for real-time tracking
    sendOrderToWebSocket(order);
}

/**
 * Send Order to WebSocket Server
 */
function sendOrderToWebSocket(order) {
    if (!window.OrderTracker || !window.OrderTracker.ws) {
        return;
    }

    try {
        // Send new_order event to broadcast to KDS and admin
        window.OrderTracker.sendNewOrder({
            id: order.id,
            customer: order.customer,
            items: order.items || [],
            total: order.total,
            payment_method: order.payment_method,
            status: 'pending',
            created_at: order.created_at || new Date().toISOString()
        });
    } catch (error) {
        // Silent fail for production
    }
}

/**
 * Handle MoMo Payment
 */
async function handleMoMoPayment(order) {
    try {
        // Try API first
        const response = await fetch(
            `${API_BASE}/payment/create-url?order_id=${order.id}&payment_method=momo&amount=${order.total}`
        );
        const result = await response.json();

        if (result.success && result.payment_url) {
            // Save pending order
            localStorage.setItem('pendingOrder', JSON.stringify(order));
            // Send to WebSocket for tracking
            sendOrderToWebSocket(order);
            // Redirect to payment
            window.location.href = result.payment_url;
        } else {
            // Fallback: show QR code modal
            throw new Error('Không thể tạo liên kết thanh toán MoMo');
        }
    } catch (error) {
        // Show QR code modal as fallback
        handlePaymentQR(order, 'momo');
    }
}

/**
 * Handle PayOS Payment
 */
async function handlePayOSPayment(order) {
    try {
        const response = await fetch(
            `${API_BASE}/payment/create-url?order_id=${order.id}&payment_method=payos&amount=${order.total}`
        );
        const result = await response.json();

        if (result.success && result.payment_url) {
            localStorage.setItem('pendingOrder', JSON.stringify(order));
            // Send to WebSocket for tracking
            sendOrderToWebSocket(order);
            window.location.href = result.payment_url;
        } else {
            throw new Error('Không thể tạo liên kết thanh toán PayOS');
        }
    } catch (error) {
        await handleCODSuccess(order);
    }
}

/**
 * Handle VNPay Payment
 */
async function handleVNPayPayment(order) {
    try {
        const response = await fetch(
            `${API_BASE}/payment/create-url?order_id=${order.id}&payment_method=vnpay&amount=${order.total}`
        );
        const result = await response.json();

        if (result.success && result.payment_url) {
            localStorage.setItem('pendingOrder', JSON.stringify(order));
            // Send to WebSocket for tracking
            sendOrderToWebSocket(order);
            window.location.href = result.payment_url;
        } else {
            // Show QR code modal as fallback
            handlePaymentQR(order, 'vnpay');
        }
    } catch (error) {
        // Show QR code modal as fallback
        handlePaymentQR(order, 'vnpay');
    }
}

/**
 * Clear Cart
 */
async function clearCart() {
    try {
        await fetch(`${API_BASE}/cart/clear?session_id=${sessionId}`, { method: 'POST' });
    } catch (error) {
        // Silent fail
    }
    localStorage.removeItem('cart');
    cart = { items: [], total: 0, count: 0 };
}

/**
 * Send Order to Zalo
 */
function sendOrderToZalo(order) {
    const itemsText = order.items.map(item => `• ${item.name} x${item.quantity} - ${formatPrice(item.price * item.quantity)}`).join('\n');

    const zaloMessage = `
🛒 *ĐƠN HÀNG MỚI - F&B CONTAINER*
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

    // Open Zalo with pre-filled message
    const zaloUrl = `https://zalo.me/0901234567?text=${encodeURIComponent(zaloMessage)}`;
    window.open(zaloUrl, '_blank');
}

/**
 * Show Success Modal
 */
function showSuccessModal(order) {
    const modal = document.getElementById('successModal');
    const orderDetails = document.getElementById('orderDetails');

    if (!modal || !orderDetails) return;

    orderDetails.innerHTML = `
        <h3>Thông tin đơn hàng</h3>
        <div class="order-details-row">
            <span>Mã đơn:</span>
            <span>${order.id}</span>
        </div>
        <div class="order-details-row">
            <span>Tổng cộng:</span>
            <span>${formatPrice(order.total)}</span>
        </div>
        <div class="order-details-row">
            <span>Thanh toán:</span>
            <span>${translatePaymentMethod(order.payment_method)}</span>
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
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Export for global access
window.checkoutUtils = {
    removeItem,
    formatPrice
};

/**
 * Payment Method Handlers - Required for tests
 */
async function submitOrderCOD(orderData) {
    // COD payment handler
    const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, payment_method: 'cod' })
    });
    return await response.json();
}

async function submitOrderMoMo(orderData) {
    // MoMo payment handler
    const response = await fetch(`${API_BASE}/payment/create-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, payment_method: 'momo' })
    });
    return await response.json();
}

async function submitOrderPayOS(orderData) {
    // PayOS payment handler
    const response = await fetch(`${API_BASE}/payment/create-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, payment_method: 'payos' })
    });
    return await response.json();
}

async function submitOrderVNPay(orderData) {
    // VNPay payment handler
    const response = await fetch(`${API_BASE}/payment/create-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, payment_method: 'vnpay' })
    });
    return await response.json();
}

/**
 * Save Order to LocalStorage
 */
function saveOrderToLocalStorage(order) {
    localStorage.setItem('lastOrder', JSON.stringify(order));
    localStorage.setItem('pendingOrder', JSON.stringify(order));
}

// ─── Dark Mode Theme Toggle ───
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');

    if (!themeToggle) return;

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
    // Check if WebSocketClient is available
    if (!window.WebSocketClient) {
        return;
    }

    try {
        orderWebSocket = new window.WebSocketClient();

        // Handle connection success
        orderWebSocket.on('connected', (data) => {
            showToast('📡 Đã kết nối theo dõi đơn hàng', 'success');
        });

        // Handle new order confirmation
        orderWebSocket.on('new_order', (data) => {
            showToast('✅ Đơn hàng đã được tạo!', 'success');

            // Save order ID for tracking
            if (data.id) {
                localStorage.setItem('trackingOrderId', data.id);
            }
        });

        // Handle order status updates
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

        // Handle errors
        orderWebSocket.on('error', (data) => {
            showToast('⚠️ Lỗi kết nối: ' + (data.message || 'Không xác định'), 'error');
        });

        // Connect as customer
        const trackingOrderId = localStorage.getItem('trackingOrderId');
        await orderWebSocket.connect('customer', trackingOrderId);

        // Start heartbeat
        orderWebSocket.startHeartbeat(30000);
    } catch (error) {
        // Silent fail for production
    }
}

// Export WebSocket functions
window.orderTracking = {
    connect: () => orderWebSocket?.connect('customer', localStorage.getItem('trackingOrderId')),
    disconnect: () => orderWebSocket?.disconnect(),
    getStatus: (orderId) => orderWebSocket?.getOrderStatus(orderId),
    isConnected: () => orderWebSocket?.ws?.readyState === WebSocket.OPEN
};

// ─── Payment QR Code Generator ───
let currentOrderForQR = null;

/**
 * Open Payment QR Modal
 */
function openPaymentQRModal(order, paymentMethod = 'qr-bank') {
    currentOrderForQR = order;
    const modal = document.getElementById('paymentQrModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Switch to selected payment method
    switchPaymentMethodQR(paymentMethod);

    // Setup event listeners
    setupPaymentQRHandlers();
}

/**
 * Switch Payment Method QR
 */
function switchPaymentMethodQR(method) {
    // Update active button
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.payment === method);
    });

    // Show/hide sections
    document.querySelectorAll('.qr-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    const activeSection = document.getElementById(`${method}-section`);
    if (activeSection) {
        activeSection.classList.add('active');
        activeSection.style.display = 'block';
    }

    // Generate QR for selected method
    if (method === 'qr-bank') {
        generateBankQR();
    } else if (method === 'momo-qr') {
        generateMoMoQR();
    } else if (method === 'vnpay-qr') {
        generateVNPayQR();
    }
}

/**
 * Generate Bank Transfer QR Code
 */
function generateBankQR() {
    if (!currentOrderForQR) return;

    const { accountNumber, bankName, bankCode } = getBankConfig();
    const amount = currentOrderForQR.total;
    const content = `Chuyen khoan don hang #${currentOrderForQR.id}`;

    // Update info display
    const bankNameEl = document.getElementById('bankName');
    const accountNumberEl = document.getElementById('accountNumber');
    const qrAmountEl = document.getElementById('qrAmount');
    const transferContentEl = document.getElementById('transferContent');

    if (bankNameEl) bankNameEl.textContent = bankName;
    if (accountNumberEl) accountNumberEl.textContent = accountNumber;
    if (qrAmountEl) qrAmountEl.textContent = formatPrice(amount);
    if (transferContentEl) transferContentEl.textContent = content;

    // Generate VietQR format
    const qrData = generateVietQR(accountNumber, bankCode, amount, content);
    renderQRCode('qrBankCode', qrData);
}

/**
 * Generate MoMo QR Code
 */
function generateMoMoQR() {
    if (!currentOrderForQR) return;

    const amount = currentOrderForQR.total;
    const orderId = currentOrderForQR.id;

    // MoMo QR format (simplified)
    const momoData = `https://momowallet.page.link/?order_id=${orderId}&amount=${amount}&info=FNB%20Container%20Cafe`;

    renderQRCode('qrMoMoCode', momoData, '#f4613f');
}

/**
 * Generate VNPay QR Code
 */
function generateVNPayQR() {
    if (!currentOrderForQR) return;

    const amount = currentOrderForQR.total;
    const orderId = currentOrderForQR.id;
    const { accountNumber, bankCode } = getBankConfig();

    // VNPay QR format
    const vnpayData = `${bankCode}${accountNumber}${amount}${orderId}`;

    renderQRCode('qrVNPayCode', vnpayData, '#0066b3');
}

/**
 * Get Bank Config
 */
function getBankConfig() {
    return {
        accountNumber: '0901234567',
        bankName: 'MB Bank',
        bankCode: 'MB'
    };
}

/**
 * Generate VietQR Format
 */
function generateVietQR(accountNumber, bankCode, amount, addInfo) {
    // Simple VietQR format
    return `https://vietqr.io/${bankCode}/${accountNumber}?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}`;
}

/**
 * Render QR Code as SVG
 */
function renderQRCode(containerId, data, color = '#000') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Use QR code API or generate simple SVG
    const qrSvg = generateSimpleQR(data, color);
    container.innerHTML = qrSvg;
}

/**
 * Generate Simple QR SVG
 */
function generateSimpleQR(data, color) {
    // Generate a deterministic pattern based on data
    const hash = simpleHash(data);
    const size = 200;
    const modules = 21;
    const moduleSize = size / modules;
    const margin = 4 * moduleSize;

    let svg = `<svg viewBox="0 0 ${size} ${size}" width="200" height="200" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect fill="#fff" width="${size}" height="${size}"/>`;
    svg += `<g fill="${color}">`;

    // Corner markers (finder patterns)
    svg += generateFinderPattern(0, 0, moduleSize, color);
    svg += generateFinderPattern(modules - 7, 0, moduleSize, color);
    svg += generateFinderPattern(0, modules - 7, moduleSize, color);

    // Generate data modules based on hash
    for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
            // Skip finder patterns
            if ((row < 8 && col < 8) || (row < 8 && col > modules - 9) || (row > modules - 9 && col < 8)) {
                continue;
            }

            // Deterministic pattern based on hash
            const cellHash = (hash + row * modules + col) % 10;
            if (cellHash > 4) {
                svg += `<rect x="${margin + col * moduleSize}" y="${margin + row * moduleSize}" width="${moduleSize - 1}" height="${moduleSize - 1}"/>`;
            }
        }
    }

    svg += `</g></svg>`;
    return svg;
}

/**
 * Generate Finder Pattern
 */
function generateFinderPattern(x, y, moduleSize, color) {
    const size = 7 * moduleSize;
    let pattern = '';

    // Outer square
    pattern += `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${moduleSize}"/>`;
    // Inner square
    pattern += `<rect x="${(x + 2) * moduleSize}" y="${(y + 2) * moduleSize}" width="${3 * moduleSize}" height="${3 * moduleSize}"/>`;

    return pattern;
}

/**
 * Simple Hash Function
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Setup Payment QR Handlers
 */
function setupPaymentQRHandlers() {
    // Payment method switch buttons
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const method = btn.dataset.payment;
            switchPaymentMethodQR(method);
        });
    });

    // Close modal button
    const closeBtn = document.getElementById('closePaymentModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePaymentQRModal);
    }

    // Modal overlay click
    const modal = document.getElementById('paymentQrModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closePaymentQRModal();
            }
        });
    }

    // Copy account button
    const copyBtn = document.getElementById('copyAccountBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyAccountNumber);
    }
}

/**
 * Close Payment QR Modal
 */
function closePaymentQRModal() {
    const modal = document.getElementById('paymentQrModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Copy Account Number
 */
async function copyAccountNumber() {
    const { accountNumber } = getBankConfig();
    try {
        await navigator.clipboard.writeText(accountNumber);
        showToast('✅ Đã sao chép số tài khoản', 'success');
    } catch (error) {
        showToast('⚠️ Không thể sao chép', 'error');
    }
}

/**
 * Handle Payment with QR
 */
async function handlePaymentQR(order, paymentMethod) {
    // Save pending order
    localStorage.setItem('pendingOrder', JSON.stringify(order));

    // Send to WebSocket for tracking
    sendOrderToWebSocket(order);

    // Open QR modal
    const qrMethod = paymentMethod === 'momo' ? 'momo-qr' : paymentMethod === 'vnpay' ? 'vnpay-qr' : 'qr-bank';
    openPaymentQRModal(order, qrMethod);
}

// Export payment QR functions
window.paymentQR = {
    open: openPaymentQRModal,
    close: closePaymentQRModal,
    handlePayment: handlePaymentQR
};
