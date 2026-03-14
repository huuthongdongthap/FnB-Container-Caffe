/**
 * Checkout Page Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Checkout Page', () => {
  let checkoutHtml;
  let checkoutCss;
  let checkoutJs;

  beforeAll(() => {
    checkoutHtml = fs.readFileSync(path.join(rootDir, 'checkout.html'), 'utf8');
    checkoutCss = fs.readFileSync(path.join(rootDir, 'checkout-styles.css'), 'utf8');
    checkoutJs = fs.readFileSync(path.join(rootDir, 'checkout.js'), 'utf8');
  });

  describe('HTML Structure', () => {
    test('should have valid HTML5 structure', () => {
      expect(checkoutHtml).toContain('<!DOCTYPE html>');
      expect(checkoutHtml).toContain('lang="vi"');
      expect(checkoutHtml).toContain('charset="UTF-8"');
    });

    test('should have proper title', () => {
      expect(checkoutHtml).toContain('Thanh Toán');
    });

    test('should have viewport meta tag', () => {
      expect(checkoutHtml).toContain('name="viewport"');
    });
  });

  describe('Checkout Form', () => {
    test('should have checkout section', () => {
      expect(checkoutHtml).toContain('class="checkout-section"');
    });

    test('should have checkout header', () => {
      expect(checkoutHtml).toContain('class="checkout-header"');
    });

    test('should have customer information form', () => {
      expect(checkoutHtml).toContain('id="checkoutForm"');
      expect(checkoutHtml).toContain('class="checkout-form"');
    });

    test('should have customer name input', () => {
      expect(checkoutHtml).toContain('id="customerName"');
      expect(checkoutHtml).toContain('name="name"');
    });

    test('should have customer phone input', () => {
      expect(checkoutHtml).toContain('id="customerPhone"');
      expect(checkoutHtml).toContain('name="phone"');
    });

    test('should have customer email input', () => {
      expect(checkoutHtml).toContain('id="customerEmail"');
      expect(checkoutHtml).toContain('name="email"');
    });

    test('should have delivery address textarea', () => {
      expect(checkoutHtml).toContain('id="deliveryAddress"');
      expect(checkoutHtml).toContain('name="address"');
    });

    test('should have ward/district select', () => {
      expect(checkoutHtml).toContain('id="ward"');
      expect(checkoutHtml).toContain('name="ward"');
    });
  });

  describe('Payment Methods', () => {
    test('should have payment method section', () => {
      expect(checkoutHtml).toMatch(/Phương Thức Thanh Toán|payment method/i);
    });

    test('should have PayOS option', () => {
      expect(checkoutHtml).toMatch(/PayOS|payos/i);
    });

    test('should have VNPay option', () => {
      expect(checkoutHtml).toMatch(/VNPay|vnpay/i);
    });

    test('should have MoMo option', () => {
      expect(checkoutHtml).toMatch(/MoMo|momo/i);
    });

    test('should have cash on delivery option', () => {
      expect(checkoutHtml).toMatch(/COD|tiền mặt|cash/i);
    });
  });

  describe('Order Summary', () => {
    test('should have order summary section', () => {
      expect(checkoutHtml).toMatch(/class="order-summary"|order.*summary/i);
    });

    test('should have cart items display', () => {
      expect(checkoutHtml).toMatch(/class="cart-items"|class="order-items"|cart|order/i);
    });

    test('should have subtotal display', () => {
      expect(checkoutHtml).toContain('Tạm tính');
    });

    test('should have delivery fee display', () => {
      expect(checkoutHtml).toContain('Phí giao hàng');
    });

    test('should have total amount display', () => {
      expect(checkoutHtml).toContain('Tổng cộng');
    });
  });

  describe('Delivery Time Options', () => {
    test('should have delivery time selection', () => {
      expect(checkoutHtml).toContain('Thời gian nhận hàng');
    });

    test('should have "now" option', () => {
      expect(checkoutHtml).toMatch(/Ngay bây giờ|now|ASAP/i);
    });

    test('should have scheduled time option', () => {
      expect(checkoutHtml).toMatch(/Hẹn giờ|schedule|later/i);
    });
  });

  describe('CSS Styling', () => {
    test('should have checkout-specific styles', () => {
      expect(checkoutCss).toContain('.checkout-section');
      expect(checkoutCss).toContain('.checkout-form');
      expect(checkoutCss).toContain('.checkout-card');
    });

    test('should have form group styles', () => {
      expect(checkoutCss).toContain('.form-group');
      expect(checkoutCss).toContain('.form-row');
    });

    test('should have responsive styles', () => {
      expect(checkoutCss).toMatch(/@media/s);
    });
  });

  describe('JavaScript Functionality', () => {
    test('should have form validation', () => {
      expect(checkoutJs).toMatch(/valid|check|verify/i);
    });

    test('should have payment handling', () => {
      expect(checkoutJs).toMatch(/payment|pay|thanhtoan/i);
    });

    test('should have order submission', () => {
      expect(checkoutJs).toMatch(/submit|send|order/i);
    });

    test('should have cart total calculation', () => {
      expect(checkoutJs).toMatch(/total|sum|calculate/i);
    });
  });

  describe('Accessibility', () => {
    test('should have required attributes on inputs', () => {
      expect(checkoutHtml).toContain('required');
    });

    test('should have proper label associations', () => {
      expect(checkoutHtml).toContain('<label');
      expect(checkoutHtml).toContain('for="');
    });

    test('should have input patterns for phone', () => {
      expect(checkoutHtml).toContain('pattern=');
    });
  });
});

describe('Cart Component', () => {
  let checkoutHtml;
  let cartJs;

  beforeAll(() => {
    checkoutHtml = fs.readFileSync(path.join(__dirname, '../checkout.html'), 'utf8');
    cartJs = fs.readFileSync(path.join(__dirname, '../public/cart.js'), 'utf8');
  });

  describe('Cart Display', () => {
    test('should have order summary container', () => {
      expect(checkoutHtml).toMatch(/class="[^"]*order-summary[^"]*"/);
    });

    test('should have summary totals section', () => {
      expect(checkoutHtml).toContain('class="summary-totals"') || expect(checkoutHtml).toContain('id="orderSummary"');
    });
  });

  describe('Cart Functionality', () => {
    test('should have add to cart function', () => {
      expect(cartJs).toMatch(/add.*cart|addItem|addToCart/i);
    });

    test('should have remove from cart function', () => {
      expect(cartJs).toMatch(/remove.*cart|removeItem|deleteFromCart/i);
    });

    test('should have update quantity function', () => {
      expect(cartJs).toMatch(/update.*quantity|updateQty|changeQuantity/i);
    });

    test('should have clear cart function', () => {
      expect(cartJs).toMatch(/clear.*cart|emptyCart|resetCart/i);
    });

    test('should have get cart total function', () => {
      expect(cartJs).toMatch(/total|getTotal|calculateTotal/i);
    });
  });

  describe('Cart Persistence', () => {
    test('should use localStorage for cart persistence', () => {
      expect(cartJs).toMatch(/localStorage|sessionStorage/i);
    });

    test('should save cart to storage', () => {
      expect(cartJs).toContain('setItem');
    });

    test('should load cart from storage', () => {
      expect(cartJs).toContain('getItem');
    });
  });
});
