/* ═══════════════════════════════════════════════════════════════════════════════
   ASIAN WOW ENGINE v2.3 — Container Cafe Asian Aesthetics
   5 Functions: zen-particles | organic-curves | japanese-typography
                container-3d-scroll | wabi-sabi-grain
   Bazi v5.1 — Navy / Chrome / Jade color system
   ═══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── 1. ZEN PARTICLES ─── */
  function initZenParticles() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) { return; }
    const container = document.querySelector('.zen-particles');
    if (!container) { return; }
    if (container.children.length > 0) { return; }
    const sizes = ['sm', 'md', 'lg'];
    const count = window.innerWidth < 768 ? 12 : 24;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const sz = sizes[i % 3];
      p.className = 'zen-particle zen-particle--' + sz;
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.setProperty('--p-opacity', (0.15 + Math.random() * 0.35).toFixed(2));
      p.style.animationDelay = (Math.random() * 12) + 's';
      p.style.animationDuration = (10 + Math.random() * 16) + 's';
      container.appendChild(p);
    }
    // GSAP drift if available
    if (typeof gsap !== 'undefined') {
      gsap.to('.zen-particle', {
        y: function () { return -20 - Math.random() * 60; },
        x: function () { return -15 + Math.random() * 30; },
        duration: function () { return 8 + Math.random() * 14; },
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: { each: 0.15, from: 'random' }
      });
    }
  }

  /* ─── 2. ORGANIC CURVE DIVIDERS ─── */
  function initOrganicDividers() {
    const dividers = document.querySelectorAll('.organic-divider[data-shape]');
    if (!dividers.length) { return; }
    dividers.forEach(function (d) {
      const shape = d.getAttribute('data-shape') || 'wave';
      const color = d.getAttribute('data-color') || 'rgba(201,214,223,0.08)';
      const height = d.getAttribute('data-height') || '60';
      const w = d.offsetWidth || window.innerWidth;
      const h = parseInt(height, 10);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.height = h + 'px';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let dStr = 'M0,' + h + ' ';
      const segs = 6;
      const segW = w / segs;
      for (let i = 0; i <= segs; i++) {
        const x = i * segW;
        const y = shape === 'curve' ? h * 0.5 + Math.sin(i * 1.2) * h * 0.35 : h * 0.3 + Math.cos(i * 0.9) * h * 0.25;
        dStr += (i === 0 ? 'L' : 'C') + x + ',' + y + ' ';
      }
      dStr += 'L' + w + ',' + h + ' L0,' + h + ' Z';
      path.setAttribute('d', dStr);
      path.setAttribute('fill', color);
      svg.appendChild(path);
      d.appendChild(svg);
    });
  }

  /* ─── 3. JAPANESE TYPOGRAPHY ACCENTS ─── */
  function initJapaneseTypography() {
    const watermarks = document.querySelectorAll('[data-zen-kanji]');
    watermarks.forEach(function (el) {
      const kanji = el.getAttribute('data-zen-kanji');
      const pos = el.getAttribute('data-zen-pos') || 'left';
      el.textContent = kanji;
      el.className += ' zen-watermark zen-watermark--' + pos;
    });
    const headings = document.querySelectorAll('.zen-heading');
    headings.forEach(function (h) {
      h.classList.add('zen-heading');
    });
  }

  /* ─── 4. CONTAINER 3D SCROLL ─── */
  function initContainer3D() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) { return; }
    const frames = document.querySelectorAll('.container-frame');
    if (!frames.length) { return; }
    frames.forEach(function (frame) {
      const el3d = frame.querySelector('.container-3d');
      if (!el3d) { return; }
      frame.addEventListener('mousemove', function (e) {
        const rect = frame.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const rX = ((my - cy) / cy) * -3;
        const rY = ((mx - cx) / cx) * 3;
        el3d.style.transform = 'rotateX(' + rX + 'deg) rotateY(' + rY + 'deg)';
      });
      frame.addEventListener('mouseleave', function () {
        el3d.style.transition = 'transform 0.6s cubic-bezier(0.23,1,0.32,1)';
        el3d.style.transform = 'rotateX(0) rotateY(0)';
        setTimeout(function () { el3d.style.transition = ''; }, 600);
      });
    });
  }

  /* ─── 5. WABI-SABI GRAIN ─── */
  function initWabiSabigrain() {
    const grain = document.querySelector('.wabi-sabi-grain');
    if (!grain) { return; }
    // Auto dark mode support
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) {
      grain.classList.add('wabi-sabi-grain--dark');
    }
  }

  /* ─── BOOT ─── */
  function boot() {
    initZenParticles();
    initOrganicDividers();
    initJapaneseTypography();
    initContainer3D();
    initWabiSabigrain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
