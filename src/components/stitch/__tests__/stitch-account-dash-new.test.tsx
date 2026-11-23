import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('renders default profile name without hardcoded mock persona', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.queryByText('Julian Vane')).not.toBeInTheDocument();
  });

  it('renders default Bronze tier badge text', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getAllByText('Bronze').length).toBeGreaterThanOrEqual(1);
  });

  it('renders zero default loyalty points', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders custom order history item name without hardcoded mock orders', () => {
    renderWithProviders(
      <StitchAccountDashNew
        orders={[
          {
            id: 'ORD-1',
            itemName: 'Cà Phê Sữa Đá',
            icon: 'coffee',
            time: '5 phút trước',
            status: 'delivered',
          },
        ]}
      />,
    );
    expect(screen.getByText('Cà Phê Sữa Đá')).toBeInTheDocument();
    expect(screen.queryByText('Truffle Cortado')).not.toBeInTheDocument();
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
    expect(screen.getByText('No favorites yet')).toBeInTheDocument();
  });
});
