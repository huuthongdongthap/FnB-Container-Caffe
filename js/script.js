/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — Main Script
 *  Landing Page + Order System + Form Validation
 * ═══════════════════════════════════════════════
 */

// ─── Constants ───
const MENU_ITEMS = {
  coffee: [
    { id: 'c1', name: 'Espresso Đơn/Đôi', price: 29000, price2: 45000 },
    { id: 'c2', name: 'Cà Phê Sữa Đá', price: 35000 },
    { id: 'c3', name: 'Bạc Xỉu Đá', price: 35000 },
    { id: 'c4', name: 'Cold Brew Tower (12h)', price: 55000 },
    { id: 'c5', name: 'Pour Over V60', price: 55000 },
    { id: 'c6', name: 'Latte / Cappuccino', price: 49000 },
    { id: 'c7', name: 'Caramel Macchiato', price: 55000 }
  ],
  signature: [
    { id: 's1', name: 'Container Special', price: 65000 },
    { id: 's2', name: 'Dirty Matcha Latte', price: 55000 },
    { id: 's3', name: 'Trà Sen Vàng', price: 45000 },
    { id: 's4', name: 'Kombucha Tươi', price: 45000 },
    { id: 's5', name: 'Soda Chanh Bạc Hà', price: 40000 },
    { id: 's6', name: 'Trái Cây Nhiệt Đới', price: 50000 },
    { id: 's7', name: 'Matcha Latte', price: 50000 }
  ],
  snacks: [
    { id: 'k1', name: 'Bánh Mì Chả Lụa', price: 35000 },
    { id: 'k2', name: 'Sandwich Trứng', price: 40000 },
    { id: 'k3', name: 'Croissant Bơ Pháp', price: 45000 },
    { id: 'k4', name: 'Granola Bowl', price: 55000 },
    { id: 'k5', name: 'Cookie Choco Chip', price: 30000 },
    { id: 'k6', name: 'Cheesecake Slice', price: 55000 },
    { id: 'k7', name: 'Khoai Tây Chiên', price: 45000 }
  ]
};

const cart = {};

// ─── Utility Functions ───
function formatPrice(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

// ─── Cart Functions ───
function addToCart(id, name, price, qty) {
  cart[id] = { id, name, price, qty };
  updateCartDisplay();
}

function removeFromCart(id) {
  delete cart[id];
  updateCartDisplay();
}

function updateCartQty(id, qty) {
  if (cart[id]) {
    cart[id].qty = qty;
    updateCartDisplay();
  }
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartTotal = document.getElementById('cartTotal');

  const items = Object.values(cart);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal + (itemCount > 0 ? 15000 : 0);

  if (cartCount) {cartCount.textContent = itemCount;}
  if (cartItems) {
    if (items.length === 0) {
      cartItems.innerHTML = '<p class="cart-empty">Giỏ hàng trống</p>';
    } else {
      cartItems.innerHTML = items.map(item => `
                <div class="cart-item">
                    <div>
                        <div style="font-weight: 500; color: var(--text-primary);">${item.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">x${item.qty} · ${formatPrice(item.price)}</div>
                    </div>
                    <div style="font-weight: 600; color: var(--warm-amber);">${formatPrice(item.price * item.qty)}</div>
                </div>
            `).join('');
    }
  }
  if (cartSubtotal) {cartSubtotal.textContent = formatPrice(subtotal);}
  if (cartTotal) {cartTotal.textContent = formatPrice(total);}
}

// ─── Order System Functions ───
function initOrderSystem() {
  const orderItems = document.getElementById('orderItems');
  const categoryBtns = document.querySelectorAll('.order-cat-btn');

  if (orderItems) {
    renderMenuItems('coffee', orderItems);
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderMenuItems(btn.dataset.cat, orderItems);
      });
    });
  }
}

function renderMenuItems(category, container) {
  const items = MENU_ITEMS[category] || [];
  container.innerHTML = items.map(item => `
        <div class="order-item" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">
            <div class="order-item-info">
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-price">${formatPrice(item.price)}</div>
            </div>
            <div class="order-item-actions">
                <div class="order-qty">
                    <button data-action="decrease">-</button>
                    <span data-qty>0</span>
                    <button data-action="increase">+</button>
                </div>
            </div>
        </div>
    `).join('');

  container.querySelectorAll('.order-item').forEach(item => {
    const increaseBtn = item.querySelector('[data-action="increase"]');
    const decreaseBtn = item.querySelector('[data-action="decrease"]');
    const qtySpan = item.querySelector('[data-qty]');

    increaseBtn?.addEventListener('click', () => {
      const qty = parseInt(qtySpan.textContent) + 1;
      qtySpan.textContent = qty;
      addToCart(item.dataset.id, item.dataset.name, parseInt(item.dataset.price), qty);
    });

    decreaseBtn?.addEventListener('click', () => {
      const qty = Math.max(0, parseInt(qtySpan.textContent) - 1);
      qtySpan.textContent = qty;
      if (qty === 0) {
        removeFromCart(item.dataset.id);
      } else {
        updateCartQty(item.dataset.id, qty);
      }
    });
  });
}

