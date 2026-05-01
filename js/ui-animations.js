/**
 * UI Animations & Micro-interactions Module
 * AURA CAFE Café - Enhanced UX
 */

export class UIAnimations {
  constructor() {
    this.observer = null;
    this.init();
  }

  init() {
    this.initScrollReveal();
    this.initRippleEffect();
    this.initMagneticScale();
    this.initSkeletonLoading();
    this.initParallax();
    this.initCounterAnimation();
  }

  /**
     * Scroll Reveal Animation
     * Elements with .reveal, .reveal-left, .reveal-right classes
     */
  initScrollReveal() {
    const revealElements = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right'
    );

    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              if (this.observer) {
                this.observer.unobserve(entry.target);
              }
            }
          });
        },
        {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      revealElements.forEach((el) => this.observer.observe(el));
    } else {
      // Fallback for older browsers
      revealElements.forEach((el) => el.classList.add('is-visible'));
    }
  }

  /**
     * Ripple Effect on Button Click
     */
  initRippleEffect() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('.ripple-container, .btn-primary, .btn-secondary, .btn-order');
      if (!button) {return;}

      const ripple = document.createElement('span');
      ripple.classList.add('ripple');

      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      button.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });
  }

  /**
     * Magnetic Scale Effect on Button Hover
     * Adds subtle follow effect to .cta-button and .order-btn
     */
  initMagneticScale() {
    const buttons = document.querySelectorAll('.cta-button, .order-btn');

    buttons.forEach((button) => {
      button.addEventListener('mouseenter', () => {
        button.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = '';
      });
    });
  }

  /**
     * Skeleton Loading for Dynamic Content
     */
  initSkeletonLoading() {
    // Auto-remove skeleton when image loads
    document.querySelectorAll('img[data-skeleton]').forEach((img) => {
      img.addEventListener('load', () => {
        img.previousElementSibling?.classList.remove('skeleton');
      });
    });
  }

  /**
     * Create skeleton placeholder for an element
     */
  createSkeleton(type = 'card', count = 1) {
    const skeletons = {
      card: () => `
                <div class="skeleton-card">
                    <div class="skeleton-image skeleton"></div>
                    <div class="skeleton-title skeleton"></div>
                    <div class="skeleton-text short skeleton"></div>
                    <div class="skeleton-text long skeleton"></div>
                </div>
            `,
      text: () => `
                <div class="skeleton-text skeleton"></div>
                <div class="skeleton-text skeleton"></div>
                <div class="skeleton-text medium skeleton"></div>
            `,
      avatar: () => `
                <div class="skeleton-avatar skeleton"></div>
            `,
      image: (height = '200px') => `
                <div class="skeleton-image skeleton" style="height: ${height}"></div>
            `,
      list: (items = 3) => `
                ${Array(items).fill('<div class="skeleton-text skeleton"></div>').join('')}
            `
    };

    return Array(count).fill(skeletons[type]?.() || skeletons.card()).join('');
  }

  /**
     * Parallax Effect on Scroll
     */
  initParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    if (parallaxElements.length === 0) {return;}

    let ticking = false;

    const updateParallax = () => {
      parallaxElements.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.5;
        const rect = el.getBoundingClientRect();
        const offset = (window.innerHeight - rect.top) * speed;
        el.style.transform = `translateY(${offset}px)`;
      });
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }

  /**
     * Counter Animation for Stats
     */
  initCounterAnimation() {
    const counters = document.querySelectorAll('[data-count-to]');
    if (counters.length === 0) {return;}

    const animateCounter = (counter) => {
      const target = parseInt(counter.dataset.countTo, 10);
      const duration = 2000;
      const step = target / (duration / 16);
      let current = 0;

      const updateCounter = () => {
        current += step;
        if (current < target) {
          counter.textContent = Math.floor(current);
          requestAnimationFrame(updateCounter);
        } else {
          counter.textContent = target;
        }
      };

      updateCounter();
    };

    if ('IntersectionObserver' in window) {
      const counterObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              counterObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      counters.forEach((counter) => counterObserver.observe(counter));
    }
  }

  /**
     * Fade In Up Animation
     */
  fadeInUp(element, delay = 0) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    element.style.transition = `all 0.6s var(--ease-out-expo) ${delay}s`;

    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }

  /**
     * Slide In Animation
     */
  slideIn(element, direction = 'left', delay = 0) {
    const directions = {
      left: { x: '-50px', y: '0' },
      right: { x: '50px', y: '0' },
      up: { x: '0', y: '50px' },
      down: { x: '0', y: '-50px' }
    };

    const { x, y } = directions[direction] || directions.left;

    element.style.opacity = '0';
    element.style.transform = `translate(${x}, ${y})`;
    element.style.transition = `all 0.5s var(--ease-out-expo) ${delay}s`;

    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translate(0, 0)';
    });
  }

  /**
     * Zoom In Animation
     */
  zoomIn(element, delay = 0) {
    element.style.opacity = '0';
    element.style.transform = 'scale(0.8)';
    element.style.transition = `all 0.4s var(--ease-out-expo) ${delay}s`;

    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
    });
  }

  /**
     * Remove Skeleton and Show Content
     */
  showContent(skeletonEl, contentEl) {
    if (skeletonEl && contentEl) {
      skeletonEl.classList.add('is-loaded');
      setTimeout(() => {
        skeletonEl.style.display = 'none';
        contentEl.style.display = 'block';
        contentEl.classList.add('fade-in-up');
      }, 300);
    }
  }

  /**
     * Loading State Management
     */
  setLoading(container, isLoading = true) {
    if (isLoading) {
      container.classList.add('is-loading');
      container.setAttribute('aria-busy', 'true');
    } else {
      container.classList.remove('is-loading');
      container.removeAttribute('aria-busy');
    }
  }

  /**
     * Cleanup
     */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Auto-initialize on DOM ready
if (typeof window !== 'undefined') {
  window.uiAnimations = new UIAnimations();
}
