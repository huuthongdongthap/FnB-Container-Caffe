import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';

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

import StitchHeader from '../StitchHeader';

describe('StitchHeader', () => {
  it('renders the AURA CAFE logo link', () => {
    renderWithProviders(<StitchHeader />);
    expect(screen.getByRole('link', { name: 'AURA CAFE' })).toHaveAttribute('href', '/');
  });

  it('renders the Order Now CTA', () => {
    renderWithProviders(<StitchHeader />);
    // t('nav.bookNow', 'Order Now') returns 'Order Now'
    expect(screen.getByText('Order Now')).toBeInTheDocument();
  });

  it('renders desktop nav links', () => {
    renderWithProviders(<StitchHeader />);
    // t(item.key) where item.key='nav.menu' returns 'nav.menu' (key from empty map)
    expect(screen.getByText('nav.menu')).toBeInTheDocument();
    expect(screen.getByText('nav.contact')).toBeInTheDocument();
  });

  it('hamburger button toggles mobile menu', () => {
    renderWithProviders(<StitchHeader />);
    // t('nav.openMenu', 'Open menu') returns 'Open menu'
    const btn = screen.getByRole('button', { name: 'Open menu' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(btn);
    // After click, aria-label changes to t('nav.closeMenu', 'Close menu') = 'Close menu'
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});
