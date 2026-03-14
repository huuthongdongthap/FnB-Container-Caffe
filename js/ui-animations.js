/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — UI Animations & Micro-interactions
 *  Skeleton Loading, Hover Effects, Scroll Animations
 * ═══════════════════════════════════════════════
 */

const UI_ANIMATIONS = {
    /**
     * Initialize all animations
     */
    init() {
        this.initScrollAnimations();
        this.initMicroInteractions();
        this.initSkeletonLoading();
        this.initParallaxEffects();
        this.initCursorEffects();
    },

    /**
     * Scroll-based reveal animations
     */
    initScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = parseInt(entry.target.dataset.delay) || 0;
                    setTimeout(() => {
                        entry.target.classList.add('reveal-visible');
                    }, delay);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe all reveal elements
        document.querySelectorAll('.reveal, .reveal-up, .reveal-down, .reveal-left, .reveal-right').forEach(el => {
            observer.observe(el);
        });
    },

    /**
     * Micro-interactions for buttons and cards
     */
    initMicroInteractions() {
        // Button ripple effect
        document.querySelectorAll('.btn, button, .btn-add-cart').forEach(btn => {
            if (!btn.classList.contains('no-ripple')) {
                btn.addEventListener('click', (e) => {
                    this.createRipple(e, btn);
                });
            }
        });

        // Card hover tilt effect
        document.querySelectorAll('.menu-item-card, .review-card, .feature-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
            });
        });

        // Image zoom on hover
        document.querySelectorAll('.item-image, .gallery-item').forEach(container => {
            const img = container.querySelector('img');
            if (img) {
                container.addEventListener('mouseenter', () => {
                    img.style.transform = 'scale(1.1)';
                });
                container.addEventListener('mouseleave', () => {
                    img.style.transform = 'scale(1)';
                });
            }
        });

        // Text reveal animation
        document.querySelectorAll('.animate-text').forEach(el => {
            const text = el.textContent;
            el.textContent = '';
            el.style.overflow = 'hidden';

            [...text].forEach((char, i) => {
                const span = document.createElement('span');
                span.textContent = char === ' ' ? '\u00A0' : char;
                span.style.display = 'inline-block';
                span.style.opacity = '0';
                span.style.transform = 'translateY(20px)';
                span.style.transition = `opacity 0.3s ease ${i * 0.03}s, transform 0.3s ease ${i * 0.03}s`;
                el.appendChild(span);

                setTimeout(() => {
                    span.style.opacity = '1';
                    span.style.transform = 'translateY(0)';
                }, i * 30);
            });
        });
    },

    /**
     * Create ripple effect on click
     */
    createRipple(e, btn) {
        const ripple = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;

        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    },

    /**
     * Skeleton loading states
     */
    initSkeletonLoading() {
        // Add skeleton class to loading elements
        document.querySelectorAll('[data-skeleton]').forEach(el => {
            el.classList.add('skeleton-loading');
        });

        // Simulate loading completion
        setTimeout(() => {
            document.querySelectorAll('.skeleton-loaded').forEach(el => {
                el.classList.remove('skeleton-loading');
            });
        }, 1500);
    },

    /**
     * Show skeleton loader
     */
    showSkeleton(container, template = 'card') {
        const skeletons = {
            card: `
                <div class="skeleton-card">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text short"></div>
                    </div>
                </div>
            `,
            list: `
                <div class="skeleton-list">
                    <div class="skeleton-list-item"></div>
                    <div class="skeleton-list-item"></div>
                    <div class="skeleton-list-item"></div>
                </div>
            `,
            text: `
                <div class="skeleton-text-wrapper">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            `
        };

        container.innerHTML = skeletons[template] || skeletons.card;
    },

    /**
     * Hide skeleton and show content
     */
    hideSkeleton(container, content) {
        container.classList.add('skeleton-fade-out');
        setTimeout(() => {
            container.innerHTML = content;
            container.classList.remove('skeleton-fade-out');
        }, 300);
    },

    /**
     * Parallax scroll effects
     */
    initParallaxEffects() {
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    document.querySelectorAll('[data-parallax]').forEach(el => {
                        const speed = parseFloat(el.dataset.parallax) || 0.5;
                        const rect = el.getBoundingClientRect();
                        const offset = rect.top;
                        const yPos = -offset * speed;

                        el.style.transform = `translateY(${yPos}px)`;
                    });

                    ticking = false;
                });

                ticking = true;
            }
        }, { passive: true });
    },

    /**
     * Custom cursor effects (desktop only)
     */
    initCursorEffects() {
        if (window.matchMedia('(pointer: coarse)').matches) return;

        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        cursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(243, 156, 18, 0.5);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transform: translate(-50%, -50%);
            transition: width 0.3s, height 0.3s, background-color 0.3s;
            display: none;
        `;
        document.body.appendChild(cursor);

        let cursorX = 0, cursorY = 0;
        let mouseX = 0, mouseY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (!cursor.style.display || cursor.style.display !== 'block') {
                cursor.style.display = 'block';
            }
        });

        const animateCursor = () => {
            cursorX += (mouseX - cursorX) * 0.15;
            cursorY += (mouseY - cursorY) * 0.15;

            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';

            requestAnimationFrame(animateCursor);
        };
        animateCursor();

        // Hover effect on interactive elements
        document.querySelectorAll('a, button, .btn, .clickable').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.style.width = '40px';
                cursor.style.height = '40px';
                cursor.style.backgroundColor = 'rgba(243, 156, 18, 0.2)';
            });

            el.addEventListener('mouseleave', () => {
                cursor.style.width = '20px';
                cursor.style.height = '20px';
                cursor.style.backgroundColor = 'transparent';
            });
        });
    },

    /**
     * Loading spinner
     */
    showSpinner(container) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = `
            <div class="spinner"></div>
        `;
        spinner.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 200px;
        `;
        container.appendChild(spinner);
    },

    /**
     * Hide loading spinner
     */
    hideSpinner(container) {
        const spinner = container.querySelector('.loading-spinner');
        if (spinner) {
            spinner.style.opacity = '0';
            spinner.style.transition = 'opacity 0.3s ease';
            setTimeout(() => spinner.remove(), 300);
        }
    },

    /**
     * Fade in element
     */
    fadeIn(el, duration = 300) {
        el.style.opacity = '0';
        el.style.display = 'block';
        el.style.transition = `opacity ${duration}ms ease`;

        requestAnimationFrame(() => {
            el.style.opacity = '1';
        });
    },

    /**
     * Fade out element
     */
    fadeOut(el, duration = 300) {
        el.style.opacity = '1';
        el.style.transition = `opacity ${duration}ms ease`;

        requestAnimationFrame(() => {
            el.style.opacity = '0';
        });

        return new Promise(resolve => {
            setTimeout(() => {
                el.style.display = 'none';
                resolve();
            }, duration);
        });
    },

    /**
     * Slide in element
     */
    slideIn(el, direction = 'up', duration = 300) {
        const directions = {
            up: 'translateY(100%)',
            down: 'translateY(-100%)',
            left: 'translateX(100%)',
            right: 'translateX(-100%)'
        };

        el.style.opacity = '0';
        el.style.transform = directions[direction];
        el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;

        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translate(0)';
        });
    },

    /**
     * Number counter animation
     */
    animateCounter(el, end, duration = 2000, prefix = '', suffix = '') {
        const start = 0;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (easeOutQuart)
            const ease = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (end - start) * ease);

            el.textContent = prefix + current.toLocaleString() + suffix;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }
};

