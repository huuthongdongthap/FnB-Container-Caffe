/**
 * shared-nav.js — Unified Navbar + Footer for all customer pages
 * Usage:
 *   import { initNavbar, initFooter } from './js/shared-nav.js';
 *   initNavbar('home'); // 'home'|'menu'|'reservation'|'checkout'|'contact'|'loyalty'|'track'|'about'
 *   initFooter();
 */

// ─── R1. Dynamic Real-time Hybrid Theme Mode IIFE ───
(function() {
  const savedOverride = sessionStorage.getItem('fnb_theme_override');
  let theme = 'dark'; // Fallback
  if (savedOverride === 'light' || savedOverride === 'dark') {
    theme = savedOverride;
  } else {
    // Calculate based on client current local time
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const startDay = 6 * 60; // 06:00
    const endDay = 18 * 60; // 18:00
    if (mins >= startDay && mins <= endDay) {
      theme = 'light';
    } else {
      theme = 'dark';
    }
  }
  document.documentElement.setAttribute('data-theme', theme);

  // Patch localStorage so any other legacy scripts align with our sessionStorage/time-based scheme
  try {
    const originalGet = localStorage.getItem;
    localStorage.getItem = function(key) {
      if (key === 'theme') {
        const override = sessionStorage.getItem('fnb_theme_override');
        if (override) {return override;}
        return theme;
      }
      return originalGet.apply(this, arguments);
    };
    const originalSet = localStorage.setItem;
    localStorage.setItem = function(key, val) {
      if (key === 'theme') {
        sessionStorage.setItem('fnb_theme_override', val);
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: val } }));
        return;
      }
      return originalSet.apply(this, arguments);
    };
  } catch(e) {
    console.warn('Storage patch failed', e);
  }
})();

const NAV_LINKS = [
  { label: 'Trang Chủ', href: 'index.html', key: 'home' },
  { label: 'Menu', href: 'menu.html', key: 'menu' },
  { label: 'Không Gian', href: 'index.html#spaces', key: 'spaces' },
  { label: 'Đặt Bàn', href: 'table-reservation.html', key: 'reservation' },
  { label: 'Loyalty', href: 'loyalty.html', key: 'loyalty' },
  { label: 'Khuyến Mãi', href: 'promotions.html', key: 'promotions' },
  { label: 'Liên Hệ', href: 'contact.html', key: 'contact' },
];

const MOBILE_EXTRA = [
  { label: 'Theo Dõi Đơn', href: 'track-order.html', key: 'track' },
  { label: 'About', href: 'about-us.html', key: 'about' },
];

