import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { SiteHeader } from '../stitch-container-new2-site-header';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'common.mainNavigation': 'Main Navigation',
        'containerNew2.brandName': 'AURA CAFE',
        'containerNew2.reservation': 'Book a Table',
        'containerNew2.reservationAria': 'Book a Table',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

const NAV_LINKS = [
  { id: 'home', label: 'Home', href: '#', isActive: true },
  { id: 'menu', label: 'Menu', href: '#menu' },
  { id: 'location', label: 'Location', href: '#location' },
];

describe('SiteHeader', () => {
  it('renders brand name', () => {
    renderWithProviders(<SiteHeader navLinks={NAV_LINKS} />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders all nav links', () => {
    renderWithProviders(<SiteHeader navLinks={NAV_LINKS} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
  });

  it('marks active link with aria-current', () => {
    renderWithProviders(<SiteHeader navLinks={NAV_LINKS} />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink?.getAttribute('aria-current')).toBe('page');
  });

  it('calls onNavClick when nav link clicked', () => {
    const onNavClick = vi.fn();
    renderWithProviders(<SiteHeader navLinks={NAV_LINKS} onNavClick={onNavClick} />);
    screen.getByText('Menu').click();
    expect(onNavClick).toHaveBeenCalledWith('menu');
  });

  it('calls onReservation when reservation button clicked', () => {
    const onReservation = vi.fn();
    renderWithProviders(<SiteHeader navLinks={NAV_LINKS} onReservation={onReservation} />);
    screen.getByText('Book a Table').click();
    expect(onReservation).toHaveBeenCalledOnce();
  });
});