// Add CSS for animations
const animationCSS = document.createElement('style');
animationCSS.textContent = `
    /* Reveal animations */
    .reveal, .reveal-up, .reveal-down, .reveal-left, .reveal-right {
        opacity: 0;
        transition: all 0.6s ease;
    }

    .reveal-up {
        transform: translateY(30px);
    }

    .reveal-down {
        transform: translateY(-30px);
    }

    .reveal-left {
        transform: translateX(30px);
    }

    .reveal-right {
        transform: translateX(-30px);
    }

    .reveal-visible {
        opacity: 1;
        transform: translate(0);
    }

    /* Skeleton loading */
    .skeleton-loading {
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }

    .skeleton-loading::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
        );
        animation: skeleton-shimmer 1.5s infinite;
    }

    @keyframes skeleton-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }

    .skeleton-image {
        height: 200px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px 8px 0 0;
    }

    .skeleton-title {
        height: 24px;
        width: 70%;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        margin: 1rem;
    }

    .skeleton-text {
        height: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        margin: 0.5rem 1rem;
    }

    .skeleton-text.short {
        width: 50%;
    }

    .skeleton-list-item {
        height: 60px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        margin: 0.5rem 0;
    }

    .skeleton-fade-out {
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    /* Loading spinner */
    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(243, 156, 18, 0.2);
        border-top-color: #f39c12;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Ripple effect */
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    /* Pulse animation */
    @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    /* Bounce animation */
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }

    .bounce {
        animation: bounce 1s ease infinite;
    }

    /* Fade in keyframes */
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* Slide up keyframes */
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(animationCSS);

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI_ANIMATIONS.init());
} else {
    UI_ANIMATIONS.init();
}

// Export for global use
window.UI_ANIMATIONS = UI_ANIMATIONS;
