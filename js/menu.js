// ═══════════════════════════════════════════════
//  AURA CAFE — Menu Page Interactions
// ═══════════════════════════════════════════════

import { ApiService } from './api-client.js';

let MENU_DATA = null;
let CART = [];

// ── Module-wide HTML escape helper (XSS guard for innerHTML) ──
const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Category icon map — 10 groups matching physical menu
const CATEGORY_ICON_MAP = {
  'traditional-coffee': '☕', 'hot-coffee': '🔥', 'frappuccino': '🧊',
  'tea': '🍵', 'smoothies': '🥤', 'juice': '🍊',
  'yogurt': '🥛', 'soda': '🫧', 'other-drinks': '🥤',
  'bottled': '🧴',
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadMenuData();
  initMenuFilter();
  initGalleryLightbox();
  initSmoothScroll();
  initScrollReveal();
  registerServiceWorker();
  initAddToCart();
  initCartPanel();
  updateCartCount();
});

async function loadMenuData() {
  try {
    const [categories, products] = await Promise.all([
      ApiService.getCategories(),
      ApiService.getProducts({ available: 1 }),
    ]);
    MENU_DATA = _transformApiData(categories, products);
    renderCategoriesHeaders();
    renderMenuCategories();
    renderGallery();
  } catch (err) {
    if (typeof window !== 'undefined' && window.AURA_DEBUG) {
      console.warn('[Menu] API unavailable, using static fallback:', err.message);
    }
    MENU_DATA = _getStaticFallbackMenu();
    renderMenuCategories();
  }
}

function _transformApiData(categories, products) {
  return {
    categories: categories.map(c => ({
      id: c.slug || c.id,
      name: c.name,
      description: c.description,
      icon: CATEGORY_ICON_MAP[c.slug || c.id] ?? '🍽️',
    })),
    items: products.map(p => {
      // Use API-provided badge/tags — don't override with hardcoded logic
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description ?? '',
        category: p.category, // API returns 'category' field directly
        image: p.image_url ?? null,
        tags: p.tags ?? [],
        badge: p.badge ?? null,
      };
    }),
    imageMap: {
      'traditional-coffee': 'images/interior.png',
      'hot-coffee':   'images/interior.png',
      'frappuccino':  'images/night-4k.png',
      'tea':          'images/night-4k.png',
      'smoothies':    'images/night-4k.png',
      'juice':        'images/exterior.png',
      'yogurt':       'images/exterior.png',
      'soda':         'images/night-4k.png',
      'other-drinks': 'images/exterior.png',
      'bottled':      'images/exterior.png',
    },
  };
}

function renderCategoriesHeaders() {
  if (!MENU_DATA?.categories) {return;}
  MENU_DATA.categories.forEach(cat => {
    const header = document.querySelector(`.menu-category[data-category="${cat.id}"] .category-header`);
    if (header) {
      header.innerHTML = `
        <span class="category-icon">${_esc(cat.icon)}</span>
        <h2 class="category-title">${_esc(cat.name)}</h2>
        <span class="category-tag">${_esc(cat.description)}</span>
      `;
    }
  });
}

function renderMenuCategories() {
  if (!MENU_DATA?.items?.length) {return;}

  const imageMap = MENU_DATA.imageMap || {};
  const menuGrid = document.getElementById('menuGrid');
  if (!menuGrid) {return;}

  menuGrid.innerHTML = MENU_DATA.items
    .map(item => renderMenuItem(item, item.category, imageMap))
    .join('');
}

