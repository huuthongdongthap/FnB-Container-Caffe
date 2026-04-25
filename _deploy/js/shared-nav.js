/**
 * shared-nav.js — Unified Navbar + Footer for all customer pages
 * Usage:
 *   import { initNavbar, initFooter } from './js/shared-nav.js';
 *   initNavbar('home'); // 'home'|'menu'|'reservation'|'checkout'|'contact'|'loyalty'|'track'|'about'
 *   initFooter();
 */

const NAV_LINKS = [
  { label: 'Trang Chủ', href: 'index.html', key: 'home' },
  { label: 'Menu', href: 'menu.html', key: 'menu' },
  { label: 'Không Gian', href: 'index.html#spaces', key: 'spaces' },
  { label: 'Đặt Bàn', href: 'table-reservation.html', key: 'reservation' },
  { label: 'Loyalty', href: 'loyalty.html', key: 'loyalty' },
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
  flex-shrink: 0;
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
  color: var(--coffee-accent,#C9A962);
}
#shared-navbar .snav-link.nav-active {
  color: var(--coffee-accent,#C9A962);
  border-bottom-color: var(--coffee-accent,#C9A962);
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
  color: var(--coffee-accent,#C9A962); font-weight: 600;
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
  font-family: 'Space Grotesk',sans-serif;
  font-weight: 700; font-size: 1.25rem; letter-spacing: 1.5px;
  color: #fff; margin-bottom: 0.375rem;
}
#shared-footer .snav-footer-brand p {
  font-size: 0.85rem; opacity: 0.65; margin-bottom: 1.25rem;
}
#shared-footer .snav-footer-brand .snav-social { display: flex; gap: 0.875rem; }
#shared-footer .snav-footer-brand .snav-social a {
  font-size: 1.25rem; text-decoration: none;
  opacity: 0.75; transition: opacity 0.2s;
}
#shared-footer .snav-footer-brand .snav-social a:hover { opacity: 1; }
#shared-footer .snav-footer-col h5 {
  font-family: 'Space Grotesk',sans-serif;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 2px;
  text-transform: uppercase; color: var(--coffee-accent,#C9A962);
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
      <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none">
        <circle cx="24" cy="24" r="22" fill="var(--coffee-primary,#6F4E37)" opacity="0.18"/>
        <path d="M16 30c2-6 6-10 8-14 2 4 6 8 8 14" stroke="var(--coffee-primary,#6F4E37)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="24" cy="17" r="3" fill="var(--coffee-accent,#C9A962)"/>
      </svg>
      AURA SPACE
    </a>
    <nav class="snav-desktop" aria-label="Navigation chính">
      ${buildNavLinks(activePage)}
    </nav>
    <div style="display:flex;align-items:center;flex-shrink:0">
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
  return `${FOOTER_CSS}
<footer class="snav-footer">
  <div class="snav-footer-grid">
    <div class="snav-footer-brand">
      <div class="brand-name">AURA SPACE</div>
      <p>Where Flavor Meets Design</p>
      <div class="snav-social">
        <a href="#" aria-label="Facebook">📘</a>
        <a href="#" aria-label="Instagram">📷</a>
        <a href="#" aria-label="TikTok">🎵</a>
        <a href="#" aria-label="Zalo">💬</a>
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
    &copy; 2026 AURA SPACE &middot; Sa Đéc, Đồng Tháp &middot; fnbcontainer.vn v2.1.0
  </div>
</footer>`;
}

function initScrollEffect() {
  const header = document.getElementById('snav-header');
  if (!header) { return; }
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
  // Set initial state
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

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) { close(); }
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
  // Push page content below fixed 64px navbar (unless page already handles it)
  if (!document.body.style.paddingTop) {
    document.body.style.paddingTop = '64px';
  }
  initScrollEffect();
  initHamburger();
}

/**
 * Inject shared footer into #shared-footer.
 */
export function initFooter() {
  const el = document.getElementById('shared-footer');
  if (!el) { return; }
  el.innerHTML = buildFooter();
}
