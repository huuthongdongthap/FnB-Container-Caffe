/**
 * Cart Module - Quản lý giỏ hàng
 * Production version - No console.logs
 */
class CartManager {
  constructor() {
    this.sessionId = this._getSessionId();
    this.cart = { items: [], total: 0, count: 0 };
    this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8787/api'
      : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';
  }

  _getSessionId() {
    let sessionId = localStorage.getItem('aura_session_id');
    if (!sessionId) {
      // Migration: check old key
      const oldSessionId = localStorage.getItem('fnb_session_id');
      if (oldSessionId) {
        sessionId = oldSessionId;
        localStorage.setItem('aura_session_id', sessionId);
        localStorage.removeItem('fnb_session_id');
      } else {
        sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('aura_session_id', sessionId);
      }
    }
    return sessionId;
  }

  _log(msg, err) {
    // Noop in production
  }

  async _request(endpoint, options = {}) {
    const url = endpoint.includes('?')
      ? `${endpoint}&session_id=${this.sessionId}`
      : `${endpoint}?session_id=${this.sessionId}`;

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, config);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  async getCart() {
    try {
      const stored = localStorage.getItem('aura_cart');
      if (stored) {
        this.cart = JSON.parse(stored);
      } else {
        this.cart = { items: [], total: 0, count: 0 };
      }
      return this.cart;
    } catch (error) {
      this._log('Error getting cart', error);
      this.cart = { items: [], total: 0, count: 0 };
      return this.cart;
    }
  }

  async addToCart(product) {
    try {
      await this.getCart();

      const existingItem = this.cart.items.find(item =>
        item.id === product.id &&
        JSON.stringify(item.options) === JSON.stringify(product.options)
      );

      if (existingItem) {
        existingItem.quantity += (product.quantity || 1);
      } else {
        this.cart.items.push({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: product.quantity || 1,
          image: product.image,
          options: product.options
        });
      }

      this._recalculateCart();
      this._saveCart();
      this._updateCartUI();
      this._showNotification('Đã thêm vào giỏ hàng!');

      return { success: true };
    } catch (error) {
      this._log('Error adding to cart', error);
      return { success: false };
    }
  }

  async updateQuantity(itemId, quantity) {
    try {
      await this.getCart();

      const item = this.cart.items.find(item => item.id === itemId);
      if (item) {
        if (quantity <= 0) {
          return this.removeFromCart(itemId);
        } else {
          item.quantity = quantity;
          this._recalculateCart();
          this._saveCart();
          this._updateCartUI();
        }
      }

      return { success: true };
    } catch (error) {
      this._log('Error updating cart', error);
      return { success: false };
    }
  }

  async removeFromCart(itemId) {
    try {
      await this.getCart();

      this.cart.items = this.cart.items.filter(item => item.id !== itemId);
      this._recalculateCart();
      this._saveCart();
      this._updateCartUI();

      return { success: true };
    } catch (error) {
      this._log('Error removing from cart', error);
      return { success: false };
    }
  }

  async clearCart() {
    try {
      localStorage.removeItem('aura_cart');
      this.cart = { items: [], total: 0, count: 0 };
      this._updateCartUI();

      return { success: true };
    } catch (error) {
      this._log('Error clearing cart', error);
      return { success: false };
    }
  }

  _recalculateCart() {
    this.cart.total = this.cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    this.cart.count = this.cart.items.reduce((count, item) => count + item.quantity, 0);
  }

  _saveCart() {
    localStorage.setItem('aura_cart', JSON.stringify(this.cart));
  }

  _updateCartUI() {
    // Update cart count badge
    const countEl = document.querySelector('.cart-count');
    if (countEl) {
      countEl.textContent = this.cart.count;
      countEl.style.display = this.cart.count > 0 ? 'block' : 'none';
    }

    // Update cart modal if open
    this._renderCartModal();
  }

