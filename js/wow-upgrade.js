/* ═══════════════════════════════════════════════════════════════════════════════
   WOW UPGRADE v2.2 — Bazi-aligned 2026 F&B UI/UX Interactions
   Sources: cafe3d (GSAP-free stagger + parallax), mazer (glightbox logic),
            saas-boiler (feature card hover), cruip (shine sweep)
   ═══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── 1. MOUSE PARALLAX for ambient orbs (from cafe3d) ─── */
  function initMouseParallax() {
    const orbs = document.querySelectorAll('.ambient-orb[data-speed]');
    if (!orbs.length) {return;}
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {return;}
    const hero = document.getElementById('hero') || document.querySelector('.hero-v8');
    if (!hero) {return;}

    hero.addEventListener('mousemove', function (e) {
      const rect = hero.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      orbs.forEach(function (orb) {
        const speed = parseFloat(orb.getAttribute('data-speed')) || 0.15;
        const dx = ((mx - cx) / cx) * speed * 40;
        const dy = ((my - cy) / cy) * speed * 40;
        orb.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      });
    });
    hero.addEventListener('mouseleave', function () {
      orbs.forEach(function (orb) {
        orb.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        orb.style.transform = 'translate3d(0,0,0)';
        setTimeout(function () { orb.style.transition = ''; }, 600);
      });
    });
  }

  /* ─── 2. STAGGER ENTRANCE via IntersectionObserver ─── */
  function initStaggerEntrance() {
    const targets = document.querySelectorAll('.stagger-in');
    if (!targets.length) {return;}
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { obs.observe(el); });
  }

  /* ─── 3. FEATURE CARD TILT with shine (cruip + wow-engine hybrid) ─── */
  function initFeatureTilt() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {return;}
    const cards = document.querySelectorAll('.feature-card-wow, .menu-card-wow.tilt-card-wow, .tilt-card-wow');
    if (!cards.length) {return;}
    cards.forEach(function (card) {
      if (!card.querySelector('.tilt-shine')) {
        const shine = document.createElement('div');
        shine.className = 'tilt-shine';
        card.appendChild(shine);
      }
      card.addEventListener('mousemove', function (e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xPct = (x / rect.width) * 100;
        const yPct = (y / rect.height) * 100;
        const tiltX = ((y / rect.height) - 0.5) * -6;
        const tiltY = ((x / rect.width) - 0.5) * 6;
        card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg) translateY(-4px)';
        card.style.setProperty('--shine-x', xPct + '%');
        card.style.setProperty('--shine-y', yPct + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        setTimeout(function () { card.style.transition = ''; }, 500);
      });
    });
  }

  /* ─── 4. ENHANCED COUNTER ANIMATION ─── */
  function initCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    if (!counters.length) {return;}
    let animated = false;
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !animated) {
          animated = true;
          counters.forEach(function (el) {
            const target = parseInt(el.getAttribute('data-target'), 10);
            const suffix = el.getAttribute('data-suffix') || '';
            const duration = 1800;
            let start = null;
            function step(ts) {
              if (!start) {start = ts;}
              const p = Math.min((ts - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              el.textContent = Math.round(eased * target) + suffix;
              if (p < 1) {requestAnimationFrame(step);}
            }
            requestAnimationFrame(step);
          });
          obs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    const section = document.getElementById('stats');
    if (section) {obs.observe(section);}
  }

  /* ─── 5. GALLERY LIGHTBOX (mazer glightbox-lite — zero-dep) ─── */
  function initGalleryLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item[data-full-img]');
    if (!galleryItems.length) {return;}
    const overlay = document.createElement('div');
    overlay.className = 'wow-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Image viewer');
    overlay.innerHTML =
      '<button class="wow-lightbox__close" aria-label="Close viewer">&times;</button>' +
      '<img class="wow-lightbox__img" src="" alt="" />';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(5,13,26,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);align-items:center;justify-content:center;cursor:pointer;';
    const img = overlay.querySelector('.wow-lightbox__img');
    const close = overlay.querySelector('.wow-lightbox__close');
    close.style.cssText = 'position:absolute;top:20px;right:24px;font-size:2rem;color:#C9D6DF;background:none;border:none;cursor:pointer;z-index:1;';
    document.body.appendChild(overlay);
    function openLightbox(src, alt) {
      img.src = src; img.alt = alt || '';
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      overlay.style.display = 'none'; img.src = '';
      document.body.style.overflow = '';
    }
    galleryItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const src = item.getAttribute('data-full-img') || item.querySelector('img')?.src || '';
        const alt = item.getAttribute('data-caption') || item.querySelector('img')?.alt || '';
        if (src) {openLightbox(src, alt);}
      });
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target === close) {closeLightbox();}
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.style.display === 'flex') {closeLightbox();}
    });
  }

  /* ─── 6. SHINE SWEEP ON CTA BUTTONS (cruip-inspired) ─── */
  function initShineButtons() {
    document.querySelectorAll('.btn-primary.glow-primary, .btn-brand-primary').forEach(function (btn) {
      btn.classList.add('btn-shine');
    });
  }

  /* ─── BOOT ─── */
  function boot() {
    initMouseParallax();
    initStaggerEntrance();
    initFeatureTilt();
    initCounters();
    initGalleryLightbox();
    initShineButtons();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
