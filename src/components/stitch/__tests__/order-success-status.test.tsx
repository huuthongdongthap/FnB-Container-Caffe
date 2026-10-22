import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { orderSuccessStatus } from '../order-success-status';
import { StitchOrderSuccessNew } from '../StitchOrderSuccessNew';
vi.mock('../StitchOrderSuccessNew-confetti', () => ({ ShaderBackground: () => null }));
vi.mock('../use-stitch-order-success', () => ({ useStitchOrderSuccess: () => {} }));

const cases = [
  ['pending', 'unpaid', 'payos', 'Chờ thanh toán PayOS', 0],
  ['pending', 'unpaid', 'cod', 'Đã nhận đơn', 0],
  ['preparing', 'paid', 'payos', 'Đang pha chế', 50],
  ['ready', 'paid', 'payos', 'Sẵn sàng nhận món', 100],
  ['completed', 'paid', 'cod', 'Đã hoàn tất', 100],
  ['cancelled', 'unpaid', 'payos', 'Đơn đã hủy', 0],
] as const;

describe('confirmation uses authoritative payment and fulfillment state', () => {
  for (const [status, paymentStatus, paymentMethod, label, progress] of cases) it(`${status}/${paymentStatus}/${paymentMethod}`, () => {
    const order = { orderId: 'ORD_REAL', total: 20000, items: [{ id: 'coffee', name: 'Cà phê', quantity: 1, price: 20000 }], locationName: 'AURA', status, paymentStatus, paymentMethod };
    render(<StitchOrderSuccessNew order={order} />);
    expect(screen.getByTestId('confirmation-status')).toHaveTextContent(label);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(progress));
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    if (paymentMethod === 'cod' && paymentStatus === 'unpaid') expect(screen.getByTestId('confirmation-payment-status')).toHaveTextContent('COD — chưa thu tiền');
    cleanup();
  });
  it('paid COD does not imply completed kitchen work', () => {
    expect(orderSuccessStatus('preparing', 'paid', 'cod')).toMatchObject({ label: 'Đang pha chế', paymentLabel: 'Đã thanh toán', progress: 50 });
  });
});
