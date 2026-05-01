/**
 * AURA CAFE — Premium UI Interactions v2.0
 * Scroll-aware navbar, parallax, reveal, ambient particles
 */
/* global MutationObserver */
(function () {
  'use strict';

  const navbar = document.querySelector('.m3-top-app-bar');
  if (navbar) {
    const onScroll = () => { navbar.classList.toggle('scrolled', window.scrollY > 60); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const heroBg = document.querySelector('.hero-bg, .hero img, .hero video');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) { heroBg.style.transform = `translateY(${y * 0.35}px) scale(1.05)`; }
    }, { passive: true });
  }

  const revealEls = document.querySelectorAll('.section, .menu-card, .m3-card, .feature-card, .space-card, .review-card, .stat-item, [class*="reveal"]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObs.unobserve(entry.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => {
      if (!el.classList.contains('reveal') && !el.classList.contains('reveal-left') && !el.classList.contains('reveal-right') && !el.classList.contains('reveal-stagger')) { el.classList.add('reveal'); }
      revealObs.observe(el);
    });
  }

  const statNumbers = document.querySelectorAll('.stat-number, .counter');
  if (statNumbers.length && 'IntersectionObserver' in window) {
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { animateCounter(entry.target); counterObs.unobserve(entry.target); } });
    }, { threshold: 0.5 });
    statNumbers.forEach((el) => counterObs.observe(el));
  }

  function animateCounter(el) {
    const text = el.textContent.trim();
    const match = text.match(/^([\d,.]+)(.*)$/);
    if (!match) {return;}

    const target = parseFloat(match[1].replace(/,/g, ''));
    const suffix = match[2] || '';
    const duration = 1200;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      el.textContent = current.toLocaleString('vi-VN') + suffix;
      if (progress < 1) {requestAnimationFrame(step);}
    }
    requestAnimationFrame(step);
  }

  function initParticles() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const existing = document.querySelector('.ambient-particles');
    if (!isDark) {
      if (existing) {existing.remove();}
      return;
    }
    if (existing) {return;}

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {return;}

    const container = document.createElement('div');
    container.className = 'ambient-particles';
    container.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 15; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 8 + 's';
      p.style.animationDuration = 6 + Math.random() * 6 + 's';
      p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
      container.appendChild(p);
    }
    document.body.appendChild(container);
  }
  initParticles();
  new MutationObserver(initParticles).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  document.body.classList.add('page-transition');

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.m3-filled-button, .cta-button, .btn-order');
    if (!btn) {return;}
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    btn.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });
})();