function renderMenuItem(item, category, imageMap) {
  let badgeClass = '';
  if (item.badge) {
    if (item.badge.includes('Specialty')) {
      badgeClass = 'badge-specialty';
    } else if (item.badge.includes('Mộc Zone')) {
      badgeClass = 'badge-moc-zone';
    } else if (item.badge.includes('Cay Nồng')) {
      badgeClass = 'badge-cay-nong';
    } else {
      badgeClass = `badge-${item.badge.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    }
  }
  const imageSrc = imageMap[category] || 'images/interior.png';

  // Custom FnB dietary indicator
  let emoji = '☕';
  if (category === 'tea') {
    emoji = '🍵';
  } else if (category === 'signature') {
    emoji = '🍹';
  } else if (category === 'snacks') {
    emoji = '🥐';
  }

  return `
    <div class="card" data-category="${_esc(category)}">
      ${item.badge ? `<span class="card-badge ${badgeClass}">${_esc(item.badge)}</span>` : ''}
      <span class="card-emoji">${emoji}</span>
      <h3 class="card-name">${_esc(item.name)}</h3>
      <p class="card-desc">${_esc(item.description || '')}</p>
      <div class="card-footer">
        <div class="price-container">
          <span class="card-price">${_esc(formatPrice(item.price))}</span>
        </div>
        <button class="card-add btn-add-cart" data-product="${encodeURIComponent(JSON.stringify({id: item.id, name: item.name, price: item.price, image: imageSrc}))}">
          +
        </button>
      </div>
    </div>
  `;
}

function renderGallery() {
  const galleryGrid = document.querySelector('.gallery-grid');
  if (!galleryGrid || !MENU_DATA?.gallery) {return;}
  const galleryItems = MENU_DATA.gallery;
  galleryGrid.innerHTML = galleryItems.map((item, index) => {
    const sizeClass = index === 0 ? 'large' : '';
    return `
      <div class="gallery-item ${sizeClass}">
        <img src="${_esc(item.src)}" alt="${_esc(item.caption)}" loading="lazy">
        <div class="gallery-overlay"><span>${_esc(item.caption)}</span></div>
      </div>
    `;
  }).join('');
}

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function initMenuFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const menuCategories = document.querySelectorAll('.menu-category');
  if (!filterBtns.length || !menuCategories.length) {return;}
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      menuCategories.forEach((category, index) => {
        const categoryFilter = category.dataset.category;
        if (filter === 'all' || categoryFilter === filter) {
          category.style.display = 'block';
          category.style.opacity = '0';
          category.style.transform = 'translateY(20px)';
          setTimeout(() => {
            category.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            category.style.opacity = '1';
            category.style.transform = 'translateY(0)';
          }, index * 50);
        } else {
          category.style.display = 'none';
        }
      });
    });
  });
}

function initGalleryLightbox() {
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (!galleryItems.length) {return;}
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox-overlay';
  lightbox.innerHTML = `
    <button class="lightbox-close">&times;</button>
    <div class="lightbox-content">
      <img src="" alt="" class="lightbox-image">
      <div class="lightbox-caption"></div>
    </div>
  `;
  lightbox.style.cssText = 'position:fixed;inset:0;background:var(--aura-noir-void,rgba(5,13,26,.95));display:none;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(10px);opacity:0;transition:opacity 0.3s ease;';
  document.body.appendChild(lightbox);
  const lightboxImg = lightbox.querySelector('.lightbox-image');
  const lightboxCaption = lightbox.querySelector('.lightbox-caption');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const openLightbox = (imgSrc, caption) => {
    lightbox.style.display = 'flex';
    setTimeout(() => { lightbox.style.opacity = '1'; }, 10);
    lightboxImg.src = imgSrc;
    lightboxImg.alt = caption;
    lightboxCaption.textContent = caption;
    document.body.style.overflow = 'hidden';
  };
  const closeLightbox = () => {
    lightbox.style.opacity = '0';
    setTimeout(() => { lightbox.style.display = 'none'; document.body.style.overflow = ''; }, 300);
  };
  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) {closeLightbox();} });
  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const overlay = item.querySelector('.gallery-overlay span');
      openLightbox(img.src, overlay?.textContent || img.alt || '');
    });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') {closeLightbox();} });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') {return;}
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

function initScrollReveal() {
  const reveals = document.querySelectorAll('.menu-category, .gallery-item');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => { entry.target.classList.add('visible'); }, entry.target.dataset.delay || index * 50);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  reveals.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

if (!document.getElementById('menu-reveal-styles')) {
  const style = document.createElement('style');
  style.id = 'menu-reveal-styles';
  style.textContent = '.menu-category.visible, .gallery-item.visible { opacity: 1 !important; transform: translateY(0) !important; }';
  document.head.appendChild(style);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Check for updates on server periodically
        setInterval(() => reg.update(), 120000); // Check every 2 minutes

        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Automatically activate the new Service Worker immediately
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      }).catch(() => {});

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

function initAddToCart() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-add-cart') || e.target.closest('.btn-add-cart')) {
      const btn = e.target.classList.contains('btn-add-cart') ? e.target : e.target.closest('.btn-add-cart');
      const productData = btn.dataset.product;
      if (productData) {
        try {
          const product = JSON.parse(decodeURIComponent(productData));
          addToCart(product);
          showAddToCartToast(product.name);
        } catch (error) { /* silent */ }
      }
    }
  });
}

function addToCart(product) {
  const existingItem = CART.find(item => item.id === product.id);
  if (existingItem) { existingItem.quantity += 1; }
  else { CART.push({ ...product, quantity: 1 }); }
  updateCartCount();
  saveCartToLocalStorage();
  renderCartPanel();
}

function initCartPanel() {
  const cartBtn = document.getElementById('cartBtn');
  const mobileCartBtn = document.getElementById('mobileCartBtn');
  const cartClose = document.getElementById('cartClose');
  const cartOverlay = document.getElementById('cartOverlay');
  const checkoutBtn = document.querySelector('.cart-checkout');

  const openCart = () => {
    document.getElementById('cartPanel')?.classList.add('open');
    document.getElementById('cartOverlay')?.classList.add('open');
    renderCartPanel();
  };

  const closeCart = () => {
    document.getElementById('cartPanel')?.classList.remove('open');
    document.getElementById('cartOverlay')?.classList.remove('open');
  };

  cartBtn?.addEventListener('click', openCart);
  mobileCartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

  checkoutBtn?.addEventListener('click', () => {
    if (!CART.length) {return;}
    window.location.href = 'checkout.html';
  });
}

function renderCartPanel() {
  const cartItemsEl = document.getElementById('cartItems');
  const cartSummaryEl = document.getElementById('cartSummary');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartFeeEl = document.getElementById('cartFee');
  const cartTotalEl = document.getElementById('cartTotal');

  if (!cartItemsEl || !cartSummaryEl || !cartSubtotalEl || !cartFeeEl || !cartTotalEl) {return;}

  if (!CART.length) {
    cartItemsEl.innerHTML = '<div class="cart-empty">Giỏ hàng trống</div>';
    cartSummaryEl.style.display = 'none';
    return;
  }

  const subtotal = CART.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;

  cartItemsEl.innerHTML = CART.map((item) => `
    <div class="cart-item" data-id="${_esc(item.id)}">
      <div class="cart-item-emoji">☕</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${_esc(item.name)}</div>
        <div class="cart-item-sub">${_esc(formatPrice(item.price))}</div>
      </div>
      <div class="cart-qty">
        <button type="button" data-action="minus">−</button>
        <span>${Number(item.quantity || 0)}</span>
        <button type="button" data-action="plus">+</button>
      </div>
    </div>
  `).join('');

  cartSummaryEl.style.display = 'block';
  cartSubtotalEl.textContent = formatPrice(subtotal);
  cartFeeEl.textContent = formatPrice(fee);
  cartTotalEl.textContent = formatPrice(total);

  cartItemsEl.querySelectorAll('.cart-item').forEach((row) => {
    const id = row.getAttribute('data-id');
    const minusBtn = row.querySelector('button[data-action="minus"]');
    const plusBtn = row.querySelector('button[data-action="plus"]');

    minusBtn?.addEventListener('click', () => adjustCartQty(id, -1));
    plusBtn?.addEventListener('click', () => adjustCartQty(id, +1));
  });
}

function adjustCartQty(id, delta) {
  const idx = CART.findIndex(item => String(item.id) === String(id));
  if (idx < 0) {return;}

  CART[idx].quantity = Number(CART[idx].quantity || 0) + delta;
  if (CART[idx].quantity <= 0) {
    CART.splice(idx, 1);
  }

  updateCartCount();
  saveCartToLocalStorage();
  renderCartPanel();
}

function updateCartCount() {
  const totalItems = CART.reduce((sum, item) => sum + item.quantity, 0);

  const floatBadge = document.getElementById('cartBadge');
  if (floatBadge) {
    floatBadge.textContent = totalItems;
    floatBadge.classList.toggle('show', totalItems > 0);
  }

  const mobileBadge = document.getElementById('mobileCartBadge');
  if (mobileBadge) {
    mobileBadge.textContent = totalItems;
    mobileBadge.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  const cartFloat = document.getElementById('cartFloat');
  if (cartFloat) {
    cartFloat.style.display = totalItems > 0 ? 'block' : 'none';
  }
}

function saveCartToLocalStorage() {
  try {
    const total = CART.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
    const count = CART.reduce((s, i) => s + (i.quantity || 1), 0);
    localStorage.setItem('aura_cart', JSON.stringify({ items: CART, total, count }));
  } catch (error) { /* silent */ }
}

function loadCartFromLocalStorage() {
  try {
    const savedCart = localStorage.getItem('aura_cart');
    if (savedCart) {
      const parsed = JSON.parse(savedCart);
      // Handle both formats: {items:[...]} (new) and [...] (legacy)
      if (Array.isArray(parsed)) {
        CART = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        CART = parsed.items;
      }
      updateCartCount();
    }
  } catch (error) { /* silent */ }
}

function showAddToCartToast(productName) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `<span class="toast-icon">✅</span><span class="toast-message">Đã thêm <strong>${_esc(productName)}</strong> vào giỏ</span>`;
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);background:var(--aura-noir-mid,#1A2A4E);color:var(--aura-chrome-bright,#E8EEF3);padding:16px 24px;border-radius:12px;box-shadow:0 8px 32px var(--aura-noir-void,rgba(5,13,26,.5));display:flex;align-items:center;gap:12px;z-index:9999;transition:transform 0.3s ease;backdrop-filter:blur(10px);border:1px solid var(--aura-border-chrome,rgba(201,214,223,.15));';
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

loadCartFromLocalStorage();

// bfcache safety: when user clicks Back from success.html, browser may restore DOM
// without re-running init. Force re-sync CART from localStorage on pageshow.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Page restored from bfcache — clear in-memory CART if localStorage was cleared
    const stored = localStorage.getItem('aura_cart');
    if (!stored) {
      CART = [];
      updateCartCount();
    } else {
      loadCartFromLocalStorage();
    }
  }
});

function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');
  if (!themeToggle) {return;}
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeIcon, savedTheme);
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(themeIcon, newTheme);
  });
}

function updateThemeIcon(icon, theme) {
  if (icon) { icon.textContent = theme === 'dark' ? '🌙' : '☀️'; }
}

initThemeToggle();

// ── Static fallback — EXACT data from physical VIVA menu (10 groups, 49 items) ──
function _getStaticFallbackMenu() {
  return {
    categories: [
      { id: 'traditional-coffee', name: '☕ Cà phê truyền thống', description: 'Cà phê phin & máy truyền thống', icon: '☕' },
      { id: 'hot-coffee', name: '🔥 Cà phê nóng', description: 'Cà phê kiểu Ý & Mỹ nóng', icon: '🔥' },
      { id: 'frappuccino', name: '🧊 Đá xay (Frappuccino)', description: 'Đá xay mát lạnh', icon: '🧊' },
      { id: 'smoothies', name: '🥤 Sinh tố (Smoothies)', description: 'Sinh tố trái cây tươi', icon: '🥤' },
      { id: 'soda', name: '🫧 Soda kiểu Ý', description: 'Soda tươi pha chế', icon: '🫧' },
      { id: 'tea', name: '🍵 Trà (Tea)', description: 'Trà & thảo mộc', icon: '🍵' },
      { id: 'other-drinks', name: '🥤 Thức uống khác', description: 'Trà, sữa, giải khát', icon: '🥤' },
      { id: 'yogurt', name: '🥛 Yaourt', description: 'Yaourt các loại', icon: '🥛' },
      { id: 'juice', name: '🍊 Nước ép', description: 'Nước ép tươi', icon: '🍊' },
      { id: 'bottled', name: '🧴 Giải khát đóng chai', description: 'Nước đóng chai', icon: '🧴' },
    ],
    items: [
      // ☕ Cà phê truyền thống (7)
      { id: 'tc001', name: 'Cà phê máy/ phin (Iced/Hot Coffee)', price: 20000, category: 'traditional-coffee', badge: null, tags: ['Iced/Hot'] },
      { id: 'tc002', name: 'Cà phê sữa máy/ phin (Iced/Hot Milk Coffee)', price: 25000, category: 'traditional-coffee', badge: 'Best Seller', tags: ['Iced/Hot'] },
      { id: 'tc003', name: 'Cà phê/ Matcha muối (Salted Coffee)', price: 28000, category: 'traditional-coffee', badge: null, tags: ['Iced/Hot'] },
      { id: 'tc004', name: 'Bạc xỉu đá/ nóng (Iced/Hot White Coffee)', price: 28000, category: 'traditional-coffee', badge: null, tags: ['Iced/Hot'] },
      { id: 'tc005', name: 'Ca cao đá/ nóng', price: 20000, category: 'traditional-coffee', badge: null, tags: ['Iced/Hot'] },
      { id: 'tc006', name: 'Ca cao sữa đá/ nóng', price: 30000, category: 'traditional-coffee', badge: null, tags: ['Iced/Hot'] },
      { id: 'tc007', name: 'Matcha latte đá', price: 25000, category: 'traditional-coffee', badge: null, tags: ['Iced'] },
      // 🔥 Cà phê nóng (6)
      { id: 'hc001', name: 'Cà phê kiểu Ý (Espresso)', price: 20000, category: 'hot-coffee', badge: null, tags: ['Hot'] },
      { id: 'hc002', name: 'Cà phê kiểu Mỹ (Americano)', price: 25000, category: 'hot-coffee', badge: null, tags: ['Hot'] },
      { id: 'hc003', name: 'Cà phê bọt sữa (Cappuccino)', price: 35000, category: 'hot-coffee', badge: null, tags: ['Hot'] },
      { id: 'hc004', name: 'Cà phê và Socola (Mocha)', price: 35000, category: 'hot-coffee', badge: null, tags: ['Hot'] },
      { id: 'hc005', name: 'Cà phê sữa nóng kiểu Ý (Latte)', price: 35000, category: 'hot-coffee', badge: null, tags: ['Hot'] },
      { id: 'hc006', name: 'Trà xanh sữa nóng (Greentea Latte)', price: 35000, category: 'hot-coffee', badge: null, tags: ['Hot'] },
      // 🧊 Đá xay / Frappuccino (6)
      { id: 'fp001', name: 'Cà phê đá xay (Coffee Frappu)', price: 35000, category: 'frappuccino', badge: null, tags: ['Blended'] },
      { id: 'fp002', name: 'Cà phê bánh xay (Cookie Frappu)', price: 35000, category: 'frappuccino', badge: null, tags: ['Blended'] },
      { id: 'fp003', name: 'Cà phê Socola đá xay (Mocha Frappu)', price: 35000, category: 'frappuccino', badge: null, tags: ['Blended'] },
      { id: 'fp004', name: 'Cà phê Dừa Việt quốc (Coconut Blueberry Coffee Ice)', price: 35000, category: 'frappuccino', badge: null, tags: ['Blended'] },
      { id: 'fp005', name: 'Sữa chua Việt quốc bánh xay (Blueberry Yogurt Frappu)', price: 35000, category: 'frappuccino', badge: null, tags: ['Blended'] },
      { id: 'fp006', name: 'Trà xanh đá xay (Matcha)', price: 35000, category: 'frappuccino', badge: null, tags: ['Blended'] },
      // 🥤 Sinh tố / Smoothies (4)
      { id: 'sm001', name: 'Sinh tố Dâu (Strawberry)', price: 35000, category: 'smoothies', badge: null, tags: ['Blended'] },
      { id: 'sm002', name: 'Sinh tố Bơ (Avocado)', price: 35000, category: 'smoothies', badge: null, tags: ['Blended'] },
      { id: 'sm003', name: 'Sinh tố Mãng cầu (Soursop)', price: 35000, category: 'smoothies', badge: null, tags: ['Blended'] },
      { id: 'sm004', name: 'Sinh tố Sapo (Sapodilla)', price: 35000, category: 'smoothies', badge: null, tags: ['Blended'] },
      // 🫧 Soda kiểu Ý (2)
      { id: 'sd001', name: 'Sapphire (Blue Curacao)', price: 25000, category: 'soda', badge: null, tags: ['Iced'] },
      { id: 'sd002', name: 'Emerald (Bạc Hà)', price: 25000, category: 'soda', badge: null, tags: ['Iced'] },
      // 🍵 Trà / Tea (6)
      { id: 'te001', name: 'Lipton chanh đá/nóng', price: 18000, category: 'tea', badge: null, tags: ['Iced/Hot'] },
      { id: 'te002', name: 'Lipton sữa đá/ nóng', price: 25000, category: 'tea', badge: null, tags: ['Iced/Hot'] },
      { id: 'te003', name: 'Lipton cam đá/ nóng', price: 25000, category: 'tea', badge: null, tags: ['Iced/Hot'] },
      { id: 'te004', name: 'Trà cúc thảo mộc đá/ nóng', price: 29000, category: 'tea', badge: null, tags: ['Iced/Hot'] },
      { id: 'te005', name: 'Trà mãng cầu', price: 29000, category: 'tea', badge: null, tags: ['Iced/Hot'] },
      { id: 'te006', name: 'Trà đào', price: 30000, category: 'tea', badge: 'Popular', tags: ['Iced/Hot'] },
      // 🥤 Thức uống khác (5)
      { id: 'od001', name: 'Trà đường', price: 18000, category: 'other-drinks', badge: null, tags: ['Iced'] },
      { id: 'od002', name: 'Bình trà bắc', price: 15000, category: 'other-drinks', badge: null, tags: ['Hot'] },
      { id: 'od003', name: 'Đá me', price: 18000, category: 'other-drinks', badge: null, tags: ['Iced'] },
      { id: 'od004', name: 'Chanh muối', price: 18000, category: 'other-drinks', badge: null, tags: ['Iced'] },
      { id: 'od005', name: 'Sữa tươi', price: 20000, category: 'other-drinks', badge: null, tags: ['Cold'] },
      // 🥛 Yaourt (4)
      { id: 'yg001', name: 'Yaourt đá', price: 20000, category: 'yogurt', badge: null, tags: ['Iced'] },
      { id: 'yg002', name: 'Yaourt cà phê', price: 23000, category: 'yogurt', badge: null, tags: ['Iced'] },
      { id: 'yg003', name: 'Yaourt Việt Quốc', price: 25000, category: 'yogurt', badge: null, tags: ['Iced'] },
      { id: 'yg004', name: 'Yaourt hủ', price: 15000, category: 'yogurt', badge: null, tags: ['Original'] },
      // 🍊 Nước ép (6)
      { id: 'jc001', name: 'Đá chanh', price: 18000, category: 'juice', badge: null, tags: ['Iced'] },
      { id: 'jc002', name: 'Rau má', price: 18000, category: 'juice', badge: null, tags: ['Iced'] },
      { id: 'jc003', name: 'Rau má dừa/sữa', price: 25000, category: 'juice', badge: null, tags: ['Iced'] },
      { id: 'jc004', name: 'Dừa trái', price: 23000, category: 'juice', badge: null, tags: ['Iced'] },
      { id: 'jc005', name: 'Dừa đá', price: 25000, category: 'juice', badge: null, tags: ['Iced'] },
      { id: 'jc006', name: 'Cam vắt', price: 23000, category: 'juice', badge: null, tags: ['Fresh'] },
      // 🧴 Giải khát đóng chai (3)
      { id: 'bt001', name: 'Nước suối', price: 10000, category: 'bottled', badge: null, tags: ['Cold'] },
      { id: 'bt002', name: 'Sting/ Coca/ Pepsi/ 7 UP/ Ô long', price: 15000, category: 'bottled', badge: null, tags: ['Cold'] },
      { id: 'bt003', name: 'Redbull', price: 20000, category: 'bottled', badge: null, tags: ['Cold'] },
    ],
    imageMap: {
      'traditional-coffee': 'images/interior.png',
      'hot-coffee':   'images/interior.png',
      'frappuccino':  'images/night-4k.png',
      'smoothies':    'images/night-4k.png',
      'soda':         'images/night-4k.png',
      'tea':          'images/night-4k.png',
      'other-drinks': 'images/exterior.png',
      'yogurt':       'images/exterior.png',
      'juice':        'images/exterior.png',
      'bottled':      'images/exterior.png',
    },
  };
}
