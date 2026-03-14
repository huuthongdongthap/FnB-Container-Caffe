/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — UI Enhancements JS
 *  Scroll Animations, Micro-interactions, Utilities
 * ═══════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════
// SCROLL REVEAL ANIMATION
// ═══════════════════════════════════════════════

function initScrollReveal() {
    const elements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-delayed');

    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════════
// RIPPLE EFFECT FOR BUTTONS
// ═══════════════════════════════════════════════

function initRippleEffect() {
    const buttons = document.querySelectorAll('.btn, button, [role="button"]');

    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');

            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
            ripple.style.top = e.clientY - rect.top - size / 2 + 'px';

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });
}

// ═══════════════════════════════════════════════
// CART ANIMATIONS
// ═══════════════════════════════════════════════

function animateCartAdd(itemElement) {
    // Pop animation on cart icon
    const cartIcon = document.querySelector('.cart-icon, .cart-count');
    if (cartIcon) {
        cartIcon.classList.add('cart-pop');
        setTimeout(() => cartIcon.classList.remove('cart-pop'), 300);
    }

    // Fly animation from item to cart
    if (itemElement) {
        const flyEl = itemElement.cloneNode(true);
        const itemRect = itemElement.getBoundingClientRect();
        const cartRect = cartIcon?.getBoundingClientRect();

        if (cartRect) {
            flyEl.style.cssText = `
                position: fixed;
                left: ${itemRect.left}px;
                top: ${itemRect.top}px;
                width: ${itemRect.width}px;
                height: ${itemRect.height}px;
                z-index: 9999;
                pointer-events: none;
                animation: cartFly 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            `;

            document.body.appendChild(flyEl);
            setTimeout(() => flyEl.remove(), 600);
        }
    }
}

// ═══════════════════════════════════════════════
// QUANTITY COUNTER ANIMATION
// ═══════════════════════════════════════════════

function animateQuantityChange(element) {
    if (!element) return;

    element.classList.add('quantity-change');
    setTimeout(() => {
        element.classList.remove('quantity-change');
    }, 300);
}

// ═══════════════════════════════════════════════
// TOAST NOTIFICATION WITH ANIMATION
// ═══════════════════════════════════════════════

function showToast(message, type = 'info', duration = 3000) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-notification toast-${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${getToastColor(type)};
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getToastColor(type) {
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    return colors[type] || colors.info;
}

// ═══════════════════════════════════════════════
// MODAL WITH ANIMATION
// ═══════════════════════════════════════════════

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const backdrop = modal.querySelector('.modal-backdrop') || modal;
    const content = modal.querySelector('.modal-content');

    backdrop.classList.add('modal-backdrop');
    if (content) content.classList.add('modal-content');

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // Trap focus
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length) {
        focusableElements[0].focus();
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

// ═══════════════════════════════════════════════
// SUCCESS CHECKMARK ANIMATION
// ═══════════════════════════════════════════════

function showSuccessCheckmark(container) {
    if (!container) return;

    container.innerHTML = `
        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" fill="none" stroke="#22c55e" stroke-width="2" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
    `;
}

// ═══════════════════════════════════════════════
// LAZY LOAD IMAGES WITH FADE IN
// ═══════════════════════════════════════════════

function initLazyLoad() {
    const images = document.querySelectorAll('img[data-src]');

    if (!images.length) return;

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const img = entry.target;
            const src = img.dataset.src;

            // Create new image to preload
            const preloadImg = new Image();
            preloadImg.src = src;

            preloadImg.onload = () => {
                img.style.opacity = '0';
                img.src = src;
                img.style.transition = 'opacity 0.4s ease';

                requestAnimationFrame(() => {
                    img.style.opacity = '1';
                });

                img.removeAttribute('data-src');
            };

            imageObserver.unobserve(img);
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01
    });

    images.forEach(img => imageObserver.observe(img));
}

// ═══════════════════════════════════════════════
// SKELETON LOADING HELPER
// ═══════════════════════════════════════════════

