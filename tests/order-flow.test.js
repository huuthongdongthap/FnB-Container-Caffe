/**
 * Order Flow Tests - Success & Failure Pages
 * AURA CAFE
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Order Flow - Success Page', () => {
    let successHtml;

    beforeAll(() => {
        successHtml = fs.readFileSync(path.join(rootDir, 'success.html'), 'utf8');
    });

    describe('HTML Structure', () => {
        test('should have valid HTML structure', () => {
            expect(successHtml).toContain('<!DOCTYPE html>');
            expect(successHtml).toContain('<html lang="vi">');
            expect(successHtml).toContain('<head>');
            expect(successHtml).toContain('<body>');
        });

        test('should have SEO metadata', () => {
            expect(successHtml).toContain('name="description"');
            expect(successHtml).toContain('Đặt Hàng Thành Công');
        });

        test('should have theme-color meta tag', () => {
            expect(successHtml).toContain('name="theme-color"');
            expect(successHtml).toContain('#4a2c17');
        });

        test('should have PWA manifest link', () => {
            expect(successHtml).toContain('rel="manifest"');
            expect(successHtml).toContain('manifest.json');
        });

        test('should have apple-mobile-web-app meta tags', () => {
            expect(successHtml).toContain('apple-mobile-web-app-capable');
            expect(successHtml).toContain('apple-mobile-web-app-status-bar-style');
            expect(successHtml).toContain('apple-mobile-web-app-title');
        });

        test('should have favicon links', () => {
            expect(successHtml).toContain('favicon.svg');
            expect(successHtml).toContain('favicon-16x16.png');
            expect(successHtml).toContain('favicon-32x32.png');
        });
    });

    describe('Success Card UI', () => {
        test('should have success page container', () => {
            expect(successHtml).toContain('class="success-page"');
        });

        test('should have success card', () => {
            expect(successHtml).toContain('class="success-card"');
        });

        test('should have success icon', () => {
            expect(successHtml).toContain('class="success-icon"');
            expect(successHtml).toContain('✅');
        });

        test('should have success title', () => {
            expect(successHtml).toContain('class="success-title"');
            expect(successHtml).toContain('Đặt Hàng Thành Công');
        });

        test('should have success message', () => {
            expect(successHtml).toContain('class="success-message"');
            expect(successHtml).toContain('Cảm ơn bạn đã đặt hàng');
        });
    });

    describe('Order Information Display', () => {
        test('should have order info section', () => {
            expect(successHtml).toContain('class="order-info"');
            expect(successHtml).toContain('id="orderInfo"');
        });

        test('should have order ID display', () => {
            expect(successHtml).toContain('Mã đơn hàng');
            expect(successHtml).toContain('id="orderId"');
        });

        test('should have order total display', () => {
            expect(successHtml).toContain('Tổng cộng');
            expect(successHtml).toContain('id="orderTotal"');
        });

        test('should have payment method display', () => {
            expect(successHtml).toContain('Phương thức thanh toán');
            expect(successHtml).toContain('id="paymentMethod"');
        });
    });

    describe('Action Buttons', () => {
        test('should have action buttons container', () => {
            expect(successHtml).toContain('class="success-actions"');
        });

        test('should have "Order More" button', () => {
            expect(successHtml).toContain('Đặt Thêm');
            expect(successHtml).toContain('menu.html');
        });

        test('should have "Go Home" button', () => {
            expect(successHtml).toContain('Về Trang Chủ');
            expect(successHtml).toContain('index.html');
        });

        test('should have button styles', () => {
            expect(successHtml).toContain('btn-success');
            expect(successHtml).toContain('btn-primary');
            expect(successHtml).toContain('btn-secondary');
        });
    });

    describe('Next Steps Section', () => {
        test('should have next steps title', () => {
            expect(successHtml).toContain('class="next-steps-title"');
            expect(successHtml).toContain('Các Bước Tiếp Theo');
        });

        test('should have step 1 - confirmation', () => {
            expect(successHtml).toContain('class="step-number"');
            expect(successHtml).toContain('Chúng tôi sẽ gọi/xác nhận đơn qua Zalo');
        });

        test('should have step 2 - preparation', () => {
            expect(successHtml).toContain('Chuẩn bị và đóng gói đồ uống');
        });

        test('should have step 3 - delivery', () => {
            expect(successHtml).toContain('Giao hàng trong 15-20 phút');
            expect(successHtml).toContain('sẵn sàng tại quán');
        });
    });

    describe('JavaScript Functionality', () => {
        test('should have DOMContentLoaded listener', () => {
            expect(successHtml).toContain('DOMContentLoaded');
        });

        test('should load order info from URL params', () => {
            expect(successHtml).toContain('URLSearchParams');
            expect(successHtml).toContain('order_id');
        });

        test('should load from localStorage', () => {
            expect(successHtml).toContain("localStorage.getItem('pendingOrder')");
        });

        test('should clear pending order', () => {
            expect(successHtml).toContain("localStorage.removeItem('pendingOrder')");
        });

        test('should have formatPrice function', () => {
            expect(successHtml).toContain('function formatPrice');
            expect(successHtml).toContain('Intl.NumberFormat');
            expect(successHtml).toContain('vi-VN');
        });

        test('should have translatePaymentMethod function', () => {
            expect(successHtml).toContain('function translatePaymentMethod');
            expect(successHtml).toContain('cod');
            expect(successHtml).toContain('momo');
            expect(successHtml).toContain('payos');
            expect(successHtml).toContain('vnpay');
        });
    });

    describe('CSS Styling', () => {
        test('should have success-page styles', () => {
            expect(successHtml).toContain('.success-page');
            expect(successHtml).toContain('min-height: 100vh');
            expect(successHtml).toContain('display: flex');
        });

        test('should have success-card styles', () => {
            expect(successHtml).toContain('.success-card');
            expect(successHtml).toContain('border-radius: 24px');
            expect(successHtml).toContain('box-shadow');
        });

        test('should have success-icon styles', () => {
            expect(successHtml).toContain('.success-icon');
            expect(successHtml).toContain('width: 100px');
            expect(successHtml).toContain('height: 100px');
            expect(successHtml).toContain('border-radius: 50%');
        });

        test('should have animation keyframes', () => {
            expect(successHtml).toContain('@keyframes slideUp');
            expect(successHtml).toContain('@keyframes scaleIn');
        });

        test('should have responsive styles', () => {
            expect(successHtml).toContain('@media (max-width: 480px)');
        });
    });

    describe('Accessibility', () => {
        test('should have lang attribute', () => {
            expect(successHtml).toContain('lang="vi"');
        });

        test('should have viewport meta tag', () => {
            expect(successHtml).toContain('name="viewport"');
            expect(successHtml).toContain('width=device-width');
        });

        test('should have charset', () => {
            expect(successHtml).toContain('charset="UTF-8"');
        });
    });
});

describe('Order Flow - Failure Page', () => {
    let failureHtml;

    beforeAll(() => {
        failureHtml = fs.readFileSync(path.join(rootDir, 'failure.html'), 'utf8');
    });

    describe('HTML Structure', () => {
        test('should have valid HTML structure', () => {
            expect(failureHtml).toContain('<!DOCTYPE html>');
            expect(failureHtml).toContain('<html lang="vi">');
            expect(failureHtml).toContain('<head>');
            expect(failureHtml).toContain('<body>');
        });

        test('should have SEO metadata', () => {
            expect(failureHtml).toContain('name="description"');
        });

        test('should have theme-color meta tag', () => {
            expect(failureHtml).toContain('name="theme-color"');
        });

        test('should have PWA support', () => {
            expect(failureHtml).toContain('rel="manifest"');
            expect(failureHtml).toContain('apple-mobile-web-app-capable');
        });
    });

    describe('Failure Card UI', () => {
        test('should have failure page container', () => {
            expect(failureHtml).toContain('class="failure-page"');
        });

        test('should have failure card', () => {
            expect(failureHtml).toContain('class="failure-card"');
        });

        test('should have failure icon', () => {
            expect(failureHtml).toContain('class="failure-icon"');
        });

        test('should have failure title', () => {
            expect(failureHtml).toContain('class="failure-title"');
        });

        test('should have failure message', () => {
            expect(failureHtml).toContain('class="failure-message"');
        });
    });

    describe('Action Buttons', () => {
        test('should have retry payment functionality', () => {
            expect(failureHtml).toContain('function retryPayment');
        });

        test('should have back to home button', () => {
            expect(failureHtml).toContain('index.html');
        });
    });

    describe('JavaScript Functionality', () => {
        test('should have order ID handling', () => {
            expect(failureHtml).toContain('order_id') ||
                   expect(failureHtml).toContain('orderId');
        });

        test('should have localStorage handling', () => {
            expect(failureHtml).toContain('localStorage');
        });
    });
});