  _renderCartModal() {
    const cartItemsEl = document.querySelector('.cart-items');
    const cartTotalEl = document.querySelector('.cart-total');
    const cartCountEl = document.querySelector('.cart-item-count');

    if (!cartItemsEl) {return;}

    if (this.cart.items.length === 0) {
      cartItemsEl.innerHTML = `
                <div class="empty-cart">
                    <p>Giỏ hàng trống</p>
                    <button onclick="cartModal.close()" class="btn-primary">Mua ngay</button>
                </div>
            `;
      if (cartTotalEl) {cartTotalEl.textContent = '0 ₫';}
      if (cartCountEl) {cartCountEl.textContent = '0';}
      return;
    }

    const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    cartItemsEl.innerHTML = this.cart.items.map(item => `
            <div class="cart-item" data-id="${esc(item.id)}">
                ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}">` : ''}
                <div class="cart-item-details">
                    <h4>${esc(item.name)}</h4>
                    <p class="price">${esc(this._formatPrice(item.price))}</p>
                    ${item.options ? `<p class="options">${esc(Object.entries(item.options).map(([k,v]) => `${k}: ${v}`).join(', '))}</p>` : ''}
                </div>
                <div class="cart-item-quantity">
                    <button onclick="cartManager.updateQuantity('${esc(item.id)}', ${Number(item.quantity) - 1})">-</button>
                    <span>${Number(item.quantity)}</span>
                    <button onclick="cartManager.updateQuantity('${esc(item.id)}', ${Number(item.quantity) + 1})">+</button>
                </div>
                <button class="cart-item-remove" onclick="cartManager.removeFromCart('${esc(item.id)}')">×</button>
            </div>
        `).join('');

    if (cartTotalEl) {
      cartTotalEl.textContent = this._formatPrice(this.cart.total);
    }
    if (cartCountEl) {
      cartCountEl.textContent = this.cart.count;
    }
  }

  _formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  _showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
}

// Initialize global cart manager
const cartManager = new CartManager();

// Cart Modal Controller
const cartModal = {
  modal: null,

  init() {
    this.modal = document.querySelector('.cart-modal');
    this._bindEvents();
  },

  _bindEvents() {
    // Cart icon click
    document.querySelector('.cart-icon')?.addEventListener('click', () => this.open());

    // Close button
    document.querySelector('.cart-modal-close')?.addEventListener('click', () => this.close());

    // Click outside
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {this.close();}
    });

    // Checkout button
    document.querySelector('.cart-checkout-btn')?.addEventListener('click', () => {
      this.close();
      checkoutModal.open();
    });
  },

  open() {
    cartManager.getCart().then(() => {
      cartManager._renderCartModal();
    });
    this.modal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    this.modal?.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Checkout Modal Controller
const checkoutModal = {
  modal: null,
  formData: {},

  init() {
    this.modal = document.querySelector('.checkout-modal');
    this._bindEvents();
  },

  _bindEvents() {
    document.querySelector('.checkout-modal-close')?.addEventListener('click', () => this.close());

    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {this.close();}
    });

    // Form submit
    document.querySelector('.checkout-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });

    // Payment method selection
    document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.formData.payment_method = e.target.value;
      });
    });
  },

  open() {
    this.modal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    this.modal?.classList.remove('active');
    document.body.style.overflow = '';
  },

  async _submit() {
    const form = document.querySelector('.checkout-form');
    const formData = new FormData(form);

    const customer = {
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address'),
      ward: formData.get('ward'),
      district: formData.get('district'),
      city: formData.get('city'),
      notes: formData.get('notes')
    };

    try {
      const response = await fetch(`${cartManager.apiUrl}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: cartManager.sessionId,
          customer,
          payment_method: this.formData.payment_method || 'cod'
        })
      });

      const result = await response.json();

      if (result.success) {
        if (result.order.payment_method !== 'cod') {
          const paymentUrl = await this._createPaymentUrl(result.order);
          window.location.href = paymentUrl;
        } else {
          this.close();
          successModal.open(result.order);
          cartManager.clearCart();
        }
      }
    } catch (error) {
      cartManager._log('Checkout error', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  },

  async _createPaymentUrl(order) {
    const response = await fetch(
      `${cartManager.apiUrl}/payment/create-url?order_id=${order.id}&payment_method=${order.payment_method}&amount=${order.total}`
    );
    const result = await response.json();
    return result.payment_url;
  }
};

// Success Modal
const successModal = {
  modal: null,

  init() {
    this.modal = document.querySelector('.success-modal');
    this._bindEvents();
  },

  _bindEvents() {
    document.querySelector('.success-modal-close')?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {this.close();}
    });
  },

  open(order) {
    const orderEl = document.querySelector('.success-order-id');
    if (orderEl) {orderEl.textContent = '#' + order.id;}
    this.modal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  close() {
    this.modal?.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  cartModal.init();
  checkoutModal.init();
  successModal.init();

  // Load cart on page load
  cartManager.getCart().then(() => {
    cartManager._updateCartUI();
  });
});
