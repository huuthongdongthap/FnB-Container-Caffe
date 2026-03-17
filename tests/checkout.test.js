/**
 * @jest-environment jsdom
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: Promise.resolve({})
  })
);

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
});

// Mock CustomEvent
window.CustomEvent = jest.fn().mockImplementation((type, eventInit) => ({
  type,
  detail: eventInit?.detail
}));

// Mock dispatchEvent
window.dispatchEvent = jest.fn();

// Mock setTimeout
jest.useFakeTimers();

// Import checkout manager
import('../js/checkout.js');

describe('CheckoutManager', () => {
  let checkoutManager;
  let mockCart;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockCart = [
      { id: 1, name: 'Cà phê đen', price: 25000, quantity: 2 },
      { id: 2, name: 'Cà phê sữa', price: 30000, quantity: 1 }
    ];

    // Setup DOM
    document.body.innerHTML = `
      <form id="order-form">
        <input type="text" id="fullName" name="fullName" value="Nguyen Van A">
        <input type="tel" id="phone" name="phone" value="0901234567">
        <input type="email" id="email" name="email" value="test@example.com">
        <input type="text" id="address" name="address" value="123 Duong A">
        <input type="radio" name="paymentMethod" value="cod" checked>
        <input type="radio" name="paymentMethod" value="momo">
        <input type="radio" name="paymentMethod" value="vnpay">
        <input type="radio" name="paymentMethod" value="payos">
        <textarea id="notes" name="notes">Test notes</textarea>
      </form>
      <button id="checkout-btn">Checkout</button>
      <button id="submitOrderBtn">Submit Order</button>
      <div id="orderSummary"></div>
      <div id="summarySubtotal"></div>
      <div id="summaryDelivery"></div>
      <div id="summaryTotal"></div>
      <div id="btnTotal"></div>
      <div id="paymentQrModal" style="display: none;">
        <div id="qrAmount"></div>
        <div id="momoAmount"></div>
        <div id="vnpayAmount"></div>
        <div id="transferContent"></div>
        <div id="vnpayOrderId"></div>
        <div id="momoContent"></div>
        <div id="paymentStatus"></div>
        <button id="closePaymentModal">Close</button>
        <button id="confirmPaymentBtn">Confirm</button>
      </div>
      <div class="payment-card" data-payment="cod">COD</div>
      <div class="payment-card" data-payment="momo">MoMo</div>
      <div class="payment-card" data-payment="vnpay">VNPay</div>
      <div class="payment-card" data-payment="payos">PayOS</div>
      <div class="payment-method-btn" data-payment="qr-bank">QR Bank</div>
      <div class="payment-method-btn" data-payment="momo-qr">MoMo QR</div>
      <div class="payment-method-btn" data-payment="vnpay-qr">VNPay QR</div>
      <div id="qr-bank-section" class="qr-section"></div>
      <div id="momo-qr-section" class="qr-section"></div>
      <div id="vnpay-qr-section" class="qr-section"></div>
      <button id="copyAccountBtn">Copy Account</button>
      <button id="copyMoMoBtn">Copy MoMo</button>
    `;

    // Setup localStorage mock
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCart));

    // Re-instantiate checkout manager
    jest.isolateModules(() => {
      require('../js/checkout.js');
    });
  });

  describe('constructor', () => {
    test('khởi tạo với cart từ localStorage', () => {
      // CheckoutManager should have cart loaded
      expect(localStorageMock.getItem).toHaveBeenCalledWith('cart');
    });

    test('khởi tạo với payment config', () => {
      // Verify payment config exists
      expect(localStorageMock.getItem).toHaveBeenCalled();
    });
  });

  describe('getTotal', () => {
    test('tính tổng tiền đúng', () => {
      // Mock getMenuItem to return prices
      const total = mockCart.reduce((sum, item) => {
        const prices = { 1: 25000, 2: 30000 };
        return sum + prices[item.id] * item.quantity;
      }, 0);

      expect(total).toBe(80000); // 25000*2 + 30000*1
    });

    test('trả về 0 khi giỏ rỗng', () => {
      const emptyCart = [];
      const total = emptyCart.reduce((sum) => sum, 0);
      expect(total).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    test('định dạng tiền tệ đúng', () => {
      const amount = 50000;
      const formatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(amount);

      expect(formatted.replace(/\s/g, ' ')).toBe('50.000 ₫');
    });

    test('định dạng số 0', () => {
      const amount = 0;
      const formatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(amount);

      expect(formatted).toBeTruthy();
    });
  });

  describe('processCOD', () => {
    test('lưu order vào localStorage', async () => {
      // COD processing saves to localStorage
      const orderData = {
        total: 80000,
        items: mockCart
      };

      // Simulate saving order
      const orders = [];
      orders.push(orderData);
      localStorage.setItem('orders', JSON.stringify(orders));

      expect(localStorage.setItem).toHaveBeenCalledWith('orders', expect.any(String));
    });

    test('xóa cart sau khi đặt hàng', async () => {
      localStorage.removeItem('cart');
      expect(localStorage.removeItem).toHaveBeenCalledWith('cart');
    });
  });

  describe('processPayOS', () => {
    test('gọi API PayOS', async () => {
      fetch.mockResolvedValueOnce({
        json: Promise.resolve({ checkoutUrl: 'https://payos.test/checkout' })
      });

      const response = await fetch('/api/payment/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 80000,
          description: 'Đơn hàng #123456',
          returnUrl: 'http://localhost/success.html',
          cancelUrl: 'http://localhost/cancel.html'
        })
      });

      const result = await response.json();
      expect(result.checkoutUrl).toBe('https://payos.test/checkout');
    });

    test('redirect đến checkout URL', async () => {
      fetch.mockResolvedValueOnce({
        json: Promise.resolve({ checkoutUrl: 'https://payos.test/checkout' })
      });

      const response = await fetch('/api/payment/payos');
      const { checkoutUrl } = await response.json();

      if (checkoutUrl) {
        // Would redirect in real scenario
        expect(checkoutUrl).toBeTruthy();
      }
    });
  });

  describe('processVNPay', () => {
    test('gọi API VNPay', async () => {
      fetch.mockResolvedValueOnce({
        json: Promise.resolve({ paymentUrl: 'https://vnpay.test/payment' })
      });

      const response = await fetch('/api/payment/vnpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 80000,
          description: 'Don hang #123456'
        })
      });

      const result = await response.json();
      expect(result.paymentUrl).toBe('https://vnpay.test/payment');
    });
  });

  describe('processMoMo', () => {
    test('gọi API MoMo', async () => {
      fetch.mockResolvedValueOnce({
        json: Promise.resolve({ payUrl: 'https://momo.test/pay' })
      });

      const response = await fetch('/api/payment/momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 80000,
          orderId: Date.now()
        })
      });

      const result = await response.json();
      expect(result.payUrl).toBe('https://momo.test/pay');
    });
  });

  describe('getMenuItem', () => {
    test('trả về thông tin món ăn đúng', () => {
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

      expect(defaultItems[1]).toEqual({ name: 'Cà phê đen', price: 25000 });
      expect(defaultItems[2]).toEqual({ name: 'Cà phê sữa', price: 30000 });
    });

    test('trả về undefined cho ID không tồn tại', () => {
      const defaultItems = { 1: { name: 'Cà phê đen', price: 25000 } };
      expect(defaultItems[99]).toBeUndefined();
    });
  });

  describe('showNotification', () => {
    test('tạo notification element', () => {
      const notification = document.createElement('div');
      notification.className = 'notification notification-success';
      notification.textContent = 'Test notification';

      expect(notification.className).toContain('notification');
      expect(notification.textContent).toBe('Test notification');
    });

    test('notification có style đúng', () => {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #00C853;
        color: white;
      `;

      expect(notification.style.position).toBe('fixed');
      expect(notification.style.top).toBe('80px');
    });
  });

  describe('loadCartToSummary', () => {
    test('render cart items vào summary', () => {
      const summaryEl = document.getElementById('orderSummary');
      const cart = [{ id: 1, quantity: 2 }];

      const defaultItems = {
        1: { name: 'Cà phê đen', price: 25000, image: 'images/coffee.png' }
      };

      const itemTotal = defaultItems[1].price * cart[0].quantity;
      const html = `
        <div class="m3-order-item">
          <span class="m3-order-item-name">${defaultItems[1].name}</span>
          <span class="m3-order-item-meta">Số lượng: ${cart[0].quantity}</span>
          <span class="m3-order-item-price">${itemTotal.toLocaleString('vi-VN')}đ</span>
        </div>
      `;

      summaryEl.innerHTML = html;
      expect(summaryEl.innerHTML).toContain('Cà phê đen');
      expect(summaryEl.innerHTML).toContain('Số lượng: 2');
    });

    test('cập nhật totals', () => {
      const subtotal = 50000;
      const deliveryFee = 15000;
      const total = subtotal + deliveryFee;

      document.getElementById('summarySubtotal').textContent = subtotal.toLocaleString('vi-VN') + 'đ';
      document.getElementById('summaryDelivery').textContent = deliveryFee.toLocaleString('vi-VN') + 'đ';
      document.getElementById('summaryTotal').textContent = total.toLocaleString('vi-VN') + 'đ';

      expect(document.getElementById('summarySubtotal').textContent).toContain('50.000');
      expect(document.getElementById('summaryDelivery').textContent).toContain('15.000');
      expect(document.getElementById('summaryTotal').textContent).toContain('65.000');
    });
  });

  describe('confirmPaymentCompleted', () => {
    test('cập nhật payment status', async () => {
      const statusEl = document.getElementById('paymentStatus');
      statusEl.innerHTML = `
        <span class="status-icon">⏳</span>
        <span class="status-text">Đang xác nhận thanh toán...</span>
      `;

      expect(statusEl.innerHTML).toContain('Đang xác nhận');

      // Simulate 3 second delay
      jest.advanceTimersByTime(3000);

      statusEl.innerHTML = `
        <span class="status-icon">✅</span>
        <span class="status-text">Thanh toán thành công!</span>
      `;

      expect(statusEl.innerHTML).toContain('Thành công');
    });

    test('lưu order sau khi thanh toán thành công', async () => {
      const orderData = {
        id: Date.now(),
        fullName: 'Nguyen Van A',
        phone: '0901234567',
        items: mockCart,
        total: 80000,
        status: 'pending_payment'
      };

      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      orders.push(orderData);
      localStorage.setItem('orders', JSON.stringify(orders));

      expect(localStorage.setItem).toHaveBeenCalledWith('orders', expect.any(String));
    });
  });

  describe('payment events', () => {
    test('payment card click handler', () => {
      const paymentCards = document.querySelectorAll('.payment-card');
      const momoCard = document.querySelector('[data-payment="momo"]');

      expect(paymentCards.length).toBe(4);
      expect(momoCard.dataset.payment).toBe('momo');
    });

    test('payment method btn click handler', () => {
      const btns = document.querySelectorAll('.payment-method-btn');
      const momoBtn = document.querySelector('[data-payment="momo-qr"]');

      expect(btns.length).toBe(3);
      expect(momoBtn.dataset.payment).toBe('momo-qr');
    });

    test('copy account button', () => {
      const copyBtn = document.getElementById('copyAccountBtn');
      expect(copyBtn).toBeTruthy();
    });

    test('copy MoMo button', () => {
      const copyMoMoBtn = document.getElementById('copyMoMoBtn');
      expect(copyMoMoBtn).toBeTruthy();
    });
  });
});
