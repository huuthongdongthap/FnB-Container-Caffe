// ═══════════════════════════════════════════════
//  AURA SPACE — Menu Page Interactions
// ═══════════════════════════════════════════════

import { ApiService } from './api-client.js';

let MENU_DATA = null;
let CART = [];

// Map D1 category IDs → menu.html data-category slugs
const CATEGORY_SLUG_MAP = {
  'cat-001': 'coffee',
  'cat-002': 'tea',
  'cat-003': 'signature',
  'cat-004': 'snacks',
};
const CATEGORY_ICON_MAP = {
  'cat-001': '☕', 'cat-002': '🍵', 'cat-003': '🍹', 'cat-004': '🥐',
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadMenuData();
  initMenuFilter();
  initGalleryLightbox();
  initSmoothScroll();
  initScrollReveal();
  registerServiceWorker();
  initAddToCart();
  updateCartCount();
});

// ─── Load Menu Data from Cloudflare Worker API ───
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
    // Fallback: static HTML cards already in menu.html remain visible
    console.warn('[Menu] API unavailable, using static HTML fallback:', err.message);
  }
}

/** Transform D1 API response → internal MENU_DATA shape */
function _transformApiData(categories, products) {
  return {
    categories: categories.map(c => ({
      id: CATEGORY_SLUG_MAP[c.id] ?? c.id,
      name: c.name,
      description: c.description,
      icon: CATEGORY_ICON_MAP[c.id] ?? '🍽️',
    })),
    items: products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description ?? '',
      category: CATEGORY_SLUG_MAP[p.category_id] ?? p.category_id,
      image: p.image_url ?? null,
      tags: [],
      badge: null,
    })),
    imageMap: {
      coffee:    'images/interior.png',
      tea:       'images/night-4k.png',
      signature: 'images/night-4k.png',
      snacks:    'images/exterior.png',
    },
  };
}

// ─── Render Categories Headers ───
function renderCategoriesHeaders() {
  if (!MENU_DATA?.categories) {return;}

  MENU_DATA.categories.forEach(cat => {
    const header = document.querySelector(`.menu-category[data-category="${cat.id}"] .category-header`);
    if (header) {
      header.innerHTML = `
                <span class="category-icon">${cat.icon}</span>
                <h2 class="category-title">${cat.name}</h2>
                <span class="category-tag">${cat.description}</span>
            `;
    }
  });
}

// ─── Render Menu Categories from Data ───
function renderMenuCategories() {
  if (!MENU_DATA?.items?.length) return;

  const imageMap = MENU_DATA.imageMap || {};

  // Collect all unique category slugs present in API data + existing DOM sections
  const domCategories = [...document.querySelectorAll('[data-category]')]
    .map(el => el.dataset.category)
    .filter((v, i, a) => a.indexOf(v) === i);

  domCategories.forEach(catId => {
    const section = document.querySelector(`[data-category="${catId}"] .menu-grid`);
    if (!section) return;

    const items = MENU_DATA.items.filter(item => item.category === catId);
    if (items.length > 0) {
      section.innerHTML = items.map(item => renderMenuItem(item, catId, imageMap)).join('');
    }
  });
}

// ─── Render Single Menu Item ───
function renderMenuItem(item, category, imageMap) {
  const badgeClass = item.badge ? (item.badge.includes('Best') || item.badge.includes('Save') || item.badge.includes('Best Value') ? 'highlight' : 'neon-pulse') : '';
  const imageSrc = imageMap[category] || 'images/interior.png';

  let content = '';

  if (category === 'combo') {
    content = `
            <ul class="combo-items">
                ${item.description ? `<li>${item.description}</li>` : ''}
            </ul>
        `;
  } else {
    content = `
            <p class="item-desc">${item.description || ''}</p>
            ${item.tags ? `
                <div class="item-meta">
                    ${item.tags.map(tag => `<span class="item-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
        `;
  }

  return `
        <div class="menu-item-card ${category === 'combo' ? 'combo-card' : ''}" data-category="${category}">
            <div class="item-image">
                <img src="${imageSrc}" alt="${item.name}" loading="lazy">
                ${item.badge ? `<span class="item-badge ${badgeClass}">${item.badge}</span>` : ''}
            </div>
            <div class="item-content">
                <div class="item-header">
                    <h3 class="item-name">${item.name}</h3>
                    ${category === 'combo' && item.originalPrice ? `
                        <div class="combo-prices">
                            <span class="item-price highlight">${formatPrice(item.price)}</span>
                            <span class="item-price-original">${formatPrice(item.originalPrice)}</span>
                        </div>
                    ` : `
                        <span class="item-price">${formatPrice(item.price)}</span>
                    `}
                </div>
                ${content}
                <button class="btn-add-cart" data-product='${JSON.stringify({id: item.id, name: item.name, price: item.price, image: imageSrc}).replace(/'/g, '&apos;')}'>
                    🛒 Thêm vào giỏ
                </button>
            </div>
        </div>
    `;
}

// ─── Render Gallery from Data ───
function renderGallery() {
  const galleryGrid = document.querySelector('.gallery-grid');
  if (!galleryGrid || !MENU_DATA?.gallery) {return;}

  const galleryItems = MENU_DATA.gallery;
  galleryGrid.innerHTML = galleryItems.map((item, index) => {
    const sizeClass = index === 0 ? 'large' : '';
    return `
            <div class="gallery-item ${sizeClass}">
                <img src="${item.src}" alt="${item.caption}" loading="lazy">
                <div class="gallery-overlay">
                    <span>${item.caption}</span>
                </div>
            </div>
        `;
  }).join('');
}

// ─── Format Price ───
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

// ─── Menu Filter Functionality ───
function initMenuFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const menuCategories = document.querySelectorAll('.menu-category');

  if (!filterBtns.length || !menuCategories.length) {return;}

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      // Filter categories with animation
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

// ─── Gallery Lightbox ───
function initGalleryLightbox() {
  const galleryItems = document.querySelectorAll('.gallery-item');

  if (!galleryItems.length) {return;}

  // Create lightbox overlay
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox-overlay';
  lightbox.innerHTML = `
        <button class="lightbox-close">&times;</button>
        <div class="lightbox-content">
            <img src="" alt="" class="lightbox-image">
            <div class="lightbox-caption"></div>
        </div>
    `;
  lightbox.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(6, 10, 19, 0.95);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(10px);
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('.lightbox-image');
  const lightboxCaption = lightbox.querySelector('.lightbox-caption');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  const openLightbox = (imgSrc, caption) => {
    lightbox.style.display = 'flex';
    setTimeout(() => {
      lightbox.style.opacity = '1';
    }, 10);
    lightboxImg.src = imgSrc;
    lightboxImg.alt = caption;
    lightboxCaption.textContent = caption;
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.style.opacity = '0';
    setTimeout(() => {
      lightbox.style.display = 'none';
      document.body.style.overflow = '';
    }, 300);
  };

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {closeLightbox();}
  });

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const overlay = item.querySelector('.gallery-overlay span');
      openLightbox(img.src, overlay?.textContent || img.alt || '');
    });
  });

  // Keyboard escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {closeLightbox();}
  });
}

