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
    var container = document.querySelector('.zen-particles');
    if (!container) { return; }
    if (container.children.length > 0) { return; }
    var sizes = ['sm', 'md', 'lg'];
    var count = window.innerWidth < 768 ? 12 : 24;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      var sz = sizes[i % 3];
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
    var dividers = document.querySelectorAll('.organic-divider[data-shape]');
    if (!dividers.length) { return; }
    dividers.forEach(function (d) {
      var shape = d.getAttribute('data-shape') || 'wave';
      var color = d.getAttribute('data-color') || 'rgba(201,214,223,0.08)';
      var height = d.getAttribute('data-height') || '60';
      var w = d.offsetWidth || window.innerWidth;
      var h = parseInt(height, 10);
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.height = h + 'px';
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var dStr = 'M0,' + h + ' ';
      var segs = 6;
      var segW = w / segs;
      for (var i = 0; i <= segs; i++) {
        var x = i * segW;
        var y = shape === 'curve' ? h * 0.5 + Math.sin(i * 1.2) * h * 0.35 : h * 0.3 + Math.cos(i * 0.9) * h * 0.25;
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
    var watermarks = document.querySelectorAll('[data-zen-kanji]');
    watermarks.forEach(function (el) {
      var kanji = el.getAttribute('data-zen-kanji');
      var pos = el.getAttribute('data-zen-pos') || 'left';
      el.textContent = kanji;
      el.className += ' zen-watermark zen-watermark--' + pos;
    });
    var headings = document.querySelectorAll('.zen-heading');
    headings.forEach(function (h) {
      h.classList.add('zen-heading');
    });
  }

  /* ─── 4. CONTAINER 3D SCROLL ─── */
  function initContainer3D() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) { return; }
    var frames = document.querySelectorAll('.container-frame');
    if (!frames.length) { return; }
    frames.forEach(function (frame) {
      var el3d = frame.querySelector('.container-3d');
      if (!el3d) { return; }
      frame.addEventListener('mousemove', function (e) {
        var rect = frame.getBoundingClientRect();
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var rX = ((my - cy) / cy) * -3;
        var rY = ((mx - cx) / cx) * 3;
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
    var grain = document.querySelector('.wabi-sabi-grain');
    if (!grain) { return; }
    // Auto dark mode support
    var hour = new Date().getHours();
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
