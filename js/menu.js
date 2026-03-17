// Menu Manager - Tab Navigation, Filter & Search

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

export class MenuManager {
  constructor() {
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.menuItems = new Map(); // Store menu items data
    this.combos = []; // Store combo items for upsell
    this.init();
    this.loadMenuData();
  }

  init() {
    this.bindFilterEvents();
    this.bindSearchEvents();
    this.bindAddToCartEvents();
    this.applyHappyHourBadge();
  }

  // Load menu data from JSON
  async loadMenuData() {
    try {
      const response = await fetch('data/menu-data.json');
      const data = await response.json();

      // Store items for quick lookup
      data.items.forEach(item => {
        this.menuItems.set(item.id, item);
        if (item.category === 'combo') {
          this.combos.push(item);
        }
      });

      console.log('✅ Menu data loaded:', this.menuItems.size, 'items,', this.combos.length, 'combos');
    } catch (error) {
      console.error('❌ Failed to load menu data:', error);
    }
  }

  // Find combos that contain a specific item
  findCombosContaining(itemId) {
    return this.combos.filter(combo => {
      // Check if combo description mentions common item categories
      const desc = combo.description.toLowerCase();
      const item = this.menuItems.get(itemId);
      if (!item) {return false;}

      // Simple matching: check if item category matches combo description
      if (item.category === 'coffee' && desc.includes('cà phê') || desc.includes('cafe')) {return true;}
      if (item.category === 'coffee' && desc.includes('đồ uống')) {return true;}
      if (item.category === 'snacks' && desc.includes('đồ ăn') || desc.includes('ăn nhẹ')) {return true;}
      if (combo.id === 'combo001' || combo.id === 'combo002') {return true;} // General combos

      return false;
    });
  }