const NAV_CSS = `
<style id="snav-style">
/* ── Shared Nav — scoped to #shared-navbar ── */
#shared-navbar .snav-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: background 0.3s, box-shadow 0.3s;
}
[data-theme="dark"] #shared-navbar .snav-header {
  background: rgba(10,10,10,0.72);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
#shared-navbar .snav-header.scrolled {
  background: rgba(255,255,255,0.97);
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
[data-theme="dark"] #shared-navbar .snav-header.scrolled {
  background: rgba(10,10,10,0.97);
}
#shared-navbar .snav-inner {
  max-width: 1200px; margin: 0 auto;
  padding: 0 1.5rem; height: 64px;
  display: flex; align-items: center; justify-content: space-between;
}
#shared-navbar .snav-logo {
  display: flex; align-items: center; gap: 0.5rem;
  text-decoration: none; color: var(--md-sys-color-on-surface,#1C1B1F);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700; font-size: 1.125rem; letter-spacing: 1.5px;
  flex-shrink: 0; max-width: calc(100% - 160px);
}
#shared-navbar .snav-logo img {
  max-height: 44px; height: auto; width: auto;
}
@media (max-width: 480px) {
  #shared-navbar .snav-logo img { max-height: 36px; }
  #shared-footer .snav-footer-brand .brand-name img { max-height: 36px !important; }
}
@media (max-width: 768px) {
  #shared-footer .snav-footer-brand .brand-name img { max-height: 44px !important; }
}
#shared-navbar .snav-desktop {
  display: flex; align-items: center;
  gap: clamp(0.75rem,2vw,1.5rem);
}
#shared-navbar .snav-link {
  text-decoration: none;
  color: var(--md-sys-color-on-surface,#1C1B1F);
  font-weight: 500; font-size: 0.875rem; white-space: nowrap;
  transition: color 0.2s;
  padding-bottom: 2px; border-bottom: 2px solid transparent;
}
#shared-navbar .snav-link:hover {
  color: var(--coffee-accent,#C9D6DF);
}
#shared-navbar .snav-link.nav-active {
  color: var(--coffee-accent,#C9D6DF);
  border-bottom-color: var(--coffee-accent,#C9D6DF);
}
#shared-navbar .snav-cta {
  background: var(--coffee-primary,#6F4E37);
  color: #fff !important; border-bottom: none !important;
  padding: 0.5rem 1.25rem; border-radius: 9999px;
  font-weight: 600; font-size: 0.875rem; text-decoration: none;
  transition: background 0.2s, transform 0.2s; white-space: nowrap;
  margin-left: 0.5rem;
}
#shared-navbar .snav-cta:hover {
  background: var(--coffee-dark,#3B2F2F); transform: translateY(-1px);
}
#shared-navbar .snav-theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--md-sys-color-on-surface,#1C1B1F);
  transition: background 0.2s, color 0.2s;
  margin-right: 0.25rem;
}
#shared-navbar .snav-theme-toggle:hover {
  background: rgba(0,0,0,0.06);
}
[data-theme="dark"] #shared-navbar .snav-theme-toggle:hover {
  background: rgba(255,255,255,0.08);
}
#shared-navbar .snav-theme-toggle svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
#shared-navbar .snav-theme-toggle:hover svg {
  transform: rotate(15deg);
}
#shared-navbar .snav-hamburger {
  display: none; flex-direction: column; gap: 5px;
  cursor: pointer; background: none; border: none;
  padding: 6px; margin-left: 0.5rem; flex-shrink: 0;
}
#shared-navbar .snav-hamburger span {
  display: block; width: 24px; height: 2px;
  background: var(--md-sys-color-on-surface,#1C1B1F);
  border-radius: 2px; transition: transform 0.3s, opacity 0.3s;
}
#shared-navbar .snav-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
#shared-navbar .snav-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
#shared-navbar .snav-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
/* Drawer */
#snav-drawer {
  position: fixed; top: 64px; left: 0; right: 0; z-index: 999;
  background: var(--md-sys-color-surface,#FFFBFE);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  transform: translateY(-110%);
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
  display: flex; flex-direction: column;
  padding: 1rem 1.5rem 1.5rem; gap: 0.125rem;
}
[data-theme="dark"] #snav-drawer { background: var(--md-sys-color-surface,#0A0A0A); }
#snav-drawer.open { transform: translateY(0); }
#snav-drawer .snav-mobile-link {
  text-decoration: none;
  color: var(--md-sys-color-on-surface,#1C1B1F);
  font-weight: 500; font-size: 1rem;
  padding: 0.75rem 0.75rem; border-radius: 8px;
  transition: background 0.15s;
}
#snav-drawer .snav-mobile-link:hover { background: var(--md-sys-color-surface-variant,#E7E0EC); }
#snav-drawer .snav-mobile-link.nav-active {
  color: var(--coffee-accent,#C9D6DF); font-weight: 600;
}
#snav-drawer .snav-mobile-cta {
  margin-top: 0.75rem;
  background: var(--coffee-primary,#6F4E37); color: #fff;
  padding: 0.875rem; border-radius: 9999px; text-align: center;
  font-weight: 600; font-size: 0.9rem; text-decoration: none;
  transition: background 0.2s;
}
#snav-drawer .snav-mobile-cta:hover { background: var(--coffee-dark,#3B2F2F); }
#snav-overlay {
  display: none; position: fixed; inset: 0; z-index: 998;
  background: rgba(0,0,0,0.3);
}
#snav-overlay.open { display: block; }
@media (max-width: 768px) {
  #shared-navbar .snav-desktop { display: none; }
  #shared-navbar .snav-hamburger { display: flex; }
}
</style>`;

