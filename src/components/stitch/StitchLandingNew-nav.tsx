import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { X, Menu, Lock } from 'lucide-react';

/** Top navigation bar for AURA Cafe landing page.
 *  - Desktop: horizontal links + CTA pill
 *  - Mobile:  hamburger button → full-screen slide-down drawer
 */
export function LandingNav() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  let pathname = '/';
  try {
    const loc = useLocation();
    pathname = loc.pathname;
  } catch {
    if (typeof window !== 'undefined') {
      pathname = window.location.pathname;
    }
  }

  const navLinks = [
    { href: '/menu', label: t('nav.menu', 'Thực đơn') },
    { href: '/table-reservation', label: t('landing.reservation', 'Đặt bàn') },
    { href: '/promotions', label: t('landing.promotions', 'Ưu đãi') },
    { href: '/about', label: t('landing.about', 'Giới thiệu') },
    { href: '/gallery', label: t('landing.gallery', 'Không gian') },
    { href: '/reviews', label: t('landing.reviews', 'Đánh giá') },
    { href: '/contact', label: t('landing.contact', 'Liên hệ') },
  ];

  /** Lock body scroll when drawer is open */
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  /** Close drawer on Escape key */
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerOpen]);

  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      {/* ── Top Bar ─────────────────────────────────────── */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed top-0 w-full z-50 flex justify-between items-center px-4 sm:px-8 lg:px-16 py-4 backdrop-blur-[12px] border-b border-[var(--aura-chrome-dim)]/30 bg-[#0A1A2E]/80"
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 group" onClick={closeDrawer}>
          <img
            src="/images/aura-emblem.png"
            alt="AURA CAFE Logo"
            className="h-10 w-10 rounded-full border border-[var(--aura-chrome-mid)]/40 object-cover filter drop-shadow-[0_0_10px_rgba(201,214,223,0.35)] transition-transform group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/aura-master-logo.png';
            }}
          />
          <div className="flex flex-col">
            <span
              className="tracking-tight"
              style={{
                fontFamily: 'var(--aura-font-display)',
                fontSize: '24px',
                lineHeight: '1.1',
                fontWeight: 600,
                color: 'var(--aura-chrome-bright)',
              }}
            >
              AURA CAFE
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#4A7C59] font-semibold">
              Sa Đéc • EST. 2018
            </span>
          </div>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`pb-1 text-base transition-all font-display ${
                isActive(link.href)
                  ? 'border-b-2 border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] font-semibold'
                  : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] font-medium'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA + Mobile hamburger row */}
        <div className="flex items-center gap-2.5">
          {/* Staff entry point — subtle, not customer-facing */}
          <a
            href="/portal"
            title="Dành cho nhân viên AURA CAFE"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border border-[var(--aura-chrome-mid)]/50 text-[var(--aura-chrome-soft)] text-[11px] font-medium hover:border-[var(--aura-chrome-bright)]/70 hover:text-[var(--aura-chrome-bright)] transition-all"
          >
            <Lock className="w-3 h-3" aria-hidden="true" />
            <span>Staff</span>
          </a>

          {/* Desktop CTA pill */}
          <a
            href="/menu"
            className="hidden md:inline-flex px-6 py-2.5 min-h-[44px] rounded-full active:opacity-80 active:scale-95 transition-all duration-300 items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(201,214,223,0.2)] bg-[var(--aura-chrome-bright)] text-[#0A1A2E] text-xs font-semibold tracking-wider uppercase font-body"
          >
            {t('landing.orderNow', 'Gọi món ngay')}
          </a>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={drawerOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={toggleDrawer}
            className="md:hidden flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg text-[var(--aura-chrome-bright)] hover:bg-white/10 transition-colors"
          >
            {drawerOpen ? (
              <X className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Menu className="w-6 h-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* ── Mobile Drawer ────────────────────────────────── */}
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer panel */}
      <div
        id="mobile-nav-drawer"
        role="dialog"
        aria-label="Menu điều hướng"
        aria-modal="true"
        className={`fixed top-[72px] inset-x-0 z-40 md:hidden transition-all duration-300 ease-out ${
          drawerOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div
          className="mx-4 rounded-2xl overflow-hidden border border-[var(--aura-chrome-dim)]/30 shadow-2xl"
          style={{
            background: 'rgba(10, 26, 46, 0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Nav links */}
          <nav aria-label="Menu điều hướng mobile" className="flex flex-col px-2 py-3">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeDrawer}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl text-base font-medium transition-all active:scale-[0.98] ${
                  isActive(link.href)
                    ? 'bg-white/10 text-[var(--aura-chrome-bright)] font-semibold'
                    : 'text-[var(--aura-chrome-soft)] hover:bg-white/5 hover:text-[var(--aura-chrome-bright)]'
                }`}
                style={{
                  fontFamily: 'var(--aura-font-body)',
                  animationDelay: drawerOpen ? `${i * 40}ms` : '0ms',
                }}
              >
                {/* Active indicator */}
                <span
                  className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${
                    isActive(link.href)
                      ? 'bg-[var(--aura-chrome-bright)]'
                      : 'bg-[var(--aura-chrome-dim)]'
                  }`}
                  aria-hidden="true"
                />
                {link.label}
              </a>
            ))}
          </nav>

          {/* Divider */}
          <div
            className="mx-5 border-t"
            style={{ borderColor: 'rgba(201,214,223,0.15)' }}
          />

          {/* Mobile CTA */}
          <div className="px-5 py-4">
            <a
              href="/menu"
              onClick={closeDrawer}
              className="flex items-center justify-center w-full py-3.5 min-h-[44px] rounded-xl bg-[var(--aura-chrome-bright)] text-[#0A1A2E] text-sm font-bold tracking-wider uppercase font-body transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(201,214,223,0.25)]"
            >
              {t('landing.orderNow', 'Gọi món ngay')} →
            </a>
          </div>

          {/* Branding footer */}
          <div
            aria-hidden="true"
            className="px-5 pb-5 pt-1 text-center text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: 'var(--aura-chrome-dim, rgba(201,214,223,0.4))' }}
          >
            AURA CAFE — Sa Đéc, Đồng Tháp
          </div>
        </div>
      </div>
    </>
  );
}
