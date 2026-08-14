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

import StitchAppLayout from '../StitchAppLayout';

describe('StitchAppLayout', () => {
  it('renders children', () => {
    renderWithProviders(
      <StitchAppLayout>
        <div>Page content</div>
      </StitchAppLayout>,
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('renders skip-to-content link', () => {
    renderWithProviders(
      <StitchAppLayout>
        <div>Content</div>
      </StitchAppLayout>,
    );
    expect(screen.getByText(/Skip to content/)).toBeInTheDocument();
  });

  it('renders main element with id for skip link', () => {
    renderWithProviders(
      <StitchAppLayout>
        <div>Content</div>
      </StitchAppLayout>,
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
