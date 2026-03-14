/**
 * Order System Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Order System', () => {
    let indexHtml;
    let checkoutHtml;
    let scriptJs;
    let checkoutJs;

    beforeAll(() => {
        indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
        checkoutHtml = fs.readFileSync(path.join(rootDir, 'checkout.html'), 'utf8');
        scriptJs = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
        checkoutJs = fs.readFileSync(path.join(rootDir, 'checkout.js'), 'utf8');
    });

    describe('Order Modal', () => {
        test('should have order modal structure', () => {
            expect(indexHtml).toContain('id="orderModal"');
            expect(indexHtml).toContain('order-modal-content');
            expect(indexHtml).toContain('order-modal-overlay');
        });

        test('should have order tabs (menu/cart)', () => {
            expect(indexHtml).toContain('data-tab="menu"');
            expect(indexHtml).toContain('data-tab="cart"');
            expect(indexHtml).toContain('id="cartCount"');
        });

        test('should have order categories', () => {
            expect(indexHtml).toContain('data-cat="coffee"');
            expect(indexHtml).toContain('data-cat="signature"');
            expect(indexHtml).toContain('data-cat="snacks"');
        });

        test('should have cart summary', () => {
            expect(indexHtml).toContain('id="cartSubtotal"');
            expect(indexHtml).toContain('id="cartDelivery"');
            expect(indexHtml).toContain('id="cartTotal"');
        });

        test('should have checkout button', () => {
            expect(indexHtml).toContain('id="btnCheckout"');
        });
    });

    describe('Order JavaScript Functions', () => {
        test('should have MENU_ITEMS defined', () => {
            expect(scriptJs).toContain('MENU_ITEMS');
            expect(scriptJs).toContain('coffee:');
            expect(scriptJs).toContain('signature:');
            expect(scriptJs).toContain('snacks:');
        });

        test('should have initOrderSystem function', () => {
            expect(scriptJs).toContain('function initOrderSystem');
            expect(scriptJs).toContain('renderMenuItems');
        });

        test('should have cart management functions', () => {
            expect(scriptJs).toContain('function addToCart');
            expect(scriptJs).toContain('function removeFromCart');
            expect(scriptJs).toContain('function updateCartQty');
            expect(scriptJs).toContain('function updateCartDisplay');
        });

        test('should have formatPrice function', () => {
            expect(scriptJs).toContain('function formatPrice');
            expect(scriptJs).toContain('Intl.NumberFormat');
            expect(scriptJs).toContain('vi-VN');
        });

        test('should have initOrderModal function', () => {
            expect(scriptJs).toContain('function initOrderModal');
        });
    });

    describe('Checkout Page', () => {
        test('should have checkout form', () => {
            expect(checkoutHtml).toContain('id="checkoutForm"');
            expect(checkoutHtml).toContain('customerName');
            expect(checkoutHtml).toContain('customerPhone');
            expect(checkoutHtml).toContain('customerEmail');
            expect(checkoutHtml).toContain('deliveryAddress');
        });

        test('should have ward selection', () => {
            expect(checkoutHtml).toContain('id="ward"');
            expect(checkoutHtml).toContain('Phường 1');
            expect(checkoutHtml).toContain('Phường 2');
            expect(checkoutHtml).toContain('Hòa Thuận');
        });

        test('should have delivery time options', () => {
            expect(checkoutHtml).toContain('name="deliveryTime"');
            expect(checkoutHtml).toContain('value="now"');
            expect(checkoutHtml).toContain('value="scheduled"');
            expect(checkoutHtml).toContain('id="scheduledTime"');
        });

        test('should have payment methods', () => {
            expect(checkoutHtml).toContain('name="paymentMethod"');
            expect(checkoutHtml).toContain('value="cod"');
            expect(checkoutHtml).toContain('value="momo"');
            expect(checkoutHtml).toContain('value="payos"');
            expect(checkoutHtml).toContain('value="vnpay"');
        });

        test('should have order summary section', () => {
            expect(checkoutHtml).toContain('id="orderSummary"');
            expect(checkoutHtml).toContain('id="summarySubtotal"');
            expect(checkoutHtml).toContain('id="summaryDelivery"');
            expect(checkoutHtml).toContain('id="summaryTotal"');
        });

        test('should have discount code input', () => {
            expect(checkoutHtml).toContain('id="discountCode"');
            expect(checkoutHtml).toContain('applyDiscountBtn');
            expect(checkoutHtml).toContain('FIRSTORDER');
        });

        test('should have submit order button', () => {
            expect(checkoutHtml).toContain('id="submitOrderBtn"');
        });

        test('should have success modal', () => {
            expect(checkoutHtml).toContain('id="successModal"');
            expect(checkoutHtml).toContain('modal-success');
            expect(checkoutHtml).toContain('order-details');
        });
    });

    describe('Checkout JavaScript Functions', () => {
        test('should have initCheckout function', () => {
            expect(checkoutJs).toContain('function initCheckout');
        });

        test('should have loadCartToSummary function', () => {
            expect(checkoutJs).toContain('function loadCartToSummary');
            expect(checkoutJs).toContain('localStorage.getItem');
        });

        test('should have updateTotals function', () => {
            expect(checkoutJs).toContain('function updateTotals');
        });

        test('should have calculateDeliveryFee function', () => {
            expect(checkoutJs).toContain('function calculateDeliveryFee');
            expect(checkoutJs).toContain('DELIVERY_FEES');
        });

        test('should have initDiscountCode function', () => {
            expect(checkoutJs).toContain('function initDiscountCode');
            expect(checkoutJs).toContain('validCodes');
            expect(checkoutJs).toContain('FIRSTORDER');
        });

        test('should have payment method handlers', () => {
            expect(checkoutJs).toContain('async function submitOrderCOD');
            expect(checkoutJs).toContain('async function submitOrderMoMo');
            expect(checkoutJs).toContain('async function submitOrderPayOS');
            expect(checkoutJs).toContain('async function submitOrderVNPay');
        });

        test('should have sendOrderToZalo function', () => {
            expect(checkoutJs).toContain('function sendOrderToZalo');
            expect(checkoutJs).toContain('zalo.me');
        });

        test('should have showSuccessModal function', () => {
            expect(checkoutJs).toContain('function showSuccessModal');
        });

        test('should have removeItem function', () => {
            expect(checkoutJs).toContain('function removeItem');
            expect(checkoutJs).toContain('localStorage.setItem');
        });
    });

    describe('Payment Gateway Config', () => {
        test('should have PAYMENT_CONFIG defined', () => {
            expect(checkoutJs).toContain('PAYMENT_CONFIG');
            expect(checkoutJs).toContain('momo');
            expect(checkoutJs).toContain('payos');
            expect(checkoutJs).toContain('vnpay');
        });

        test('should have MoMo endpoint', () => {
            expect(checkoutJs).toContain('momo.vn');
        });

        test('should have PayOS config', () => {
            expect(checkoutJs).toContain('payos');
        });

        test('should have VNPay config', () => {
            expect(checkoutJs).toContain('vnpayment');
        });
    });

    describe('Discount Codes', () => {
        test('should have discount code validation', () => {
            expect(checkoutJs).toContain('FIRSTORDER');
            expect(checkoutJs).toContain('WELCOME10');
            expect(checkoutJs).toContain('SADEC20');
            expect(checkoutJs).toContain('CONTAINER');
        });

        test('should have discount percentage and max discount', () => {
            expect(checkoutJs).toContain('percent: 10');
            expect(checkoutJs).toContain('maxDiscount');
        });
    });

    describe('Order Form Validation', () => {
        test('should have required fields', () => {
            expect(checkoutHtml).toContain('required placeholder="Nguyễn Văn A"');
            expect(checkoutHtml).toContain('required placeholder="0901234567"');
            expect(checkoutHtml).toContain('required placeholder="Số nhà, đường');
        });

        test('should have phone pattern validation', () => {
            expect(checkoutHtml).toContain('pattern="[0-9]{10}"');
        });

        test('should have form submit handler', () => {
            expect(checkoutJs).toContain('initSubmitOrder');
            expect(checkoutJs).toContain('form.checkValidity');
            expect(checkoutJs).toContain('form.reportValidity');
        });
    });

    describe('Cart Persistence', () => {
        test('should use localStorage for cart', () => {
            expect(scriptJs).toContain('localStorage');
            expect(checkoutJs).toContain("localStorage.getItem('cart')");
            expect(checkoutJs).toContain("localStorage.setItem('cart'");
        });

        test('should save last order to localStorage', () => {
            expect(checkoutJs).toContain("localStorage.setItem('lastOrder'");
        });

        test('should have pending order for payment', () => {
            expect(checkoutJs).toContain("localStorage.setItem('pendingOrder'");
        });
    });

    describe('Order Success Flow', () => {
        test('should clear cart after successful order', () => {
            expect(checkoutJs).toContain("localStorage.removeItem('cart')");
        });

        test('should show success modal', () => {
            expect(checkoutJs).toContain('showSuccessModal');
            expect(checkoutJs).toContain('modal.classList.add');
        });

        test('should have order details display', () => {
            expect(checkoutHtml).toContain('id="orderDetails"');
        });

        test('should have links to order more or home', () => {
            expect(checkoutHtml).toContain('menu.html');
            expect(checkoutHtml).toContain('index.html');
        });
    });
});

describe('Order System Integration', () => {
    let scriptJs;
    let checkoutJs;

    beforeAll(() => {
        scriptJs = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
        checkoutJs = fs.readFileSync(path.join(__dirname, '../checkout.js'), 'utf8');
    });

    test('should redirect from index to checkout', () => {
        expect(scriptJs).toContain("window.location.href = 'checkout.html'");
    });

    test('should have checkout redirect to checkout page', () => {
        expect(scriptJs).toContain("window.location.href = 'checkout.html'");
    });

    test('should sync cart between pages', () => {
        expect(scriptJs).toContain("localStorage.setItem('cart'");
        expect(checkoutJs).toContain("localStorage.getItem('cart')");
    });

    test('should have formatPrice in both files', () => {
        expect(scriptJs).toContain('function formatPrice');
        expect(checkoutJs).toContain('function formatPrice');
    });
});

describe('Checkout Styles', () => {
    let checkoutCss;

    beforeAll(() => {
        checkoutCss = fs.readFileSync(path.join(__dirname, '../checkout-styles.css'), 'utf8');
    });

    test('should have checkout section styles', () => {
        expect(checkoutCss).toContain('.checkout-section');
        expect(checkoutCss).toContain('.checkout-header');
    });

    test('should have checkout grid layout', () => {
        expect(checkoutCss).toContain('.checkout-grid');
        expect(checkoutCss).toContain('grid-template-columns');
    });

    test('should have payment card styles', () => {
        expect(checkoutCss).toContain('.payment-card');
        expect(checkoutCss).toContain('.payment-content');
        expect(checkoutCss).toContain('.payment-icon');
    });

    test('should have order summary styles', () => {
        expect(checkoutCss).toContain('.order-summary');
        expect(checkoutCss).toContain('.summary-item');
        expect(checkoutCss).toContain('.summary-totals');
    });

    test('should have success modal styles', () => {
        expect(checkoutCss).toContain('.modal-overlay');
        expect(checkoutCss).toContain('.modal-success');
        expect(checkoutCss).toContain('.success-icon');
    });

    test('should have responsive styles', () => {
        expect(checkoutCss).toContain('@media (max-width: 1024px)');
        expect(checkoutCss).toContain('@media (max-width: 768px)');
        expect(checkoutCss).toContain('@media (max-width: 480px)');
    });
});