  bindFilterEvents() {
    const filterChips = document.querySelectorAll('.m3-filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        this.switchFilter(filter);
      });
    });
  }

  bindSearchEvents() {
    const searchInput = document.getElementById('menuSearch');
    const searchClear = document.getElementById('searchClear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.filterMenuItems();
        searchClear.style.opacity = this.searchQuery ? '1' : '0';
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        this.filterMenuItems();
        searchClear.style.opacity = '0';
      });
    }
  }

  bindAddToCartEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.m3-add-cart-btn');
      if (btn) {
        const product = JSON.parse(btn.dataset.product);
        if (window.cartManager) {
          window.cartManager.add(product);
          this.showAddToast(product);

          // Show combo upsell suggestion
          const combos = this.findCombosContaining(product.id);
          if (combos.length > 0) {
            this.showComboUpsell(product, combos);
          }
        }
      }
    });
  }

  switchFilter(filter) {
    // Update active chip
    document.querySelectorAll('.m3-filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === filter);
    });

    // Show/hide categories
    document.querySelectorAll('.menu-category').forEach(category => {
      if (filter === 'all') {
        category.classList.add('active');
      } else {
        category.classList.toggle('active', category.dataset.category === filter);
      }
    });

    this.currentCategory = filter;
    this.filterMenuItems();
  }

  filterMenuItems() {
    const items = document.querySelectorAll('.m3-menu-card');

    items.forEach(item => {
      const category = item.dataset.category;
      const title = item.querySelector('.m3-card-title')?.textContent.toLowerCase() || '';
      const desc = item.querySelector('.m3-card-desc')?.textContent.toLowerCase() || '';

      const categoryMatch = this.currentCategory === 'all' || category === this.currentCategory;
      const searchMatch = !this.searchQuery ||
                               title.includes(this.searchQuery) ||
                               desc.includes(this.searchQuery);

      item.style.display = categoryMatch && searchMatch ? 'block' : 'none';
    });
  }

  showAddToast(product) {
    const toast = document.createElement('div');
    toast.className = 'm3-toast';

    // Create content safely (XSS prevention)
    const textSpan = document.createElement('span');
    const price = isHappyHour() ? getHappyHourPrice(product.price) : product.price;
    textSpan.textContent = `✓ Đã thêm ${product.name} (${formatPrice(price)})`;
    toast.appendChild(textSpan);

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Show combo upsell modal
  showComboUpsell(addedProduct, combos) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'combo-upsell-overlay';
    overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease-out;
        `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'combo-upsell-modal';
    modal.style.cssText = `
            background: var(--md-sys-color-surface, #fff);
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            animation: slideUp 0.3s ease-out;
        `;

    const savings = combos.reduce((sum, combo) => {
      const original = combo.originalPrice || combo.price + 30000;
      return sum + (original - combo.price);
    }, 0);

    modal.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 48px;">🎯</span>
                <h3 style="font-size: 20px; font-weight: 600; margin: 12px 0 8px;">Tiết kiệm hơn với Combo!</h3>
                <p style="color: var(--md-sys-color-on-surface-variant, #666); font-size: 14px;">
                    Bạn đã thêm <strong>${escapeHtml(addedProduct.name)}</strong>.
                    Thêm combo để tiết kiệm <strong style="color: var(--md-sys-color-primary, #1B5E3B);">${formatPrice(savings)}</strong>!
                </p>
            </div>
            <div id="combo-list" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;"></div>
            <button id="combo-close-btn" style="
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                background: var(--md-sys-color-outline, #e0e0e0);
                color: var(--md-sys-color-on-surface, #333);
                font-weight: 500;
                cursor: pointer;
            ">Để suy nghĩ thêm</button>
        `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Render combo items
    const comboList = modal.querySelector('#combo-list');
    combos.forEach(combo => {
      const comboCard = document.createElement('div');
      comboCard.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
            `;
      comboCard.onmouseover = function() { comboCard.style.transform = 'translateY(-2px)'; };
      comboCard.onmouseout = function() { comboCard.style.transform = 'translateY(0)'; };

      const savings = combo.originalPrice ? combo.originalPrice - combo.price : 20000;

      comboCard.innerHTML = `
                <span style="font-size: 32px;">${combo.badge ? '🏷️' : '🎯'}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 15px;">${escapeHtml(combo.name)}</div>
                    <div style="font-size: 13px; color: #666;">${escapeHtml(combo.description)}</div>
                    <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                        <span style="color: var(--md-sys-color-primary, #1B5E3B); font-weight: 600;">${formatPrice(combo.price)}</span>
                        ${combo.originalPrice ? `<span style="text-decoration: line-through; color: #999; font-size: 13px;">${formatPrice(combo.originalPrice)}</span>` : ''}
                        <span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">-${formatPrice(savings)}</span>
                    </div>
                </div>
            `;

      comboCard.onclick = () => {
        // Add combo to cart
        if (window.cartManager) {
          window.cartManager.add({
            id: combo.id,
            name: combo.name,
            price: combo.price,
            isCombo: true
          });
        }
        overlay.remove();
        this.showComboAddedToast(combo);
      };

      comboList.appendChild(comboCard);
    });

    // Close button handler
    modal.querySelector('#combo-close-btn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) {overlay.remove();} };
  }

  showComboAddedToast(combo) {
    const toast = document.createElement('div');
    toast.className = 'm3-toast m3-toast-success';
    toast.innerHTML = `
            <span>✅ Đã thêm combo <strong>${escapeHtml(combo.name)}</strong> - Tiết kiệm ${formatPrice(combo.originalPrice - combo.price)}</span>
        `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Apply Happy Hour badge to all menu items
  applyHappyHourBadge() {
    if (!isHappyHour()) {return;}

    const menuCards = document.querySelectorAll('.m3-menu-card');
    menuCards.forEach(card => {
      // Skip combo items (they already have badges)
      const category = card.dataset.category;
      if (category === 'combo') {return;}

      // Check if badge already exists
      if (card.querySelector('.happy-hour-badge')) {return;}

      // Create badge
      const badge = document.createElement('div');
      badge.className = 'happy-hour-badge';
      badge.style.cssText = `
                position: absolute;
                top: 12px;
                right: 12px;
                background: linear-gradient(135deg, #FF9800, #FF5722);
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(255, 87, 34, 0.4);
                animation: pulse 2s infinite;
                z-index: 10;
            `;
      badge.innerHTML = '⏰ HAPPY HOUR -20%';

      // Add pulse animation
      if (!document.getElementById('happy-hour-style')) {
        const style = document.createElement('style');
        style.id = 'happy-hour-style';
        style.textContent = `
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                `;
        document.head.appendChild(style);
      }

      // Add badge to card
      card.style.position = 'relative';
      card.appendChild(badge);

      // Update price display if found
      const priceEl = card.querySelector('.m3-card-price');
      if (priceEl) {
        const originalPrice = parseFloat(priceEl.dataset.price || '0');
        if (originalPrice > 0) {
          const discountedPrice = getHappyHourPrice(originalPrice);
          priceEl.innerHTML = `
                        <span style="text-decoration: line-through; color: #999; font-size: 14px; margin-right: 8px;">${formatPrice(originalPrice)}</span>
                        <span style="color: var(--md-sys-color-primary, #1B5E3B); font-weight: 600;">${formatPrice(discountedPrice)}</span>
                    `;
        }
      }
    });

    console.log('🎉 Happy Hour applied:', menuCards.length, 'items updated');
  }
}

// Initialize menu on page load
new MenuManager();
