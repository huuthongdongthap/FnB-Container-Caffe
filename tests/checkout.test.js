/**
 * Checkout & Payment System Tests - AURA CAFE
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Checkout System', () => {
    let checkoutJs;
    let checkoutHtml;

    beforeAll(() => {
        checkoutJs = fs.readFileSync(path.join(rootDir, 'js/checkout.js'), 'utf8')
            + fs.readFileSync(path.join(rootDir, 'js/checkout/cart-summary.js'), 'utf8')
            + fs.readFileSync(path.join(rootDir, 'js/checkout/payment.js'), 'utf8')
            + fs.readFileSync(path.join(rootDir, 'js/checkout/qr-code.js'), 'utf8')
            + fs.readFileSync(path.join(rootDir, 'js/config.js'), 'utf8');
        checkoutHtml = fs.readFileSync(path.join(rootDir, 'checkout.html'), 'utf8');
    });

    describe('Checkout JavaScript', () => {
        test('should have API configuration', () => {
            expect(checkoutJs).toContain('API_BASE');
            expect(checkoutJs).toContain('http://localhost:8000/api');
        });

        test('should have payment gateway config', () => {
            expect(checkoutJs).toContain('PAYMENT_CONFIG');
            expect(checkoutJs).toContain('momo');
            expect(checkoutJs).toContain('vnpay');
            expect(checkoutJs).toContain('payos');
        });

        test('should have cart state management', () => {
            expect(checkoutJs).toContain('cart');
            expect(checkoutJs).toContain('localStorage');
        });

        test('should have delivery fee config', () => {
            expect(checkoutJs).toContain('DELIVERY_CONFIG');
            expect(checkoutJs).toContain('freeThreshold');
        });

        test('should have DOMContentLoaded init', () => {
            expect(checkoutJs).toContain('DOMContentLoaded');
        });

        test('should have payment methods', () => {
            expect(checkoutJs).toContain('handleCODSuccess');
            expect(checkoutJs).toContain('handleMoMoPayment');
            expect(checkoutJs).toContain('handleVNPayPayment');
        });

        test('should have order submission', () => {
            expect(checkoutJs).toContain('initSubmitOrder');
        });

        test('should have success modal', () => {
            expect(checkoutJs).toContain('showSuccessModal');
        });

        test('should have WebSocket tracking', () => {
            expect(checkoutJs).toContain('WebSocket');
        });

        test('should have discount code functionality', () => {
            expect(checkoutJs).toContain('discount');
            expect(checkoutJs).toContain('initDiscountCode');
        });

        test('should have theme toggle', () => {
            expect(checkoutJs).toContain('initThemeToggle');
        });

        test('should use fetch for API calls', () => {
            expect(checkoutJs).toContain('fetch(');
        });

        test('should have error handling', () => {
            expect(checkoutJs).toContain('catch');
        });
    });

    describe('Checkout HTML', () => {
        test('should have valid HTML5 structure', () => {
            expect(checkoutHtml).toContain('<!DOCTYPE html>');
            expect(checkoutHtml).toContain('<html lang="vi">');
        });

        test('should have proper charset and viewport', () => {
            expect(checkoutHtml).toContain('charset="UTF-8"');
            expect(checkoutHtml).toContain('name="viewport"');
        });

        test('should have checkout form', () => {
            expect(checkoutHtml).toContain('<form');
        });

        test('should have payment method options', () => {
            expect(checkoutHtml).toContain('paymentMethod');
            expect(checkoutHtml).toContain('cod');
            expect(checkoutHtml).toContain('momo');
        });

        test('should link to checkout.js', () => {
            expect(checkoutHtml).toMatch(/src=["'][^"']*checkout[^"']*\.js["']/);
        });

        test('should link to checkout styles', () => {
            expect(checkoutHtml).toMatch(/href=["'][^"']*checkout[^"']*\.css["']/);
        });
    });

    describe('Checkout Performance', () => {
        test('JS file should be under 50KB', () => {
            const sizeKb = Buffer.byteLength(checkoutJs, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(50);
        });

        test('HTML file should be under 100KB', () => {
            const sizeKb = Buffer.byteLength(checkoutHtml, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(100);
        });
    });
});

describe('Checkout Integration', () => {
    let checkoutJs;

    beforeAll(() => {
        checkoutJs = fs.readFileSync(path.join(__dirname, '../js/checkout.js'), 'utf8');
    });

    test('should have Intl.NumberFormat for currency', () => {
        expect(checkoutJs).toContain('Intl.NumberFormat');
    });

    test('should have required field validation', () => {
        expect(checkoutJs).toContain('required');
    });

    test('should have toast notification', () => {
        expect(checkoutJs).toContain('showToast');
    });

    test('should have cart clearing', () => {
        expect(checkoutJs).toContain('clearCart');
    });
});
