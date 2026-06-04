/* ═══════════════════════════════════════════════════════════════════════════════
   WOW ENGINE v2.0 — 2026 F&B UI/UX Trends
   parallax · magnetic · counters · cursor-glow · kinetic-text · scroll-progress
   ═══════════════════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ─── 1. SCROLL PROGRESS BAR ─── */
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          bar.style.width = pct + '%';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ─── 2. CURSOR GLOW FOLLOWER ─── */
  function initCursorGlow() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    var mx = -500, my = -500;
    var cx = -500, cy = -500;
    var active = false;

    document.addEventListener('mousemove', function(e) {
      mx = e.clientX; my = e.clientY;
      if (!active) { glow.classList.add('active'); active = true; }
    });

    document.addEventListener('mouseleave', function() {
      glow.classList.remove('active'); active = false;
    });

    function animate() {
      cx += (mx - cx) * 0.08;
      cy += (my - cy) * 0.08;
      glow.style.left = cx + 'px';
      glow.style.top = cy + 'px';
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  /* ─── 3. MAGNETIC BUTTONS ─── */
  function initMagneticButtons() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    var btns = document.querySelectorAll('.magnetic-btn, .btn-primary, .glow-primary');
    btns.forEach(function(btn) {
      btn.style.position = btn.style.position || 'relative';

      btn.addEventListener('mousemove', function(e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = 'translate(' + (x * 0.15) + 'px, ' + (y * 0.15) + 'px)';
        btn.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
        btn.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
      });

      btn.addEventListener('mouseleave', function() {
        btn.style.transform = '';
      });
    });
  }

  /* ─── 4. PARALLAX DEPTH ─── */
  function initParallax() {
    var layers = document.querySelectorAll('.parallax-layer, .ambient-orb, .particle');
    if (!layers.length) return;

    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var scrollY = window.pageYOffset;
          layers.forEach(function(el) {
            var speed = parseFloat(el.dataset.speed) || 0.3;
            var yOff = scrollY * speed;
            el.style.transform = 'translate3d(0,' + yOff + 'px,0)';
          });
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ─── 5. ENHANCED COUNTER ANIMATION ─── */
  function initCounters() {
    var counters = document.querySelectorAll('.stat-number[data-target]');
    if (!counters.length) return;

    var animated = false;
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !animated) {
          animated = true;
          counters.forEach(function(el) {
            el.classList.add('counter-animated', 'counting');
            var target = parseInt(el.dataset.target, 10);
            var suffix = el.dataset.suffix || '';
            var dur = 1800;
            var start = null;

            function step(ts) {
              if (!start) start = ts;
              var p = Math.min((ts - start) / dur, 1);
              // ease-out cubic
              var eased = 1 - Math.pow(1 - p, 3);
              var current = Math.round(eased * target);
              el.textContent = current + suffix;
              if (p < 1) {
                requestAnimationFrame(step);
              } else {
                el.classList.remove('counting');
              }
            }
            requestAnimationFrame(step);
          });
          obs.disconnect();
        }
      });
    }, { threshold: 0.3 });

    var section = document.getElementById('stats');
    if (section) obs.observe(section);
  }

  /* ─── 6. 3D TILT CARDS ─── */
  function initTiltCards() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    var cards = document.querySelectorAll('.tilt-card, .menu-card-enhanced, .space-card-enhanced');
    cards.forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;
        var tiltX = (y - 0.5) * -8;
        var tiltY = (x - 0.5) * 8;
        card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg) translateY(-4px)';
      });

      card.addEventListener('mouseleave', function() {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        setTimeout(function() { card.style.transition = ''; }, 500);
      });
    });
  }

  /* ─── 7. NAV SCROLL EFFECT ─── */
  function initNavScroll() {
    var nav = document.querySelector('.site-nav, nav[data-nav]');
    if (!nav) return;

    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          if (window.pageYOffset > 60) {
            nav.classList.add('nav-scrolled');
          } else {
            nav.classList.remove('nav-scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ─── 8. KINETIC HEADING SPLIT ─── */
  function initKineticHeadings() {
    var headings = document.querySelectorAll('.kinetic-heading');
    if (!headings.length) return;

    headings.forEach(function(h) {
      var text = h.textContent.trim();
      h.textContent = '';
      h.setAttribute('aria-label', text);

      var chars = text.split('');
      chars.forEach(function(ch, i) {
        var span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch === ' ' ? ' ' : ch;
        span.style.transitionDelay = (i * 0.03) + 's';
        h.appendChild(span);
      });
    });

    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    headings.forEach(function(h) { obs.observe(h); });
  }

  /* ─── 9. TICKER DUP (duplicate content for seamless loop) ─── */
  function initTicker() {
    var tracks = document.querySelectorAll('.fnb-ticker__track');
    tracks.forEach(function(track) {
      track.innerHTML += track.innerHTML;
    });
  }

  /* ─── 10. STAGGER REVEAL FOR CHILDREN ─── */
  function initStaggerReveal() {
    var containers = document.querySelectorAll('.stagger-reveal');
    containers.forEach(function(container) {
      var children = container.children;
      for (var i = 0; i < children.length; i++) {
        children[i].style.animationDelay = (i * 0.08) + 's';
      }
    });
  }

  /* ─── BOOT ─── */
  function boot() {
    initScrollProgress();
    initCursorGlow();
    initMagneticButtons();
    initParallax();
    initCounters();
    initTiltCards();
    initNavScroll();
    initKineticHeadings();
    initTicker();
    initStaggerReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
