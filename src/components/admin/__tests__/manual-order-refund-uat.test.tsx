import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualOrderRefund } from '../manual-order-refund';

const apiFetchMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock('@/lib/client-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/client-session')>();
  return {
    ...actual,
    useClientSessionScope: () => ({ role: 'manager', tenantId: 'default', scopeKey: 'test-scope' }),
  };
});

const baseOrder = {
  id: 'ord-100',
  customer: 'Nguyen Van A',
  items: 2,
  total: 50000,
  status: 'completed',
  payment: 'payos',
  createdAt: '2026-11-23 02:00:00',
  payment_id: 'pay-100',
  payment_method: 'payos',
  payment_status: 'paid',
  payment_amount: 50000,
  payment_transaction_id: '123456789',
  refund_amount: 0,
  refund_status: null,
};

describe('ManualOrderRefund UAT regressions (#125, #126)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('hides refund form for PayOS payments without a valid numeric payment_transaction_id (#125)', () => {
    const invalidOrder = { ...baseOrder, payment_transaction_id: 'INVALID-TXN' };
    render(
      <ManualOrderRefund
        order={invalidOrder}
        onRecorded={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Hoàn tiền/i })).toBeNull();
  });

  it('surfaces loyalty_reversal failure with retry button replaying same manual_transfer_ref (#126)', async () => {
    const onRecorded = vi.fn();
    apiFetchMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          paymentId: 'pay-100',
          amount: 50000,
          refund_status: 'completed',
          manual_transfer_ref: 'BANK-RETRY-1',
          loyalty_reversal: { status: 'failed', retryable: true, error: 'D1 timeout' },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          paymentId: 'pay-100',
          amount: 50000,
          refund_status: 'completed',
          manual_transfer_ref: 'BANK-RETRY-1',
          loyalty_reversal: { status: 'reversed' },
        },
      });

    render(<ManualOrderRefund order={baseOrder} onRecorded={onRecorded} />);
    fireEvent.click(screen.getByRole('button', { name: /Hoàn tiền/i }));
    fireEvent.change(screen.getByLabelText(/Lý do/i), { target: { value: 'Khach huy' } });
    fireEvent.change(screen.getByLabelText(/Mã chuyển khoản/i), { target: { value: 'BANK-RETRY-1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận ghi nhận/i }));

    const retryBtn = await screen.findByRole('button', { name: /Retry loyalty reversal/i });
    expect(onRecorded).not.toHaveBeenCalled();

    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });
    expect(apiFetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        paymentId: 'pay-100',
        orderId: 'ord-100',
        amount: 50000,
        reason: 'Khach huy',
        manual_transfer_ref: 'BANK-RETRY-1',
      }),
    });
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });

  it('unlocks form on deterministic 409 error and shows REFUND_HISTORY_UNRECONCILED guidance (#126)', async () => {
    apiFetchMock.mockRejectedValueOnce({
      status: 409,
      code: 'REFUND_HISTORY_UNRECONCILED',
      message: 'Refund history mismatch',
    });

    render(<ManualOrderRefund order={baseOrder} onRecorded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Hoàn tiền/i }));
    fireEvent.change(screen.getByLabelText(/Lý do/i), { target: { value: 'Wrong item' } });
    fireEvent.change(screen.getByLabelText(/Mã chuyển khoản/i), { target: { value: 'BANK-409' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận ghi nhận/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('REFUND_HISTORY_UNRECONCILED');
    // Form inputs remain editable (not locked) after deterministic 409
    expect(screen.getByLabelText(/Lý do/i)).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Đóng/i })).not.toBeDisabled();
  });
});