const FOOTER_CSS = `
<style id="snav-footer-style">
/* ── Shared Footer ── */
#shared-footer .snav-footer {
  background: var(--coffee-dark,#3B2F2F);
  color: rgba(255,255,255,0.85);
  padding: 3rem 1.5rem 1.5rem;
}
#shared-footer .snav-footer-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr repeat(3,1fr);
  gap: 2rem 3rem;
}
#shared-footer .snav-footer-brand .brand-name {
  display: flex; align-items: center;
  font-family: 'Space Grotesk',sans-serif;
  font-weight: 700; font-size: 1.25rem; letter-spacing: 1.5px;
  color: #fff; margin-bottom: 0.375rem;
}
#shared-footer .snav-footer-brand p {
  font-size: 0.85rem; opacity: 0.65; margin-bottom: 1.25rem;
}
#shared-footer .snav-footer-brand .snav-social {
  display: flex;
  gap: 0.875rem;
  margin-top: 0.5rem;
}
#shared-footer .snav-footer-brand .snav-social a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
  transition: all 0.2s ease;
  text-decoration: none;
}
#shared-footer .snav-footer-brand .snav-social a:hover {
  background: rgba(255,255,255,0.15);
  color: var(--coffee-accent,#C9D6DF);
  transform: translateY(-2px);
}
#shared-footer .snav-footer-brand .snav-social a svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}
#shared-footer .snav-footer-col h5 {
  font-family: 'Space Grotesk',sans-serif;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 2px;
  text-transform: uppercase; color: var(--coffee-accent,#C9D6DF);
  margin-bottom: 1rem;
}
#shared-footer .snav-footer-col a {
  display: block; text-decoration: none;
  color: rgba(255,255,255,0.7);
  font-size: 0.875rem; padding: 0.3rem 0; transition: color 0.2s;
}
#shared-footer .snav-footer-col a:hover { color: #fff; }
#shared-footer .snav-footer-bottom {
  max-width: 1200px; margin: 2rem auto 0;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  text-align: center; font-size: 0.8rem; opacity: 0.55;
}
@media (max-width: 768px) {
  #shared-footer .snav-footer-grid {
    grid-template-columns: 1fr 1fr; gap: 2rem 1.5rem;
  }
  #shared-footer .snav-footer-brand { grid-column: 1 / -1; }
}
@media (max-width: 480px) {
  #shared-footer .snav-footer-grid { grid-template-columns: 1fr; }
}
</style>`;

function buildNavLinks(activePage, isMobile = false) {
  const links = isMobile ? [...NAV_LINKS, ...MOBILE_EXTRA] : NAV_LINKS;
  const cls = isMobile ? 'snav-mobile-link' : 'snav-link';
  return links.map(({ label, href, key }) => {
    const active = activePage === key ? ' nav-active' : '';
    return `<a href="${href}" class="${cls}${active}">${label}</a>`;
  }).join('\n      ');
}

function buildNavbar(activePage) {
  return `${NAV_CSS}
<header class="snav-header" id="snav-header">
  <div class="snav-inner">
    <a href="index.html" class="snav-logo">
      <img src="/images/logo-256.png" alt="AURA CAFE" style="height:40px;width:auto;max-height:40px;object-fit:contain;vertical-align:middle;" onerror="this.src='/images/logo-256.png'">
      <span>AURA CAFE</span>
    </a>
    <nav class="snav-desktop" aria-label="Navigation chính">
      ${buildNavLinks(activePage)}
    </nav>
    <div style="display:flex;align-items:center;flex-shrink:0;gap:0.25rem">
      <button id="snav-theme-toggle" class="snav-theme-toggle" aria-label="Chuyển chế độ sáng/tối">
        <!-- SVG injected dynamically -->
      </button>
      <a href="table-reservation.html" class="snav-cta">Đặt Bàn</a>
      <button class="snav-hamburger" id="snav-hamburger" aria-label="Mở menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>
<div id="snav-overlay" aria-hidden="true"></div>
<div id="snav-drawer" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
  ${buildNavLinks(activePage, true)}
  <a href="table-reservation.html" class="snav-mobile-cta">Đặt Bàn Ngay</a>
</div>`;
}