// ─── Smooth Scroll for Anchor Links ───
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') {return;}

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ─── Scroll Reveal Animation ───
function initScrollReveal() {
  const reveals = document.querySelectorAll('.menu-category, .gallery-item');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || index * 50;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  reveals.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Add visible class styles dynamically
if (!document.getElementById('menu-reveal-styles')) {
  const style = document.createElement('style');
  style.id = 'menu-reveal-styles';
  style.textContent = `
        .menu-category.visible,
        .gallery-item.visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
  document.head.appendChild(style);
}

// ─── Service Worker Registration ───
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          // Service Worker registered
        })
        .catch((error) => {
          // Registration failed
        });
    });
  }
}

// ─── Add to Cart Functionality ───
function initAddToCart() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-add-cart') || e.target.closest('.btn-add-cart')) {
      const btn = e.target.classList.contains('btn-add-cart') ? e.target : e.target.closest('.btn-add-cart');
      const productData = btn.dataset.product;

      if (productData) {
        try {
          const product = JSON.parse(productData.replace(/&apos;/g, '\''));
          addToCart(product);
          showAddToCartToast(product.name);
        } catch (error) {
          // Silent fail for parsing errors
        }
      }
    }
  });
}

function addToCart(product) {
  const existingItem = CART.find(item => item.id === product.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    CART.push({ ...product, quantity: 1 });
  }
  updateCartCount();
  saveCartToLocalStorage();
}

function updateCartCount() {
  const cartCountEl = document.querySelector('.cart-count');
  const totalItems = CART.reduce((sum, item) => sum + item.quantity, 0);

  if (cartCountEl) {
    cartCountEl.textContent = totalItems;
    cartCountEl.style.display = totalItems > 0 ? 'inline-block' : 'none';
  }

  // Update cart badge in navigation if exists
  const navCartBadge = document.querySelector('.nav-cart .cart-badge');
  if (navCartBadge) {
    navCartBadge.textContent = totalItems;
    navCartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function saveCartToLocalStorage() {
  try {
    localStorage.setItem('aura_cart', JSON.stringify(CART));
  } catch (error) {
    // Silent fail for localStorage quota exceeded
  }
}

function loadCartFromLocalStorage() {
  try {
    const savedCart = localStorage.getItem('aura_cart');
    if (savedCart) {
      CART = JSON.parse(savedCart);
      updateCartCount();
    }
  } catch (error) {
    // Silent fail for corrupted localStorage data
  }
}

function showAddToCartToast(productName) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `
        <span class="toast-icon">✅</span>
        <span class="toast-message">Đã thêm <strong>${productName}</strong> vào giỏ</span>
    `;
  toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: linear-gradient(135deg, #1a1612 0%, #2c2420 100%);
        color: #faf8f5;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        transition: transform 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(250, 248, 245, 0.1);
    `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Load cart on page load
loadCartFromLocalStorage();

// ─── Dark Mode Theme Toggle ───
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');

  if (!themeToggle) {return;}

  // Load saved theme or default to 'dark'
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeIcon, savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(themeIcon, newTheme);

    // Optional: Show toast notification
    // showToast(`🎨 Đã chuyển sang giao diện ${newTheme === 'dark' ? 'tối' : 'sáng'}`);
  });
}

function updateThemeIcon(icon, theme) {
  if (icon) {
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

// Initialize theme on page load
initThemeToggle();
