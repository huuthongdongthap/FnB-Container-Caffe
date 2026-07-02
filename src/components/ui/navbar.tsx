import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const NAV_ITEMS = [
  { label: 'Thực đơn', to: '/menu' },
  { label: 'Không gian', to: '/about-us' },
  { label: 'Khuyến mãi', to: '/promotions' },
  { label: 'Đặt bàn', to: '/table-reservation' },
  { label: 'Tra cứu', to: '/track-order' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Primary">
        {/* Logo */}
        <Link to="/" className="font-display text-2xl font-bold tracking-tight text-primary">
          AURA<span className="text-accent-warm">CAFE</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-accent-warm"
              >
                {item.label}
              </Link>
            </li>
          ))}
          {user && (
            <li>
              <Link
                to="/account"
                className="flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-warm"
              >
                <User className="h-4 w-4" />
                {user.name}
              </Link>
            </li>
          )}
        </ul>

        {/* CTA */}
        <div className="hidden md:block">
          <Link to="/menu">
            <Button size="sm">Đặt món ngay</Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden rounded-lg p-2 text-foreground hover:bg-muted/20"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-72 transform border-l border-border bg-background shadow-xl transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex flex-col gap-2 p-6 pt-20">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-3 text-base font-medium hover:bg-muted/20"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-accent hover:bg-muted/20"
              onClick={() => setMobileOpen(false)}
            >
              <User className="h-4 w-4" />
              {user.name}
            </Link>
          )}
          <div className="mt-4">
            <Link to="/menu" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Đặt món ngay</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