function showSkeleton(containerId, count = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHTML = '';

    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="skeleton-card">
                <div class="skeleton-image"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
                <div class="skeleton-button"></div>
            </div>
        `;
    }

    container.innerHTML = skeletonHTML;
}

function hideSkeleton(containerId, contentHTML) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = contentHTML;
    container.classList.add('animate-fade-in');

    setTimeout(() => {
        container.classList.remove('animate-fade-in');
    }, 500);
}

// ═══════════════════════════════════════════════
// PAGE LOADING TRANSITION
// ═══════════════════════════════════════════════

function initPageTransition() {
    // Add page-enter class to main container
    const main = document.querySelector('main, .page-container, body');
    if (main) {
        main.classList.add('page-container');
    }

    // Handle page exit on link click
    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');

        // Skip external links and anchors
        if (href.startsWith('http') || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) {
            return;
        }

        link.addEventListener('click', function(e) {
            // Only for same-origin navigation
            if (this.origin === window.location.origin) {
                document.body.classList.add('page-exit');

                setTimeout(() => {
                    window.location.href = href;
                }, 280);
            }
        });
    });
}

// ═══════════════════════════════════════════════
// ACCORDION INTERACTION
// ═══════════════════════════════════════════════

function initAccordion() {
    const accordions = document.querySelectorAll('.accordion-header');

    accordions.forEach(accordion => {
        accordion.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isOpen = content.classList.contains('open');

            // Close all accordions
            document.querySelectorAll('.accordion-content').forEach(c => {
                c.classList.remove('open');
                c.style.maxHeight = '0';
            });

            // Open clicked if it was closed
            if (!isOpen && content) {
                content.classList.add('open');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });
}

// ═══════════════════════════════════════════════
// TAB SWITCHING WITH ANIMATION
// ═══════════════════════════════════════════════

function initTabs() {
    const tabContainers = document.querySelectorAll('[data-tabs]');

    tabContainers.forEach(container => {
        const tabs = container.querySelectorAll('[data-tab]');
        const panels = container.querySelectorAll('[data-tab-panel]');
        const indicator = container.querySelector('.tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const target = this.dataset.tab;

                // Update indicator
                if (indicator) {
                    indicator.style.transform = `translateX(${this.offsetLeft}px)`;
                    indicator.style.width = `${this.offsetWidth}px`;
                }

                // Update active state
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');

                // Show panel with animation
                panels.forEach(panel => {
                    if (panel.dataset.tabPanel === target) {
                        panel.classList.add('active');
                        panel.style.display = 'block';
                        panel.classList.add('animate-fade-in');
                    } else {
                        panel.classList.remove('active');
                        panel.style.display = 'none';
                    }
                });
            });
        });
    });
}

// ═══════════════════════════════════════════════
// NUMBER COUNTER ANIMATION
// ═══════════════════════════════════════════════

function animateCounter(element, endValue, duration = 1000) {
    if (!element) return;

    const startValue = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out quart
        const eased = 1 - Math.pow(1 - progress, 4);

        const currentValue = Math.floor(startValue + (endValue - startValue) * eased);
        element.textContent = currentValue.toLocaleString('vi-VN');

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════
// PARALLAX EFFECT
// ═══════════════════════════════════════════════

function initParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    if (!parallaxElements.length) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;

        parallaxElements.forEach(el => {
            const speed = el.dataset.parallax || 0.5;
            const yPos = -(scrolled * speed);
            el.style.transform = `translateY(${yPos}px)`;
        });
    }, { passive: true });
}

// ═══════════════════════════════════════════════
// SMOOTH SCROLL TO ANCHOR
// ═══════════════════════════════════════════════

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ═══════════════════════════════════════════════
// LOADING STATE FOR FORMS
// ═══════════════════════════════════════════════

function setLoading(button, isLoading, loadingText = 'Đang xử lý...') {
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `
            <span class="spinner spinner-sm" style="display: inline-block; margin-right: 8px;"></span>
            ${loadingText}
        `;
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
    }
}

// ═══════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initRippleEffect();
    initLazyLoad();
    initPageTransition();
    initAccordion();
    initTabs();
    initParallax();
    initSmoothScroll();

    // Add loading class to body, remove after animations ready
    document.body.classList.add('loading-complete');
});

// Export functions globally
window.UIUtils = {
    showToast,
    showModal,
    hideModal,
    showSkeleton,
    hideSkeleton,
    animateCartAdd,
    animateQuantityChange,
    animateCounter,
    setLoading,
    showSuccessCheckmark
};
