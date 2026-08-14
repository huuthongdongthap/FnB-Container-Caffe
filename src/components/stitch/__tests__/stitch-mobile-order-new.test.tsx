import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { StitchMobileOrderNew } from '../StitchMobileOrderNew';

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

const mockItems = [
  { id: '1', name: 'Espresso', description: 'Strong coffee', price: 6.5, priceLabel: '$6.50', category: 'coffee', imageSrc: '/img.jpg', imageAlt: 'Espresso' },
  { id: '2', name: 'Green Tea', description: 'Fresh tea', price: 5.0, priceLabel: '$5.00', category: 'tea', imageSrc: '/img2.jpg', imageAlt: 'Green Tea' },
];

describe('StitchMobileOrderNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders menu items', () => {
    renderWithProviders(<StitchMobileOrderNew items={mockItems} />);
    expect(screen.getByText('Espresso')).toBeInTheDocument();
    expect(screen.getByText('Green Tea')).toBeInTheDocument();
  });

  it('renders category filters', () => {
    renderWithProviders(<StitchMobileOrderNew items={mockItems} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
  });

  it('filters items by category', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchMobileOrderNew items={mockItems} />);
    await user.click(screen.getByText('Tea'));
    expect(screen.getByText('Green Tea')).toBeInTheDocument();
    expect(screen.queryByText('Espresso')).not.toBeInTheDocument();
  });
});
