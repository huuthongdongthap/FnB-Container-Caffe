// ═══════════════════════════════════════════════
//  F&B CAFFE CONTAINER — Interactions
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initNavbar();
    initMobileMenu();
    initSmoothScroll();
    initThemeToggle();
    initOrderModal();
    initOrderSystem();
    initContactForm();
});

// ─── Scroll Reveal (Intersection Observer) ───
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger animation for siblings
                const delay = entry.target.dataset.delay || 0;
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

    reveals.forEach(el => observer.observe(el));
}

// ─── Navbar scroll effect ───
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 80) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
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

    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', () => {
        mobileMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    const closeMenu = () => {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeMenu);
    mobileLinks.forEach(link => link.addEventListener('click', closeMenu));
}

// ─── Smooth Scroll ───
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

// ─── Menu Filter ───
function initMenuFilter() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const menuCategories = document.querySelectorAll('.menu-category');

    if (!filterBtns.length || !menuCategories.length) return;

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            // Filter categories
            menuCategories.forEach(category => {
                const categoryFilter = category.dataset.category;

                if (filter === 'all' || categoryFilter === filter) {
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

    if (!galleryItems.length) return;

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
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('.lightbox-image');
    const lightboxCaption = lightbox.querySelector('.lightbox-caption');
    const closeBtn = lightbox.querySelector('.lightbox-close');

    const openLightbox = (imgSrc, caption) => {
        lightbox.style.display = 'flex';
        lightboxImg.src = imgSrc;
        lightboxCaption.textContent = caption;
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    };

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            const overlay = item.querySelector('.gallery-overlay span');
            openLightbox(img.src, overlay?.textContent || '');
        });
    });

    // Keyboard escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

// ═══════════════════════════════════════════════
// THEME TOGGLE (DARK/LIGHT MODE)
// ═══════════════════════════════════════════════
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');

    if (!themeToggle) return;

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
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
    if (!icon) return;
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ═══════════════════════════════════════════════
// ORDER MODAL
// ═══════════════════════════════════════════════
function initOrderModal() {
    const orderModal = document.getElementById('orderModal');
    const openBtns = [document.getElementById('btnOrderNav'), document.getElementById('btnOrderMobile')].filter(Boolean);
    const closeBtn = orderModal?.querySelector('.order-modal-close');
    const overlay = orderModal?.querySelector('.order-modal-overlay');
    const tabs = orderModal?.querySelectorAll('.order-tab');
    const tabContents = orderModal?.querySelectorAll('.order-tab-content');

    if (!orderModal) return;

    // Open modal
    openBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            orderModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    // Close modal
    const closeModal = () => {
        orderModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Tab switching
    tabs?.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents?.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabName + 'Tab') {
                    content.classList.add('active');
                }
            });
        });
    });

    // Keyboard escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && orderModal.classList.contains('active')) {
            closeModal();
        }
    });
}

// ═══════════════════════════════════════════════
// ORDER SYSTEM
// ═══════════════════════════════════════════════
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

let cart = {};

function initOrderSystem() {
    const orderItems = document.getElementById('orderItems');
    const catBtns = document.querySelectorAll('.order-cat-btn');

    if (!orderItems) return;

    // Render initial menu (coffee)
    renderMenuItems('coffee', orderItems);

    // Category filter
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMenuItems(btn.dataset.cat, orderItems);
        });
    });
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

    // Add event listeners
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
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const delivery = totalQty > 0 ? 15000 : 0;
    const total = subtotal + delivery;

    // Update cart count
    if (cartCount) cartCount.textContent = totalQty;

    // Update cart items
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

    // Update totals
    if (cartSubtotal) cartSubtotal.textContent = formatPrice(subtotal);
    if (cartTotal) cartTotal.textContent = formatPrice(total);
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

// ═══════════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════════
function initContactForm() {
    const contactForm = document.getElementById('contactForm');

    if (!contactForm) return;

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        // Add loading state
        contactForm.classList.add('submitting');
        submitBtn.disabled = true;

        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

        // Send via Zalo API (placeholder)
        const message = `
📬 Liên hệ mới từ ${data.name}:
📞 SĐT: ${data.phone}
📧 Email: ${data.email || 'N/A'}
📝 Chủ đề: ${data.subject}
💬 Tin nhắn: ${data.message}
        `.trim();

        // In production, send to backend API
        console.log('Contact form submission:', message);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Remove loading state
        contactForm.classList.remove('submitting');
        submitBtn.disabled = false;

        // Add success animation
        contactForm.classList.add('success');
        setTimeout(() => contactForm.classList.remove('success'), 600);

        // Show success toast instead of alert
        showSuccessToast('✅ Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong 24h.');
        contactForm.reset();
    });
}

// Success Toast Notification
function showSuccessToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.success-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: linear-gradient(135deg, var(--warm-amber), var(--warm-gold));
        color: var(--coffee-espresso);
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.95rem;
        box-shadow: 0 8px 32px rgba(212, 165, 116, 0.4);
        z-index: 9999;
        transition: transform 0.4s var(--ease-out-expo);
        max-width: 90%;
        text-align: center;
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Auto remove after 4s
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Checkout - Redirect to checkout page
document.getElementById('btnCheckout')?.addEventListener('click', () => {
    const items = Object.values(cart);
    if (items.length === 0) {
        alert('🛒 Giỏ hàng trống. Vui lòng chọn món!');
        return;
    }

    // Save cart to localStorage for checkout page
    localStorage.setItem('cart', JSON.stringify(cart));

    // Redirect to checkout page
    window.location.href = 'checkout.html';
});