// ─── Order Modal ───
function initOrderModal() {
  const modal = document.getElementById('orderModal');
  const openBtns = [
    document.getElementById('btnOrderNav'),
    document.getElementById('btnOrderMobile')
  ].filter(Boolean);
  const closeBtn = modal?.querySelector('.order-modal-close');
  const overlay = modal?.querySelector('.order-modal-overlay');
  const tabs = modal?.querySelectorAll('.order-tab');
  const tabContents = modal?.querySelectorAll('.order-tab-content');

  if (!modal) {return;}

  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', closeModal);

  tabs?.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabContents?.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + 'Tab') {
          content.classList.add('active');
        }
      });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

// ─── Toast Notification System ───
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) {existing.remove();}

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="toast-message">${message}</span>
    `;
  toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' :
    type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
      'linear-gradient(135deg, var(--warm-amber), var(--warm-gold))'};
        color: ${type === 'info' ? 'var(--coffee-espresso)' : '#fff'};
        padding: 14px 24px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 90%;
        transition: transform 0.4s var(--ease-out-expo);
    `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function showSuccessToast(message) {
  showToast(message, 'success');
}

// ─── Contact Form Validation ───
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) {return;}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate all fields first
    const errors = validateForm(form);

    if (errors.length > 0) {
      showFormErrors(errors);
      return;
    }

    // Clear previous errors
    clearFormErrors();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Đang gửi...';
    submitBtn.disabled = true;
    form.classList.add('submitting');

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Simulate API call (replace with actual fetch when backend ready)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Success
    form.classList.remove('submitting');
    form.classList.add('success');
    submitBtn.textContent = '✅ Đã gửi thành công!';

    showToast('✅ Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong 24h.', 'success');

    // Reset form after 2 seconds
    setTimeout(() => {
      form.reset();
      form.classList.remove('success');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 2000);
  });

  // Real-time validation on blur
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) {
        validateField(input);
      }
    });
  });
}

function validateForm(form) {
  const errors = [];

  // Name validation
  const name = form.querySelector('#name');
  if (name && name.value.trim().length < 2) {
    errors.push({ field: 'name', message: 'Họ tên phải có ít nhất 2 ký tự' });
  }

  // Phone validation (Vietnamese format)
  const phone = form.querySelector('#phone');
  if (phone && !isValidVietnamesePhone(phone.value)) {
    errors.push({
      field: 'phone',
      message: 'Số điện thoại không hợp lệ. Ví dụ: 0901234567 hoặc 84901234567'
    });
  }

  // Email validation (if provided)
  const email = form.querySelector('#email');
  if (email && email.value.trim() && !isValidEmail(email.value)) {
    errors.push({ field: 'email', message: 'Email không hợp lệ. Ví dụ: example@email.com' });
  }

  // Subject validation
  const subject = form.querySelector('#subject');
  if (subject && !subject.value) {
    errors.push({ field: 'subject', message: 'Vui lòng chọn chủ đề liên hệ' });
  }

  // Message validation
  const message = form.querySelector('#message');
  if (message && message.value.trim().length < 10) {
    errors.push({ field: 'message', message: 'Tin nhắn phải có ít nhất 10 ký tự' });
  }

  return errors;
}

function validateField(field) {
  const value = field.value.trim();
  let isValid = true;
  let errorMessage = '';

  switch (field.id) {
  case 'name':
    isValid = value.length >= 2;
    errorMessage = 'Họ tên phải có ít nhất 2 ký tự';
    break;
  case 'phone':
    isValid = isValidVietnamesePhone(value);
    errorMessage = 'Số điện thoại không hợp lệ';
    break;
  case 'email':
    isValid = !value || isValidEmail(value);
    errorMessage = 'Email không hợp lệ';
    break;
  case 'subject':
    isValid = value !== '';
    errorMessage = 'Vui lòng chọn chủ đề';
    break;
  case 'message':
    isValid = value.length >= 10;
    errorMessage = 'Tin nhắn quá ngắn';
    break;
  }

  if (isValid) {
    field.classList.remove('error');
    field.classList.add('valid');
    removeFieldError(field);
  } else if (value && field.id !== 'email') {
    field.classList.remove('valid');
    field.classList.add('error');
    showFieldError(field, errorMessage);
  }

  return isValid;
}

function isValidVietnamesePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^(\+?84|0)[3579]\d{8}$/.test(cleaned);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFormErrors(errors) {
  clearFormErrors();

  errors.forEach(error => {
    const field = document.getElementById(error.field);
    if (field) {
      field.classList.add('error');
      showFieldError(field, error.message);
    }
  });

  const firstError = document.querySelector('.form-group.error');
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showToast('❌ Vui lòng kiểm tra lại thông tin!', 'error');
}

function clearFormErrors() {
  document.querySelectorAll('.form-group.error').forEach(group => {
    group.classList.remove('error');
  });
  document.querySelectorAll('.form-group .field-error').forEach(error => {
    error.remove();
  });
}

