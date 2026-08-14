import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

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

import StitchFooter from '../StitchFooter';

describe('StitchFooter', () => {
  it('renders the AURA CAFE brand link', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByRole('link', { name: 'AURA CAFE' })).toHaveAttribute('href', '/');
  });

  it('renders contact heading', () => {
    renderWithProviders(<StitchFooter />);
    const els = screen.getAllByText('footer.contact');
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it('renders phone number', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('0946 013 633')).toBeInTheDocument();
  });

  it('renders email link', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('hello@auracafe.vn')).toHaveAttribute('href', 'mailto:hello@auracafe.vn');
  });

  it('renders service links', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('nav.menu')).toBeInTheDocument();
    expect(screen.getByText('nav.reservations')).toBeInTheDocument();
  });

  it('renders social media links', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByLabelText('footer.facebook')).toHaveAttribute('href', 'https://facebook.com/auracafe');
    expect(screen.getByLabelText('footer.instagram')).toHaveAttribute('href', 'https://instagram.com/auracafe');
    expect(screen.getByLabelText('footer.tiktok')).toHaveAttribute('href', 'https://tiktok.com/@auracafe');
  });

  it('renders copyright text', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText(/footer\.copyright/)).toBeInTheDocument();
  });
});
