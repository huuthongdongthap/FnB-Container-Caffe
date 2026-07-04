import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Monitor, User, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useTranslation } from 'react-i18next';

export interface StitchHeaderProps {
  /** @deprecated No longer used — logo is rendered as chrome gradient text */
  logoSrc?: string;
}

const NAV_ITEMS = [
  { label: 'Thực đơn', to: '/menu' },
  { label: 'Không gian', to: '/about' },
  { label: 'Đặt bàn', to: '/table-reservation' },
  { label: 'Khuyến mãi', to: '/promotions' },
  { label: 'Đánh giá', to: '/reviews' },
  { label: 'Thuê Container', to: '/subscriptions' },
  { label: 'Tra cứu', to: '/track-order' },
  { label: 'Sự kiện', to: '/events' },
  { label: 'TV Menu', to: '/tv-menu' },
] as const;

export default function StitchHeader(_props: StitchHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff' || user?.role === 'owner';
  const { i18n } = useTranslation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-all duration-500',
        scrolled
          ? 'border-b border-[#44474d]/30 bg-[#0A1A2E]/90 shadow-lg backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"
        aria-label="Primary"
      >
        {/* Logo -- chrome gradient */}
        <Link to="/" className="text-gradient font-display text-2xl font-bold tracking-wide">
          AURA CAFE
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative px-3 py-2 text-sm font-medium transition-colors duration-200',
                    'after:absolute after:bottom-0.5 after:left-1/2 after:h-[2px] after:-translate-x-1/2 after:rounded-full after:transition-all after:duration-300',
                    active
                      ? scrolled
                        ? 'text-[#b8c7e2] after:w-3/5 after:bg-[#b8c7e2]'
                        : 'text-white after:w-3/5 after:bg-white'
                      : 'hover:after:w-3/5',
                    !active && (scrolled
                      ? 'text-[#c5c6cd] hover:text-[#b8c7e2] after:bg-[#b8c7e2]'
                      : 'text-white/75 hover:text-white after:bg-white'),
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          {isStaff && (
            <li>
              <Link
                to="/kds"
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'after:absolute after:bottom-0.5 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:transition-all after:duration-300',
                  'hover:after:w-3/5',
                  scrolled
                    ? 'text-[#c5c6cd] hover:text-[#b8c7e2] after:bg-[#b8c7e2]'
                    : 'text-white/75 hover:text-white after:bg-white',
                )}
              >
                <Monitor className="h-4 w-4" />
                KDS
              </Link>
            </li>
          )}
          {isStaff && (
            <li>
              <Link
                to="/admin/sales-reports"
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'after:absolute after:bottom-0.5 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:transition-all after:duration-300',
                  'hover:after:w-3/5',
                  scrolled
                    ? 'text-[#c5c6cd] hover:text-[#b8c7e2] after:bg-[#b8c7e2]'
                    : 'text-white/75 hover:text-white after:bg-white',
                )}
              >
                <BarChart3 className="h-4 w-4" />
                Sales / Báo Cáo
              </Link>
            </li>
          )}
          {user && (
            <li>
              <Link
                to="/account"
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'after:absolute after:bottom-0.5 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:transition-all after:duration-300',
                  'hover:after:w-3/5',
                  scrolled
                    ? 'text-[#c5c6cd] hover:text-[#b8c7e2] after:bg-[#b8c7e2]'
                    : 'text-white/75 hover:text-white after:bg-white',
                )}
              >
                <User className="h-4 w-4" />
                {user.name}
              </Link>
            </li>
          )}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center">
          <Link
            to="/table-reservation"
            className="bg-gradient-to-br from-[#e0e0e0] via-[#a0a0a0] to-[#c0c0c0] text-black text-sm tracking-[0.1em] font-semibold px-6 py-3 font-body hover:opacity-80 transition-opacity inline-block"
          >
            Đặt Bàn Ngay
          </Link>
          {/* Language switcher */}
          <button
            onClick={() => i18n.changeLanguage(i18n.language?.startsWith('en') ? 'vi' : 'en')}
            className={cn(
              'ml-3 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded border transition-colors',
              scrolled
                ? 'border-[#44474d]/30 text-[#c5c6cd] hover:bg-white/5'
                : 'border-white/30 text-white/75 hover:bg-white/10',
            )}
            aria-label="Switch language"
          >
            {i18n.language?.startsWith('en') ? 'VN' : 'EN'}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className={cn(
            'md:hidden rounded-lg p-2 transition-colors active:scale-[0.97]',
            scrolled ? 'text-[#b8c7e2]' : 'text-white',
          )}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile drawer -- slide from right */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-72 transform border-l transition-transform duration-300 ease-out md:hidden',
          'border-[#44474d]/30 bg-[#0A1A2E] shadow-2xl',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-full flex-col gap-1 overflow-y-auto p-6 pt-20">
          {/* Logo inside drawer */}
          <Link
            to="/"
            className="text-gradient font-display mb-6 text-2xl font-bold tracking-wide"
            onClick={() => setMobileOpen(false)}
          >
            AURA CAFE
          </Link>

          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-3 text-base font-medium text-[#c5c6cd] transition-colors hover:bg-white/5 hover:text-[#b8c7e2]"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isStaff && (
            <Link
              to="/kds"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[#c5c6cd] transition-colors hover:bg-white/5 hover:text-[#b8c7e2]"
              onClick={() => setMobileOpen(false)}
            >
              <Monitor className="h-4 w-4" />
              KDS
            </Link>
          )}
          {isStaff && (
            <Link
              to="/admin/sales-reports"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[#c5c6cd] transition-colors hover:bg-white/5 hover:text-[#b8c7e2]"
              onClick={() => setMobileOpen(false)}
            >
              <BarChart3 className="h-4 w-4" />
              Sales / Báo Cáo
            </Link>
          )}
          {user && (
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[#b8c7e2] transition-colors hover:bg-white/5 hover:text-[#b8c7e2]"
              onClick={() => setMobileOpen(false)}
            >
              <User className="h-4 w-4" />
              {user.name}
            </Link>
          )}

          {/* Mobile language switcher */}
          <button
            onClick={() => i18n.changeLanguage(i18n.language?.startsWith('en') ? 'vi' : 'en')}
            className="mx-4 mt-4 mb-2 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded border border-[#44474d]/30 text-[#c5c6cd] hover:bg-white/5 transition-colors self-start"
            aria-label="Switch language"
          >
            {i18n.language?.startsWith('en') ? 'VN' : 'EN'}
          </button>

          {/* Mobile CTA */}
          <div className="mt-6">
            <Link
              to="/table-reservation"
              className="bg-gradient-to-br from-[#e0e0e0] via-[#a0a0a0] to-[#c0c0c0] text-black w-full justify-center flex text-sm tracking-[0.1em] font-semibold px-6 py-3 font-body hover:opacity-80 transition-opacity"
              onClick={() => setMobileOpen(false)}
            >
              Đặt Bàn Ngay
            </Link>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
