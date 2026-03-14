// Checkout Manager - Order Processing & Payment

export class CheckoutManager {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cart') || '[]');
        this.menuItems = {
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
        this.init();
    }

    init() {
        this.bindFormEvents();
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
        // Save order to local storage for demo
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(orderData);
        localStorage.setItem('orders', JSON.stringify(orders));

        // Clear cart
        localStorage.removeItem('cart');

        this.showNotification('Đặt hàng thành công! Chúng tôi sẽ liên hệ sớm.', 'success');

        // Redirect to success page or show success modal
        setTimeout(() => {
            window.location.href = '/success.html';
        }, 2000);
    }

    async processPayOS(orderData) {
        try {
            // Call PayOS API endpoint
            const response = await fetch('/api/payment/payos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: orderData.total,
                    description: `Đơn hàng #${Date.now()}`,
                    returnUrl: `${window.location.origin}/success.html`,
                    cancelUrl: `${window.location.origin}/cancel.html`
                })
            });

            const { checkoutUrl } = await response.json();
            if (checkoutUrl) {
                window.location.href = checkoutUrl;
            } else {
                throw new Error('Không thể tạo link thanh toán');
            }
        } catch (error) {
            console.error('PayOS Error:', error);
            this.showNotification('Có lỗi xảy ra khi thanh toán', 'error');
        }
    }

    async processVNPay(orderData) {
        try {
            const response = await fetch('/api/payment/vnpay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: orderData.total,
                    description: `Don hang #${Date.now()}`
                })
            });

            const { paymentUrl } = await response.json();
            if (paymentUrl) {
                window.location.href = paymentUrl;
            }
        } catch (error) {
            console.error('VNPay Error:', error);
            this.showNotification('Có lỗi xảy ra khi thanh toán', 'error');
        }
    }

    async processMoMo(orderData) {
        try {
            const response = await fetch('/api/payment/momo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: orderData.total,
                    orderId: Date.now()
                })
            });

            const { payUrl } = await response.json();
            if (payUrl) {
                window.location.href = payUrl;
            }
        } catch (error) {
            console.error('MoMo Error:', error);
            this.showNotification('Có lỗi xảy ra khi thanh toán', 'error');
        }
    }

    getTotal() {
        return this.cart.reduce((total, item) => {
            return total + (this.menuItems[item.id]?.price || 0) * item.quantity;
        }, 0);
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
