import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
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

  it('blocks submit with alert when phone empty (VN format required)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    const nameInput = screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A');
    await user.type(nameInput, 'Nguyễn Văn A');
    // Submit with empty phone → form-level alert, no order placed
    fireEvent.submit(nameInput.closest('form')!);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(defaultProps.onPlaceOrder).not.toHaveBeenCalled();
  });

  it('shows inline error for invalid phone format while typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    const phoneInput = screen.getByPlaceholderText('0901 234 567');
    await user.type(phoneInput, '12345');
    expect(screen.getByTestId('phone-error')).toBeInTheDocument();
    // Full valid VN number clears the error
    await user.clear(phoneInput);
    await user.type(phoneInput, '0901234567');
    expect(screen.queryByTestId('phone-error')).not.toBeInTheDocument();
  });

  it('requires delivery address when order type is delivery', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    // Delivery is the default order type
    await user.type(screen.getByPlaceholderText('0901 234 567'), '0901234567');
    // No address entered
    const submitBtn = screen.getByRole('button', { name: /place order|đặt hàng/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByTestId('address-error')).toBeInTheDocument();
    });
    expect(defaultProps.onPlaceOrder).not.toHaveBeenCalled();
    // Fill address → error clears
    await user.type(screen.getByPlaceholderText(/Số nhà, tên đường/), '39 Nguyễn Tất Thành');
    await waitFor(() => {
      expect(screen.queryByTestId('address-error')).not.toBeInTheDocument();
    });
  });

  it('requires table number when order type is dine_in', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /tại quán/i }));
    await user.type(screen.getByPlaceholderText('0901 234 567'), '0901234567');
    const tableInput = screen.getByPlaceholderText('Ví dụ: Bàn 5');
    // Missing table → inline error after submit attempt
    fireEvent.submit(screen.getByPlaceholderText('Ví dụ: Bàn 5').closest('form')!);
    await waitFor(() => {
      expect(screen.getByTestId('table-error')).toBeInTheDocument();
    });
    expect(defaultProps.onPlaceOrder).not.toHaveBeenCalled();
    // Fill table → error clears
    await user.type(tableInput, '5');
    await waitFor(() => {
      expect(screen.queryByTestId('table-error')).not.toBeInTheDocument();
    });
  });

  it('takeaway requires neither address nor table', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchCheckoutNew {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /mang đi/i }));
    await user.type(screen.getByPlaceholderText('0901 234 567'), '0901234567');
    // Pickup point info shown instead of address/table fields
    expect(screen.getByText(/Quầy Bar AURA CAFE/i)).toBeInTheDocument();
    expect(screen.queryByTestId('address-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-error')).not.toBeInTheDocument();
  });

  it('submits with orderType when form is valid', async () => {
    const user = userEvent.setup();
    const onPlaceOrder = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<StitchCheckoutNew {...defaultProps} onPlaceOrder={onPlaceOrder} />);
    await user.click(screen.getByRole('button', { name: /mang đi/i }));
    await user.type(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), 'Trần Thị B');
    await user.type(screen.getByPlaceholderText('0901 234 567'), '0901234567');
    fireEvent.submit(screen.getByPlaceholderText('0901 234 567').closest('form')!);
    await waitFor(() => {
      expect(onPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({ orderType: 'takeaway', phone: '0901234567', paymentMethod: 'payos' })
      );
    });
  });
});