function buildFooter() {
  const fbSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>';
  const igSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';
  const ttSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>';
  const zlSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><path d="M9 9h6l-6 6h6"></path></svg>';

  return `${FOOTER_CSS}
<footer class="snav-footer">
  <div class="snav-footer-grid">
    <div class="snav-footer-brand">
      <div class="brand-name"><img src="/images/logo-256.png" alt="AURA CAFE" style="height:40px;width:auto;max-height:40px;object-fit:contain;vertical-align:middle;" onerror="this.src='/images/logo-256.png'">AURA CAFE</div>
      <p>Where Flavor Meets Design</p>
      <div class="snav-social">
        <a href="https://facebook.com/auracafesadec" target="_blank" rel="noopener noreferrer" aria-label="Theo dõi AURA CAFE trên Facebook">${fbSvg}</a>
        <a href="https://instagram.com/auracafesadec" target="_blank" rel="noopener noreferrer" aria-label="Theo dõi AURA CAFE trên Instagram">${igSvg}</a>
        <a href="https://tiktok.com/@auracafesadec" target="_blank" rel="noopener noreferrer" aria-label="Theo dõi AURA CAFE trên TikTok">${ttSvg}</a>
        <a href="https://zalo.me/0946013633" target="_blank" rel="noopener noreferrer" aria-label="Liên hệ AURA CAFE qua Zalo">${zlSvg}</a>
      </div>
    </div>
    <div class="snav-footer-col">
      <h5>Khám Phá</h5>
      <a href="menu.html">Menu</a>
      <a href="index.html#spaces">Không Gian</a>
      <a href="table-reservation.html">Đặt Bàn</a>
    </div>
    <div class="snav-footer-col">
      <h5>Thành Viên</h5>
      <a href="loyalty.html">Loyalty &amp; Cashback</a>
      <a href="track-order.html">Theo Dõi Đơn</a>
    </div>
    <div class="snav-footer-col">
      <h5>Hỗ Trợ &amp; Admin</h5>
      <a href="contact.html">Liên Hệ</a>
      <a href="about-us.html">About</a>
      <a href="/admin/dashboard.html">Admin Dashboard</a>
      <a href="kds.html">KDS</a>
    </div>
  </div>
  <div class="snav-footer-bottom">
    &copy; 2026 AURA CAFE &middot; Sa Đéc, Đồng Tháp &middot; fnbcontainer.vn v2.1.0
  </div>
</footer>`;
}

function initScrollEffect() {
  const header = document.getElementById('snav-header');
  if (!header) { return; }
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
  header.classList.toggle('scrolled', window.scrollY > 60);
}

function initHamburger() {
  const btn = document.getElementById('snav-hamburger');
  const drawer = document.getElementById('snav-drawer');
  const overlay = document.getElementById('snav-overlay');
  if (!btn || !drawer) { return; }

  const close = () => {
    btn.classList.remove('open');
    drawer.classList.remove('open');
    overlay && overlay.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    overlay && overlay.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  overlay && overlay.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) { close(); }
  });
}

function triggerThemeToast(theme) {
  const msg = theme === 'dark' ? 'Giao diện: Tối' : 'Giao diện: Sáng';
  if (typeof window.showToast === 'function') {
    window.showToast(msg, 'success');
  } else if (window.i18n && typeof window.i18n.showToast === 'function') {
    window.i18n.showToast(msg);
  } else {
    // Custom fallback mini-toast
    let toast = document.getElementById('snav-mini-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'snav-mini-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 10px 20px;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
        opacity: 0;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
    clearTimeout(window.snavToastTimeout);
    window.snavToastTimeout = setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      toast.style.opacity = '0';
    }, 2500);
  }
}

const SUN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

const MOON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

function initThemeToggleBehavior() {
  const btn = document.getElementById('snav-theme-toggle');
  if (!btn) {return;}

  const updateToggleUI = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    btn.innerHTML = currentTheme === 'light' ? MOON_SVG : SUN_SVG;

    // Sync other theme buttons if they exist
    const otherIcons = document.querySelectorAll('#themeToggle .theme-icon, #theme-toggle .material-symbols-outlined');
    otherIcons.forEach(icon => {
      icon.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
    });
  };

  updateToggleUI();

  btn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    sessionStorage.setItem('fnb_theme_override', newTheme);

    updateToggleUI();
    triggerThemeToast(newTheme);

    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: newTheme } }));
  });

  window.addEventListener('theme-changed', (e) => {
    if (e.detail && e.detail.theme) {
      updateToggleUI();
    }
  });
}

/**
 * Inject shared navbar into #shared-navbar.
 * @param {string} activePage — 'home'|'menu'|'reservation'|'checkout'|'contact'|'loyalty'|'track'|'about'|''
 */
export function initNavbar(activePage = '') {
  const el = document.getElementById('shared-navbar');
  if (!el) { return; }
  el.innerHTML = buildNavbar(activePage);
  if (!document.body.style.paddingTop) {
    document.body.style.paddingTop = '64px';
  }
  initScrollEffect();
  initHamburger();
  initThemeToggleBehavior();
}

/**
 * Inject shared footer into #shared-footer.
 */
export function initFooter() {
  const el = document.getElementById('shared-footer');
  if (!el) { return; }
  el.innerHTML = buildFooter();
}