function showFieldError(field, message) {
  const group = field.closest('.form-group');
  if (group) {
    const existingError = group.querySelector('.field-error');
    if (existingError) {existingError.remove();}

    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    errorEl.style.cssText = `
            display: block;
            margin-top: 6px;
            font-size: 0.75rem;
            color: #ef4444;
            animation: slideInDown 0.3s ease;
        `;
    group.appendChild(errorEl);
  }
}

function removeFieldError(field) {
  const group = field.closest('.form-group');
  if (group) {
    const existingError = group.querySelector('.field-error');
    if (existingError) {existingError.remove();}
  }
}

// ─── Hero Animations ───
function initHeroAnimations() {
  const heroContent = document.querySelector('.hero-content');
  if (!heroContent) {return;}

  const elements = heroContent.querySelectorAll('h1, .hero-subtitle, .hero-buttons, .hero-scroll');
  elements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s ease ${0.2 + index * 0.15}s, transform 0.6s ease ${0.2 + index * 0.15}s`;

    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 100 + index * 150);
  });
}

// ─── Enhanced Scroll Reveal ───
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

// ─── Navbar Scroll Effect ───
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) {return;}

  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    if (currentScroll > lastScroll && currentScroll > 200) {
      navbar.classList.add('hidden');
    } else {
      navbar.classList.remove('hidden');
    }

    lastScroll = currentScroll;
  }, { passive: true });
}

// ─── Mobile Menu ───
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const closeBtn = document.querySelector('.mobile-menu-close');
  const mobileLinks = document.querySelectorAll('.mobile-menu a');

  if (!hamburger || !mobileMenu) {return;}

  const openMenu = () => {
    mobileMenu.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
  };

  hamburger.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  mobileLinks.forEach(link => link.addEventListener('click', closeMenu));
}

// ─── Smooth Scroll to Anchors ───
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') {return;}

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ─── Theme Toggle ───
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');

  if (!themeToggle) {return;}

  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(themeIcon, savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(themeIcon, newTheme);

    showToast(`🎨 Đã chuyển sang giao diện ${newTheme === 'dark' ? 'tối' : 'sáng'}`);
  });
}

function updateThemeIcon(icon, theme) {
  if (icon) {
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

// ─── Menu Filter (for menu.html) ───
function initMenuFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const menuCategories = document.querySelectorAll('.menu-category');

  if (!filterBtns.length || !menuCategories.length) {return;}

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;

      menuCategories.forEach(category => {
        const cat = category.dataset.category;
        if (filter === 'all' || cat === filter) {
          category.style.display = 'block';
          category.style.animation = 'fadeIn 0.5s ease forwards';
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

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
        <button class="lightbox-close">&times;</button>
        <div class="lightbox-content">
            <img src="" alt="" class="lightbox-image">
            <div class="lightbox-caption"></div>
        </div>
    `;
  overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(6, 10, 19, 0.95);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(10px);
    `;
  document.body.appendChild(overlay);

  const lightboxImg = overlay.querySelector('.lightbox-image');
  const lightboxCaption = overlay.querySelector('.lightbox-caption');
  const closeBtn = overlay.querySelector('.lightbox-close');

  const closeLightbox = () => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {closeLightbox();}
  });

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.gallery-overlay span');
      overlay.style.display = 'flex';
      lightboxImg.src = img.src;
      lightboxCaption.textContent = caption?.textContent || '';
      document.body.style.overflow = 'hidden';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {closeLightbox();}
  });
}

// ─── Register Service Worker ───
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/public/sw.js')
        .then(reg => {
          setInterval(() => reg.update(), 3600000);
        });
    });
  }
}

// ─── Checkout Redirect ───
document.getElementById('btnCheckout')?.addEventListener('click', () => {
  if (Object.values(cart).length > 0) {
    localStorage.setItem('cart', JSON.stringify(cart));
    window.location.href = 'checkout.html';
  } else {
    alert('🛒 Giỏ hàng trống. Vui lòng chọn món!');
  }
});

// ─── Initialize All ───
document.addEventListener('DOMContentLoaded', () => {
  initHeroAnimations();
  initScrollReveal();
  initNavbar();
  initMobileMenu();
  initSmoothScroll();
  initThemeToggle();
  initOrderModal();
  initOrderSystem();
  initContactForm();
  initMenuFilter();
  initGalleryLightbox();
  registerServiceWorker();
});

// ─── Dynamic CSS for animations ───
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-group input.error,
    .form-group select.error,
    .form-group textarea.error {
        border-color: #ef4444 !important;
        animation: shake 0.4s ease;
    }

    .form-group input.valid,
    .form-group select.valid,
    .form-group textarea.valid {
        border-color: #10b981 !important;
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-8px); }
        75% { transform: translateX(8px); }
    }

    .toast-notification {
        animation: slideUp 0.4s var(--ease-out-expo);
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(100px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;
document.head.appendChild(animationStyles);
