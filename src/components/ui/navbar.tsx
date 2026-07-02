import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Monitor, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const NAV_ITEMS = [
  { label: 'Thực đơn', to: '/menu' },
  { label: 'Không gian', to: '/about' },
  { label: 'Khuyến mãi', to: '/promotions' },
  { label: 'Đặt bàn', to: '/table-reservation' },
  { label: 'Đánh giá', to: '/reviews' },
  { label: 'Thuê Container', to: '/subscriptions' },
  { label: 'Tra cứu', to: '/track-order' },
] as const;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff' || user?.role === 'owner';

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
          ? 'border-b border-[var(--aura-border-chrome)] bg-[var(--aura-noir-deep)]/90 shadow-lg backdrop-blur-xl'
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
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  'relative px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'after:absolute after:bottom-0.5 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:transition-all after:duration-300',
                  'hover:after:w-3/5',
                  scrolled
                    ? 'text-[var(--aura-text-body)] hover:text-[var(--aura-chrome-bright)] after:bg-[var(--aura-chrome-light)]'
                    : 'text-white/75 hover:text-white after:bg-white',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
          {isStaff && (
            <li>
              <Link
                to="/kds"
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'after:absolute after:bottom-0.5 after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:transition-all after:duration-300',
                  'hover:after:w-3/5',
                  scrolled
                    ? 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] after:bg-[var(--aura-chrome-light)]'
                    : 'text-white/75 hover:text-white after:bg-white',
                )}
              >
                <Monitor className="h-4 w-4" />
                KDS
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
                    ? 'text-[var(--aura-chrome-light)] hover:text-[var(--aura-chrome-bright)] after:bg-[var(--aura-chrome-light)]'
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
        <div className="hidden md:block">
          <Link to="/menu" className="fnb-btn-glow !gap-1.5 !rounded-full !px-5 !py-2 !text-xs">
            Đặt món ngay
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className={cn(
            'md:hidden rounded-lg p-2 transition-colors',
            scrolled ? 'text-[var(--aura-text-primary)]' : 'text-white',
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
          'border-[var(--aura-border-chrome)] bg-[var(--aura-noir-deep)] shadow-2xl',
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
              className="rounded-lg px-4 py-3 text-base font-medium text-[var(--aura-text-body)] transition-colors hover:bg-white/5 hover:text-[var(--aura-chrome-bright)]"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isStaff && (
            <Link
              to="/kds"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[var(--aura-chrome-mid)] transition-colors hover:bg-white/5 hover:text-[var(--aura-chrome-bright)]"
              onClick={() => setMobileOpen(false)}
            >
              <Monitor className="h-4 w-4" />
              KDS
            </Link>
          )}
          {user && (
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[var(--aura-chrome-light)] transition-colors hover:bg-white/5 hover:text-[var(--aura-chrome-bright)]"
              onClick={() => setMobileOpen(false)}
            >
              <User className="h-4 w-4" />
              {user.name}
            </Link>
          )}

          {/* Mobile CTA */}
          <div className="mt-6">
            <Link
              to="/menu"
              className="fnb-btn-glow w-full justify-center !rounded-full !text-sm"
              onClick={() => setMobileOpen(false)}
            >
              Đặt món ngay
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
