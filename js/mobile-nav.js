/**
 * AURA CAFE · Mobile Navigation
 * Phase 4 — Hamburger menu drawer with full a11y
 */
(function () {
  'use strict';

  function init() {
    var burger = document.querySelector('.navbar-hamburger');
    var menu = document.querySelector('.navbar-mobile-menu');
    var backdrop = document.querySelector('.navbar-mobile-backdrop');

    if (!burger || !menu) return;

    // Ensure backdrop exists (auto-create if missing)
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'navbar-mobile-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    function openMenu() {
      menu.classList.add('open');
      backdrop.classList.add('show');
      burger.classList.add('active');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      // Focus first link for keyboard users
      var firstLink = menu.querySelector('a');
      if (firstLink) setTimeout(function () { firstLink.focus(); }, 350);
    }

    function closeMenu() {
      menu.classList.remove('open');
      backdrop.classList.remove('show');
      burger.classList.remove('active');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    function toggleMenu() {
      if (menu.classList.contains('open')) closeMenu();
      else openMenu();
    }

    // Init ARIA
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'navbar-mobile-menu');
    burger.setAttribute('aria-label', 'Mở menu');
    if (!menu.id) menu.id = 'navbar-mobile-menu';
    menu.setAttribute('aria-hidden', 'false');

    // Click hamburger
    burger.addEventListener('click', toggleMenu);

    // Click backdrop closes menu
    backdrop.addEventListener('click', closeMenu);

    // Close when clicking any link inside drawer
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });

    // ESC key closes menu
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        closeMenu();
        burger.focus();
      }
    });

    // Close on window resize to desktop
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.innerWidth > 900 && menu.classList.contains('open')) {
          closeMenu();
        }
      }, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
