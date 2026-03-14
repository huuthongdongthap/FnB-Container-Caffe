// ═══════════════════════════════════════════════
//  F&B CAFFE CONTAINER — Menu Page Interactions
// ═══════════════════════════════════════════════

let MENU_DATA = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadMenuData();
    initMenuFilter();
    initGalleryLightbox();
    initSmoothScroll();
    initScrollReveal();
    registerServiceWorker();
});

// ─── Load Menu Data from JSON ───
async function loadMenuData() {
    try {
        const response = await fetch('data/menu-data.json');
        MENU_DATA = await response.json();
        renderMenuCategories();
        renderGallery();
    } catch (error) {
        // Fallback: render với data cứng nếu không load được JSON
        renderMenuCategories();
    }
}

// ─── Render Menu Categories from Data ───
function renderMenuCategories() {
    const categories = ['coffee', 'signature', 'snacks', 'combo'];
    const categoryNames = {
        coffee: { name: 'Specialty Coffee', icon: '☕', desc: 'Pha chế từ hạt Arabica nguyên chất' },
        signature: { name: 'Signature Drinks', icon: '🍹', desc: 'Độc quyền F&B Container' },
        snacks: { name: 'Đồ Ăn Nhẹ', icon: '🥐', desc: 'Nướng mới mỗi ngày' },
        combo: { name: 'Combo Tiết Kiệm', icon: '🎯', desc: 'Mua cùng nhau - Giá hời hơn' }
    };

    categories.forEach(catId => {
        const section = document.querySelector(`[data-category="${catId}"] .menu-grid`);
        if (!section) return;

        const items = MENU_DATA?.items?.filter(item => item.category === catId) || [];

        if (items.length > 0) {
            section.innerHTML = items.map(item => renderMenuItem(item, catId)).join('');
        }
    });
}

// ─── Render Single Menu Item ───
function renderMenuItem(item, category) {
    const imageMap = {
        coffee: 'images/interior.png',
        signature: 'images/night-4k.png',
        snacks: 'images/exterior.png',
        combo: 'images/4k_true_rooftop.png'
    };

    const badgeClass = item.badge ? (item.badge.includes('Best') || item.badge.includes('Save') ? 'highlight' : 'neon-pulse') : '';

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
                <img src="${item.image || imageMap[category]}" alt="${item.name}" loading="lazy">
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
            </div>
        </div>
    `;
}

// ─── Render Gallery from Data ───
function renderGallery() {
    const galleryGrid = document.querySelector('.gallery-grid');
    if (!galleryGrid || !MENU_DATA?.gallery) return;

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

    if (!filterBtns.length || !menuCategories.length) return;

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
        if (e.target === lightbox) closeLightbox();
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
        if (e.key === 'Escape') closeLightbox();
    });
}

// ─── Smooth Scroll for Anchor Links ───
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

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
