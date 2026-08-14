import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import StitchHeader from '../StitchHeader';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, fallback?: string) => {
      const map: Record<string, string> = {
        'nav.menu': 'Menu',
        'nav.spaces': 'Spaces',
        'nav.reservations': 'Reservations',
        'nav.promotions': 'Promotions',
        'nav.reviews': 'Reviews',
        'nav.trackOrder': 'Track Order',
        'nav.events': 'Events',
        'nav.loyalty': 'Loyalty',
        'nav.referral': 'Referral',
        'nav.contact': 'Contact',
        'nav.openMenu': 'Open menu',
        'nav.closeMenu': 'Close menu',
        'nav.bookNow': 'Order Now',
      };
      return map[key ?? ''] ?? fallback ?? key ?? '';
    },
  }),
}));

describe('StitchHeader', () => {
  it('renders the brand name', () => {
    renderWithProviders(<StitchHeader />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders all 10 nav links', () => {
    renderWithProviders(<StitchHeader />);
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Spaces')).toBeTruthy();
    expect(screen.getByText('Reservations')).toBeTruthy();
    expect(screen.getByText('Promotions')).toBeTruthy();
    expect(screen.getByText('Reviews')).toBeTruthy();
    expect(screen.getByText('Track Order')).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
    expect(screen.getByText('Loyalty')).toBeTruthy();
    expect(screen.getByText('Referral')).toBeTruthy();
    expect(screen.getByText('Contact')).toBeTruthy();
  });

  it('has accessible nav landmark', () => {
    renderWithProviders(<StitchHeader />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  });

  it('renders brand as a link to home', () => {
    renderWithProviders(<StitchHeader />);
    const brandLink = screen.getByText('AURA CAFE').closest('a');
    expect(brandLink?.getAttribute('href')).toBe('/');
  });

  it('toggles mobile menu on hamburger click', () => {
    renderWithProviders(<StitchHeader />);
    const menuButton = screen.getByRole('button', { name: /Open menu|Close menu/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });
});
