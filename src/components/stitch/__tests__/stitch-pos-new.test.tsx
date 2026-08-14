import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { StitchPOSNew } from '../StitchPOSNew';

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

const mockMenuItems = [
  { id: 'm1', name: 'Espresso', price: 6.5, category: 'Coffee' },
  { id: 'm2', name: 'Green Tea', price: 5.0, category: 'Tea' },
];

describe('StitchPOSNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders menu items in grid', () => {
    renderWithProviders(<StitchPOSNew menuItems={mockMenuItems} />);
    expect(screen.getByText('Espresso')).toBeInTheDocument();
  });

  it('renders category tabs', () => {
    renderWithProviders(<StitchPOSNew menuItems={mockMenuItems} />);
    expect(screen.getByRole('tab', { name: /coffee/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tea/i })).toBeInTheDocument();
  });

  it('filters items by category', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchPOSNew menuItems={mockMenuItems} />);
    await user.click(screen.getByRole('tab', { name: /tea/i }));
    expect(screen.getByText('Green Tea')).toBeInTheDocument();
    expect(screen.queryByText('Espresso')).not.toBeInTheDocument();
  });

  it('adds item to cart on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchPOSNew menuItems={mockMenuItems} />);
    const card = screen.getByText('Espresso').closest('[role="button"]');
    if (card) await user.click(card);
    expect(screen.getByText('$6.50')).toBeInTheDocument();
  });

  it('displays brand name in header', () => {
    renderWithProviders(<StitchPOSNew menuItems={mockMenuItems} brandName="TEST BRAND" />);
    expect(screen.getByText('TEST BRAND')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    renderWithProviders(<StitchPOSNew loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
