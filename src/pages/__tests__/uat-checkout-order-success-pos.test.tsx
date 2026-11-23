import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StitchCheckoutNew } from '../../components/stitch/StitchCheckoutNew';
import { OrderSummaryCard } from '../../components/stitch/StitchOrderSuccessNew-summary';
import { StitchOrderSuccessNew } from '../../components/stitch/StitchOrderSuccessNew';
import OrderFailureNew from '../../pages/stitch/order-failure/index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? key,
    i18n: { language: 'vi' },
  }),
}));

vi.mock('../../components/stitch/StitchLandingNew-nav', () => ({
  LandingNav: () => <nav data-testid="landing-nav" />,
}));

vi.mock('../../components/stitch/StitchLandingNew-footer', () => ({
  LandingFooter: () => <footer data-testid="landing-footer" />,
}));

vi.mock('../../components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('../../components/stitch/StitchOrderSuccessNew-confetti', () => ({
  ShaderBackground: () => null,
}));

describe('UAT Checkout, Order Success & Order Failure regressions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hides COD when orderType is delivery and requires non-empty fullName in StitchCheckoutNew', () => {
    const onPlaceOrder = vi.fn();
    render(
      <MemoryRouter>
        <StitchCheckoutNew
          summary={{
            items: [{ id: 'p1', name: 'Latte', variant: 'Standard', quantity: 2, price: 45000, imageUrl: '' }],
            subtotal: 90000,
            tax: 0,
            deliveryFee: 0,
            deliveryLabel: 'Miễn phí',
            total: 90000,
          }}
          onPlaceOrder={onPlaceOrder}
        />
      </MemoryRouter>
    );

    // Default orderType is delivery -> COD radio must not be present
    const paymentRadios = screen.getAllByRole('radio');
    expect(paymentRadios).toHaveLength(1);
    expect((paymentRadios[0] as HTMLInputElement).value).toBe('payos');

    // Fill phone & address, leave fullName empty -> submit must be blocked
    const phoneInput = screen.getByPlaceholderText('0901 234 567');
    fireEvent.change(phoneInput, { target: { value: '0901234567' } });

    const submitButtons = screen.getAllByRole('button', { name: /đặt hàng|thanh toán|confirm/i });
    const submitBtn = submitButtons.find((btn) => (btn as HTMLButtonElement).type === 'submit');
    expect(submitBtn).toBeTruthy();
    if (submitBtn) {
      fireEvent.click(submitBtn);
    }
    expect(onPlaceOrder).not.toHaveBeenCalled();
  });

  it('displays line subtotal (price * quantity) in OrderSummaryCard', () => {
    render(
      <OrderSummaryCard
        orderId="ORD-118"
        items={[{ id: 'i1', name: 'Matcha Latte', quantity: 3, price: 50000 }]}
        total={150000}
        status="pending"
        paymentStatus="unpaid"
        paymentMethod="payos"
        formatFn={(n) => `${n.toLocaleString('vi-VN')}₫`}
      />
    );

    expect(screen.getAllByText('150.000₫').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('50.000₫')).toBeNull();
  });

  it('renders Retry PayOS CTA on StitchOrderSuccessNew when PayOS order is unpaid', () => {
    const onRetryPayment = vi.fn();
    render(
      <StitchOrderSuccessNew
        order={{
          orderId: 'ORD-UNPAID',
          items: [{ id: 'i1', name: 'Espresso', quantity: 1, price: 40000 }],
          total: 40000,
          status: 'pending',
          paymentStatus: 'unpaid',
          paymentMethod: 'payos',
          locationName: 'AURA CAFE',
        }}
        onRetryPayment={onRetryPayment}
      />
    );

    const retryBtn = screen.getByTestId('retry-payos-button');
    fireEvent.click(retryBtn);
    expect(onRetryPayment).toHaveBeenCalledTimes(1);
  });

  it('forwards order_id and supported method params on OrderFailureNew and uses store Zalo link', () => {
    render(
      <MemoryRouter initialEntries={['/order-failure?order_id=ord-999']}>
        <OrderFailureNew />
      </MemoryRouter>
    );

    const retryLink = screen.getByRole('link', { name: /Thử Thanh Toán Lại/i });
    expect(retryLink.getAttribute('href')).toBe('/order-success?order_id=ord-999');

    const codLink = screen.getByRole('link', { name: /Tiền Mặt Trực Tiếp/i });
    expect(codLink.getAttribute('href')).toBe('/checkout?method=cod&order_id=ord-999');

    const zaloLink = screen.getByRole('link', { name: /Chat Zalo/i });
    expect(zaloLink.getAttribute('href')).toBe('https://zalo.me/0946013633');
  });
});
