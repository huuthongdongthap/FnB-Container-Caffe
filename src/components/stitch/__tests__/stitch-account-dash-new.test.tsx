import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/stores/use-cart-store', () => ({
  useCartStore: Object.assign(
    vi.fn(() => ({
      items: [],
      addItem: vi.fn(),
      clearCart: vi.fn(),
    })),
    {
      getState: () => ({
        items: [],
        addItem: vi.fn(),
        clearCart: vi.fn(),
      }),
    },
  ),
}));

vi.mock('@/hooks/stores/use-favorites-store', () => ({
  useFavoritesStore: vi.fn(() => ({ items: [] })),
}));

vi.mock('@/hooks/stores/use-menu-store', () => ({
  useMenuStore: vi.fn(() => ({ items: [] })),
}));

import { StitchAccountDashNew } from '../StitchAccountDashNew';

describe('StitchAccountDashNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders default profile name', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Julian Vane')).toBeInTheDocument();
  });

  it('renders tier badge text', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getAllByText('Gold').length).toBeGreaterThanOrEqual(1);
  });

  it('renders loyalty points', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('1,250')).toBeInTheDocument();
  });

  it('renders order history item name', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Truffle Cortado')).toBeInTheDocument();
  });

  it('renders with custom profile', () => {
    renderWithProviders(
      <StitchAccountDashNew
        profile={{ name: 'Jane Doe', avatar: '', tier: 'Silver', memberSince: '2025' }}
      />,
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getAllByText('Silver').length).toBeGreaterThanOrEqual(1);
  });

  it('renders favorites section placeholder', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('stitch.accountDashboard.myFavoritesEmpty')).toBeInTheDocument();
  });
});
