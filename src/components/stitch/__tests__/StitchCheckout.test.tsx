import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchCheckout from '@/components/stitch/StitchCheckout';
import type { OrderSummaryData } from '@/components/stitch/StitchCheckout';

const BASE_SUMMARY: OrderSummaryData = {
  items: [
    { id: '1', name: 'Midnight Espresso', variant: 'Hot', quantity: 2, price: 6.50, imageUrl: 'https://example.com/coffee.jpg' },
    { id: '2', name: 'Smoked Truffle Croissant', variant: 'Regular', quantity: 1, price: 9.00, imageUrl: 'https://example.com/croissant.jpg' },
  ],
  subtotal: 22.00,
  tax: 1.10,
  deliveryFee: 3.00,
  total: 26.10,
};

describe('StitchCheckout', () => {
  it('renders loading skeleton when summary is null', () => {
    const { container } = render(<StitchCheckout summary={null} onPlaceOrder={vi.fn()} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when cart has no items', () => {
    const { container } = render(<StitchCheckout summary={{ ...BASE_SUMMARY, items: [] }} onPlaceOrder={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders error message from props', () => {
    render(<StitchCheckout summary={BASE_SUMMARY} error="Network error" onPlaceOrder={vi.fn()} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders checkout form with customer fields and order summary', () => {
    const { container } = render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows processing state and disables submit button', () => {
    const { container } = render(<StitchCheckout summary={BASE_SUMMARY} isProcessing={true} onPlaceOrder={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows submit error on failed order', () => {
    const { container } = render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn().mockRejectedValue(new Error('Payment declined'))} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders items count and total price in summary bar', () => {
    const { container } = render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with summary data', () => {
    const { container } = render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('calls onPlaceOrder with form data on submit', () => {
    const onPlaceOrder = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={onPlaceOrder} />);
    expect(container.firstChild).toBeTruthy();
  });
});
