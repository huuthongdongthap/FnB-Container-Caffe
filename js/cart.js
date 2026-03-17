// Cart Manager - Shopping Cart Functionality

// XSS prevention utility
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Happy Hour config: 14:00 - 16:00
const HAPPY_HOUR = {
  startHour: 14,
  endHour: 16,
  discountPercent: 20
};

// Check if current time is within Happy Hour
function isHappyHour() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= HAPPY_HOUR.startHour && hour < HAPPY_HOUR.endHour;
}

// Get Happy Hour discount price
function getHappyHourPrice(originalPrice) {
  if (!isHappyHour()) {return originalPrice;}
  return Math.round(originalPrice * (100 - HAPPY_HOUR.discountPercent) / 100);
}

// Format price for display
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export class CartManager {
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
    this.bindEvents();
    this.updateCartDisplay();
  }

  bindEvents() {
    // Add to cart buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.add-to-cart')) {
        const btn = e.target.closest('.add-to-cart');
        const id = btn.dataset.id;
        this.addToCart(id);
      }
    });

    // Quantity buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.quantity-btn')) {
        const btn = e.target.closest('.quantity-btn');
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'increase') {this.updateQuantity(id, 1);}
        if (action === 'decrease') {this.updateQuantity(id, -1);}
      }
    });

    // Checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.checkout());
    }
  }

  addToCart(id) {
    const existingItem = this.cart.find(item => item.id === id);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      this.cart.push({ id, quantity: 1 });
    }
    this.saveCart();
    this.updateCartDisplay();
    this.showNotification('Đã thêm vào giỏ hàng!');
  }

  updateQuantity(id, change) {
    const item = this.cart.find(item => item.id === id);
    if (item) {
      item.quantity += change;
      if (item.quantity <= 0) {
        this.removeFromCart(id);
        return;
      }
      this.saveCart();
      this.updateCartDisplay();
    }
  }

  removeFromCart(id) {
    this.cart = this.cart.filter(item => item.id !== id);
    this.saveCart();
    this.updateCartDisplay();
  }

  saveCart() {
    localStorage.setItem('cart', JSON.stringify(this.cart));
  }

  getTotal() {
    return this.cart.reduce((total, item) => {
      const menuItem = this.menuItems[item.id];
      if (!menuItem) {return total;}

      // Apply Happy Hour discount if applicable
      const price = getHappyHourPrice(menuItem.price);
      return total + (price * item.quantity);
    }, 0);
  }

  getItemCount() {
    return this.cart.reduce((total, item) => total + item.quantity, 0);
  }

  updateCartDisplay() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const totalPriceEl = document.getElementById('total-price');
    const drawerTotalEl = document.getElementById('drawer-total');

    if (cartCountEl) {
      cartCountEl.textContent = this.getItemCount();
    }

    if (totalPriceEl) {
      totalPriceEl.textContent = this.formatPrice(this.getTotal());
    }

    if (drawerTotalEl) {
      drawerTotalEl.textContent = this.formatPrice(this.getTotal());
    }

    if (cartItemsEl) {
      if (this.cart.length === 0) {
        cartItemsEl.innerHTML = `
                    <div class="cart-empty">
                        <span class="material-symbols-outlined">shopping_cart</span>
                        <p>Giỏ hàng trống</p>
                    </div>
                `;
      } else {
        cartItemsEl.innerHTML = this.cart.map(item => {
          const menuItem = this.menuItems[item.id];
          const safeName = escapeHtml(menuItem?.name || 'Unknown');
          const originalPrice = menuItem?.price || 0;
          const currentPrice = getHappyHourPrice(originalPrice);
          const isDiscounted = isHappyHour() && originalPrice > 0;

          return `
                        <div class="cart-item">
                            <div class="cart-item-info">
                                <div class="cart-item-name">${safeName}</div>
                                <div class="cart-item-price">
                                    ${isDiscounted
    ? `<span style="text-decoration: line-through; color: #999; font-size: 12px; margin-right: 6px;">${formatPrice(originalPrice)}</span><span style="color: var(--md-sys-color-primary, #1B5E3B); font-weight: 600;">${formatPrice(currentPrice)}</span>`
    : formatPrice(currentPrice)
}
                                </div>
                            </div>
                            <div class="cart-item-actions">
                                <button class="quantity-btn" data-id="${item.id}" data-action="decrease">
                                    <span class="material-symbols-outlined">remove</span>
                                </button>
                                <span class="quantity-display">${item.quantity}</span>
                                <button class="quantity-btn" data-id="${item.id}" data-action="increase">
                                    <span class="material-symbols-outlined">add</span>
                                </button>
                            </div>
                        </div>
                    `;
        }).join('');
      }
    }

    // Update drawer cart
    const drawerCartItems = document.getElementById('drawer-cart-items');
    if (drawerCartItems) {
      drawerCartItems.innerHTML = cartItemsEl?.innerHTML || '';
    }
  }

  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  showNotification(message) {
    // Simple notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
        `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  checkout() {
    if (this.cart.length === 0) {
      this.showNotification('Giỏ hàng trống!');
      return;
    }
    // Scroll to order form
    document.querySelector('.order-form')?.scrollIntoView({ behavior: 'smooth' });
    this.showNotification('Vui lòng điền thông tin giao hàng');
  }
}

// Initialize cart on page load
new CartManager();
