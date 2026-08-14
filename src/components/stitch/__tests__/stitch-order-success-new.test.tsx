import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchOrderSuccessNew, type OrderSuccessNewData } from '../StitchOrderSuccessNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key ?? '',
    i18n: { language: 'vi', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('three', () => ({
  WebGLRenderer: vi.fn(() => ({ render: vi.fn(), setSize: vi.fn() })),
  Scene: vi.fn(),
  PerspectiveCamera: vi.fn(),
}));

vi.mock('@/lib/cn', () => ({
  cn: (...args: Array<string | false | undefined>) => args.filter(Boolean).join(' '),
}));

const sampleOrder: OrderSuccessNewData = {
  orderId: 'ORD-12345',
  items: [
    { id: '1', name: 'Espresso', quantity: 2, price: 45000 },
    { id: '2', name: 'Cappuccino', quantity: 1, price: 55000 },
  ],
  total: 145000,
  estimatedMinutes: 12,
  locationName: 'AURA CAFE Sa Dec',
  customerName: 'Minh',
};

describe('StitchOrderSuccessNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders AURA CAFE header', () => {
    renderWithProviders(<StitchOrderSuccessNew order={sampleOrder} />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders order ID', () => {
    renderWithProviders(<StitchOrderSuccessNew order={sampleOrder} />);
    expect(screen.getByText(/ORD-12345/)).toBeTruthy();
  });

  it('renders estimated wait time', () => {
    renderWithProviders(<StitchOrderSuccessNew order={sampleOrder} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('min')).toBeTruthy();
  });

  it('renders order items', () => {
    renderWithProviders(<StitchOrderSuccessNew order={sampleOrder} />);
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(screen.getByText('Cappuccino')).toBeTruthy();
  });

  it('renders location name', () => {
    renderWithProviders(<StitchOrderSuccessNew order={sampleOrder} />);
    expect(screen.getByText('AURA CAFE Sa Dec')).toBeTruthy();
  });

  it('shows loading skeleton when isLoading', () => {
    renderWithProviders(<StitchOrderSuccessNew order={null} isLoading={true} />);
    expect(screen.getByLabelText('Loading order confirmation')).toBeTruthy();
  });

  it('shows error state with message', () => {
    renderWithProviders(<StitchOrderSuccessNew order={null} error="Payment failed" />);
    expect(screen.getByText('Payment failed')).toBeTruthy();
  });

  it('shows empty state when order is null', () => {
    renderWithProviders(<StitchOrderSuccessNew order={null} />);
    expect(screen.getByText('stitch.orderSuccessNotFound')).toBeTruthy();
  });
});
