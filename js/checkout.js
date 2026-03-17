/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — Checkout & Payment Manager
 *  COD, PayOS, VNPay, MoMo QR Code Payment
 * ═══════════════════════════════════════════════
 */

import { createOrder, createPayOSPayment, createVNPayPayment, createMoMoPayment } from './api-client.js';

// XSS prevention utility
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export class CheckoutManager {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cart') || '[]');
        this.orderId = null;
        this.currentTotal = 0;

        // Payment account info
        this.paymentConfig = {
            bankName: 'MB Bank',
            accountNumber: '0901234567',
            accountHolder: 'F&B CONTAINER CAFE',
            momoPhone: '0901234567'
        };

        this.init();
    }

    init() {
        this.bindFormEvents();
        this.bindPaymentEvents();
        this.loadCartToSummary();
    }

    bindFormEvents() {
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.processCheckout());
        }
    }

    async processCheckout() {
        if (this.cart.length === 0) {
            this.showNotification('Giỏ hàng trống!', 'error');
            return;
        }

        const form = document.getElementById('order-form');
        if (!form) return;

        // Collect form data
        const formData = new FormData(form);
        const orderData = {
            fullName: formData.get('fullName'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            address: formData.get('address'),
            paymentMethod: formData.get('paymentMethod'),
            notes: formData.get('notes'),
            items: this.cart.map(item => ({
                ...item,
                name: this.menuItems[item.id]?.name,
                price: this.menuItems[item.id]?.price
            })),
            total: this.getTotal(),
            createdAt: new Date().toISOString()
        };

        // Validate form
        if (!orderData.fullName || !orderData.phone || !orderData.address) {
            this.showNotification('Vui lòng điền đầy đủ thông tin!', 'error');
            return;
        }

        // Process payment based on method
        switch (orderData.paymentMethod) {
            case 'payos':
                await this.processPayOS(orderData);
                break;
            case 'vnpay':
                await this.processVNPay(orderData);
                break;
            case 'momo':
                await this.processMoMo(orderData);
                break;
            case 'cod':
            default:
                await this.processCOD(orderData);
                break;
        }
    }

    async processCOD(orderData) {
        try {
            // Save order via API client
            const result = await createOrder(orderData);

            // Fallback to localStorage if API fails
            if (!result || !result.id) {
                const orders = JSON.parse(localStorage.getItem('orders') || '[]');
                orders.push(orderData);
                localStorage.setItem('orders', JSON.stringify(orders));
            }

            // Clear cart
            localStorage.removeItem('cart');

            this.showNotification('Đặt hàng thành công! Chúng tôi sẽ liên hệ sớm.', 'success');

            // Redirect to success page or show success modal
            setTimeout(() => {
                window.location.href = '/success.html';
            }, 2000);
        } catch (error) {
            console.error('Error creating order:', error);
            // Fallback to localStorage
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));
            localStorage.removeItem('cart');
            this.showNotification('Đặt hàng thành công! Chúng tôi sẽ liên hệ sớm.', 'success');
            setTimeout(() => {
                window.location.href = '/success.html';
            }, 2000);
        }
    }

    async processPayOS(orderData) {
        try {
            // Use API client to create PayOS payment
            const checkoutUrl = await createPayOSPayment({
                amount: orderData.total,
                description: `Đơn hàng #${Date.now()}`,
                returnUrl: `${window.location.origin}/success.html`,
                cancelUrl: `${window.location.origin}/cancel.html`
            });

            if (checkoutUrl) {
                window.location.href = checkoutUrl;
            } else {
                throw new Error('Không thể tạo link thanh toán');
            }
        } catch (error) {
            console.error('PayOS error:', error);
            this.showNotification('Có lỗi xảy ra khi thanh toán', 'error');
        }
    }

    async processVNPay(orderData) {
        try {
            // Use API client to create VNPay payment
            const paymentUrl = await createVNPayPayment({
                amount: orderData.total,
                description: `Don hang #${Date.now()}`
            });

            if (paymentUrl) {
                window.location.href = paymentUrl;
            }
        } catch (error) {
            console.error('VNPay error:', error);
            this.showNotification('Có lỗi xảy ra khi thanh toán', 'error');
        }
    }

    async processMoMo(orderData) {
        try {
            // Use API client to create MoMo payment
            const payUrl = await createMoMoPayment({
                amount: orderData.total,
                orderId: Date.now()
            });

            if (payUrl) {
                window.location.href = payUrl;
            }
        } catch (error) {
            console.error('MoMo error:', error);
            this.showNotification('Có lỗi xảy ra khi thanh toán', 'error');
        }
    }

    getTotal() {
        return this.cart.reduce((total, item) => {
            return total + (this.getMenuItem(item.id)?.price || 0) * item.quantity;
        }, 0);
    }

    getMenuItem(id) {
        const defaultItems = {
            1: { name: 'Cà phê đen', price: 25000 },
            2: { name: 'Cà phê sữa', price: 30000 },
            3: { name: 'Cappuccino', price: 45000 },
            4: { name: 'Latte', price: 45000 },
            5: { name: 'Trà đào', price: 35000 },
            6: { name: 'Nước cam', price: 40000 },
            7: { name: 'Sinh tố bơ', price: 45000 },
            8: { name: 'Bánh mì', price: 35000 },
            9: { name: 'Croissant', price: 30000 },
            10: { name: 'Tiramisu', price: 55000 },
            11: { name: 'Cheesecake', price: 50000 }
        };
        return defaultItems[id];
    }

    /**
     * Bind payment method events
     */
    bindPaymentEvents() {
        // Payment method selection
        document.querySelectorAll('.payment-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const paymentMethod = card.dataset.payment;

                // Show QR modal for digital payments
                if (['vnpay', 'momo', 'payos'].includes(paymentMethod)) {
                    this.showPaymentQR(paymentMethod);
                }
            });
        });

        // Close payment modal
        const closeBtn = document.getElementById('closePaymentModal');
        const paymentModal = document.getElementById('paymentQrModal');
        if (closeBtn && paymentModal) {
            closeBtn.addEventListener('click', () => {
                paymentModal.style.display = 'none';
            });

            // Close on overlay click
            paymentModal.addEventListener('click', (e) => {
                if (e.target === paymentModal) {
                    paymentModal.style.display = 'none';
                }
            });
        }

        // Payment method tabs
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const paymentType = btn.dataset.payment;
                document.querySelectorAll('.qr-section').forEach(section => {
                    section.classList.remove('active');
                });

                const targetSection = document.getElementById(`${paymentType}-section`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
            });
        });

        // Copy account number
        const copyAccountBtn = document.getElementById('copyAccountBtn');
        if (copyAccountBtn) {
            copyAccountBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(this.paymentConfig.accountNumber);
                this.showNotification('✅ Đã sao chép số tài khoản!', 'success');
            });
        }

        // Copy MoMo phone
        const copyMoMoBtn = document.getElementById('copyMoMoBtn');
        if (copyMoMoBtn) {
            copyMoMoBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(this.paymentConfig.momoPhone);
                this.showNotification('✅ Đã sao chép số điện thoại MoMo!', 'success');
            });
        }

        // Confirm payment button
        const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
        if (confirmPaymentBtn) {
            confirmPaymentBtn.addEventListener('click', () => {
                this.confirmPaymentCompleted();
            });
        }

        // Submit order button
        const submitOrderBtn = document.getElementById('submitOrderBtn');
        if (submitOrderBtn) {
            submitOrderBtn.addEventListener('click', () => {
                this.processCheckout();
            });
        }
    }

    /**
     * Load cart items to summary
     */
    loadCartToSummary() {
        const summaryEl = document.getElementById('orderSummary');
        if (!summaryEl) return;

        if (this.cart.length === 0) {
            summaryEl.innerHTML = '<p class="empty-cart">Giỏ hàng trống</p>';
            return;
        }

        let subtotal = 0;
        summaryEl.innerHTML = this.cart.map(item => {
            const menuItem = this.getMenuItem(item.id);
            const itemTotal = (menuItem?.price || 0) * item.quantity;
            subtotal += itemTotal;

            const safeName = escapeHtml(menuItem?.name || `Sản phẩm #${item.id}`);
            const safeImage = escapeHtml(menuItem?.image || 'images/interior.png');

            return `
                <div class="m3-order-item">
                    <img src="${safeImage}" alt="${safeName}" class="m3-order-item-image">
                    <div class="m3-order-item-details">
                        <span class="m3-order-item-name">${safeName}</span>
                        <span class="m3-order-item-meta">Số lượng: ${item.quantity}</span>
                        <span class="m3-order-item-price">${this.formatCurrency(itemTotal)}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Update totals
        const deliveryFee = 15000;
        const total = subtotal + deliveryFee;
        this.currentTotal = total;

        document.getElementById('summarySubtotal').textContent = this.formatCurrency(subtotal);
        document.getElementById('summaryDelivery').textContent = this.formatCurrency(deliveryFee);
        document.getElementById('summaryTotal').textContent = this.formatCurrency(total);
        document.getElementById('btnTotal').textContent = this.formatCurrency(total);

        // Update QR payment amounts
        this.updateQRAmounts(total);
    }

    /**
     * Update QR display amounts
     */
    updateQRAmounts(total) {
        const formattedAmount = this.formatCurrency(total);
        document.getElementById('qrAmount').textContent = formattedAmount;
        document.getElementById('momoAmount').textContent = formattedAmount;
        document.getElementById('vnpayAmount').textContent = formattedAmount;
    }

    /**
     * Show payment QR modal
     */
    showPaymentQR(paymentMethod) {
        const modal = document.getElementById('paymentQrModal');
        if (!modal) return;

        // Generate order ID
        this.orderId = Date.now();
        const orderIdStr = `#${this.orderId.toString().slice(-6)}`;

        // Update order details
        document.getElementById('transferContent').textContent = `Chuyen khoan don hang ${orderIdStr}`;
        document.getElementById('vnpayOrderId').textContent = orderIdStr;
        document.getElementById('momoContent').textContent = `Thanh toan don hang ${orderIdStr}`;

        // Select appropriate tab
        let paymentType = 'qr-bank';
        if (paymentMethod === 'momo') paymentType = 'momo-qr';
        if (paymentMethod === 'vnpay' || paymentMethod === 'payos') paymentType = 'vnpay-qr';

        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.payment === paymentType) {
                btn.classList.add('active');
            }
        });

        document.querySelectorAll('.qr-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${paymentType}-section`)?.classList.add('active');

        // Show modal
        modal.style.display = 'flex';
    }

    /**
     * Confirm payment completed
     */
    async confirmPaymentCompleted() {
        const modal = document.getElementById('paymentQrModal');
        const statusEl = document.getElementById('paymentStatus');

        if (statusEl) {
            statusEl.innerHTML = `
                <span class="status-icon">⏳</span>
                <span class="status-text">Đang xác nhận thanh toán...</span>
            `;
        }

        // Simulate payment verification (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Save order
        const form = document.getElementById('checkoutForm') || document.getElementById('order-form');
        if (form) {
            const formData = new FormData(form);
            const orderData = {
                id: this.orderId,
                fullName: formData.get('name') || formData.get('fullName'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                address: formData.get('address'),
                paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'vnpay',
                items: this.cart,
                total: this.currentTotal,
                status: 'pending_payment',
                createdAt: new Date().toISOString()
            };

            // Save to localStorage
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));
            localStorage.removeItem('cart');
        }

        if (statusEl) {
            statusEl.innerHTML = `
                <span class="status-icon">✅</span>
                <span class="status-text">Thanh toán thành công!</span>
            `;
        }

        // Redirect to success page
        setTimeout(() => {
            window.location.href = '/success.html';
        }, 1500);
    }

    /**
     * Format currency to Vietnamese Dong
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'error' ? '#B00020' : type === 'success' ? '#00C853' : 'var(--md-sys-color-primary)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }
}

// Initialize checkout on page load
new CheckoutManager();
