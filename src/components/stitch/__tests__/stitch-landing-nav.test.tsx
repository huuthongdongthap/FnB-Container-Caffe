import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { LandingNav } from '../StitchLandingNew-nav';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key?: string, fallback?: string) => fallback ?? _key ?? '',
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useLocation: () => ({ pathname: '/' }),
  };
});

vi.mock('lucide-react', () => ({
  Menu: ({ 'aria-hidden': _h, ...rest }: Record<string, unknown>) => (
    <svg data-testid="icon-menu" {...rest} />
  ),
  X: ({ 'aria-hidden': _h, ...rest }: Record<string, unknown>) => (
    <svg data-testid="icon-close" {...rest} />
  ),
  Lock: () => null,
}));

describe('LandingNav', () => {
  it('renders logo and desktop nav links', () => {
    renderWithProviders(<LandingNav />);
    expect(screen.getAllByText('AURA CAFE').length).toBeGreaterThanOrEqual(1);
    // Desktop nav links present (may be visually hidden on mobile)
    expect(screen.getAllByText(/Thực đơn/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders hamburger button on mobile', () => {
    renderWithProviders(<LandingNav />);
    const hamburger = screen.getByRole('button', { name: /Mở menu/i });
    expect(hamburger).toBeTruthy();
  });

  it('opens drawer when hamburger is clicked', () => {
    renderWithProviders(<LandingNav />);
    const hamburger = screen.getByRole('button', { name: /Mở menu/i });
    fireEvent.click(hamburger);
    expect(screen.getByRole('dialog', { name: /Menu điều hướng/i })).toBeTruthy();
  });

  it('shows close button when drawer is open', () => {
    renderWithProviders(<LandingNav />);
    fireEvent.click(screen.getByRole('button', { name: /Mở menu/i }));
    expect(screen.getByRole('button', { name: /Đóng menu/i })).toBeTruthy();
  });

  it('closes drawer when X button is clicked', () => {
    renderWithProviders(<LandingNav />);
    fireEvent.click(screen.getByRole('button', { name: /Mở menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Đóng menu/i }));
    // Dialog still in DOM but pointer-events-none; button label reverts
    expect(screen.getByRole('button', { name: /Mở menu/i })).toBeTruthy();
  });

  it('renders Gọi món ngay CTA in drawer', () => {
    renderWithProviders(<LandingNav />);
    fireEvent.click(screen.getByRole('button', { name: /Mở menu/i }));
    // CTA appears in both desktop (hidden) and drawer (visible)
    expect(screen.getAllByText(/Gọi món ngay/i).length).toBeGreaterThanOrEqual(1);
  });

  it('has aria-expanded false on hamburger by default', () => {
    renderWithProviders(<LandingNav />);
    const hamburger = screen.getByRole('button', { name: /Mở menu/i });
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
  });

  it('has aria-expanded true when drawer is open', () => {
    renderWithProviders(<LandingNav />);
    const hamburger = screen.getByRole('button', { name: /Mở menu/i });
    fireEvent.click(hamburger);
    expect(hamburger.getAttribute('aria-expanded')).toBe('true');
  });
});
