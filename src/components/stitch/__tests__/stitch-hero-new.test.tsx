import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchHeroNew } from '../StitchHeroNew';

const mockNavigate = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('lucide-react', () => ({
  Factory: () => null,
  Coffee: () => null,
  Moon: () => null,
}));

describe('StitchHeroNew', () => {
  it('renders nav with brand name', () => {
    renderWithProviders(<StitchHeroNew />);
    const nav = screen.getByRole('navigation');
    expect(nav.textContent).toContain('AURA CAFE');
  });

  it('renders custom brand name in nav', () => {
    renderWithProviders(<StitchHeroNew brandName="MY BRAND" />);
    const nav = screen.getByRole('navigation');
    expect(nav.textContent).toContain('MY BRAND');
  });

  it('renders nav links', () => {
    renderWithProviders(<StitchHeroNew />);
    expect(screen.getByText('nav.menu')).toBeTruthy();
    expect(screen.getByText('nav.gallery')).toBeTruthy();
    expect(screen.getByText('nav.reservations')).toBeTruthy();
    expect(screen.getByText('nav.about')).toBeTruthy();
  });

  it('renders Book Now button', () => {
    renderWithProviders(<StitchHeroNew />);
    expect(screen.getByText('hero.bookNow')).toBeTruthy();
  });

  it('renders hero heading section', () => {
    const { container } = renderWithProviders(<StitchHeroNew />);
    const h1 = container.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1!.textContent).toContain('hero.theArt');
  });

  it('calls navigate when Book Now is clicked', () => {
    renderWithProviders(<StitchHeroNew />);
    fireEvent.click(screen.getByText('hero.bookNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/table-reservation');
  });

  it('hides nav on scroll down past threshold', () => {
    renderWithProviders(<StitchHeroNew />);
    const nav = screen.getByRole('navigation');
    expect(nav.style.transform).toContain('translateY(0)');
    Object.defineProperty(window, 'pageYOffset', { value: 150, writable: true });
    fireEvent.scroll(window);
    expect(nav.style.transform).toContain('translateY(-100%)');
  });
});
