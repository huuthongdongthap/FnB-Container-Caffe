// ═══════════════════════════════════════════════
//  F&B CAFFE CONTAINER — Menu Page Interactions
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initMenuFilter();
    initGalleryLightbox();
    initSmoothScroll();
    registerServiceWorker();
});

// ─── Service Worker Registration ───
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/public/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
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

// Initialize scroll reveal
initScrollReveal();
