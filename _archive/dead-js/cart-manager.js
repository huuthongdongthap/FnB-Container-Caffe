/**
 * Cart Manager - Quản lý giỏ hàng
 * Lưu trữ: localStorage
 */

const CART_KEY = 'aura_cart';

class CartManager {
  constructor() {
    this.items = this.load();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  save() {
    localStorage.setItem(CART_KEY, JSON.stringify(this.items));
    window.dispatchEvent(new CustomEvent('cartUpdate', { detail: { items: this.items } }));
  }

  add(product, qty = 1) {
    const item = this.items.find(i => i.id === product.id);
    if (item) {
      item.quantity += qty;
    } else {
      this.items.push({ ...product, quantity: qty });
    }
    this.save();
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  }

  setQuantity(id, qty) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.quantity = qty <= 0 ? 1 : qty;
      this.save();
    }
  }

  increase(id, step = 1) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.quantity += step;
      this.save();
    }
  }

  decrease(id, step = 1) {
    const item = this.items.find(i => i.id === id);
    if (item && item.quantity > 1) {
      item.quantity -= step;
      this.save();
    } else if (item) {
      this.remove(id);
    }
  }

  getTotal() {
    return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  getTotalFormatted() {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(this.getTotal());
  }

  getCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  clear() {
    this.items = [];
    this.save();
  }

  getItems() {
    return [...this.items];
  }
}

const cartManager = new CartManager();
window.cartManager = cartManager;
