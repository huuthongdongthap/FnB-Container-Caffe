import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { StitchCheckoutNew } from '../StitchCheckoutNew';

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

const mockSummary = {
  items: [
    { id: '1', name: 'Espresso', variant: 'Hot', quantity: 2, price: 6.5, imageUrl: '/img.jpg' },
  ],
  subtotal: 13.0,
  tax: 0.65,
  deliveryFee: 0,
  total: 13.65,
};

const defaultProps = {
  summary: mockSummary,
  onPlaceOrder: vi.fn().mockResolvedValue(undefined),
};

describe('StitchCheckoutNew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when summary is null', () => {
    renderWithProviders(<StitchCheckoutNew summary={null} onPlaceOrder={vi.fn()} />);
    expect(screen.getByLabelText(/loading checkout/i)).toBeInTheDocument();
  });

  it('renders empty cart state when items array is empty', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={{ ...mockSummary, items: [] }} onPlaceOrder={vi.fn()} />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders payment method options', () => {
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    expect(screen.getByText('PayOS')).toBeInTheDocument();
    expect(screen.getByText('Cash on Delivery')).toBeInTheDocument();
  });

  it('toggles payment method on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    const codRadio = screen.getByDisplayValue('cod');
    await user.click(codRadio);
    expect(codRadio).toBeChecked();
  });

  it('displays order summary items', () => {
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    expect(screen.getByText('Espresso')).toBeInTheDocument();
    expect(screen.getByText('Hot • 2x')).toBeInTheDocument();
  });
});
