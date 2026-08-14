import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
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
    expect(screen.getByText('nav.bookNow')).toBeInTheDocument();
  });

  it('renders desktop nav links', () => {
    renderWithProviders(<StitchHeader />);
    expect(screen.getByText('nav.menu')).toBeInTheDocument();
    expect(screen.getByText('nav.contact')).toBeInTheDocument();
  });

  it('hamburger button toggles mobile menu', () => {
    renderWithProviders(<StitchHeader />);
    const btn = screen.getByRole('button', { name: 'nav.openMenu' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});
