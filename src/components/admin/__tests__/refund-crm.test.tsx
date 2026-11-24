import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render as renderWithProviders, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualOrderRefund } from '../manual-order-refund';
import { CustomerDetail } from '../customer-detail';
import { RewardsManager } from '../rewards-manager';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
const session = vi.hoisted(() => ({ role: 'owner' }));
vi.mock('@/lib/client-session', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/client-session')>(),
  useClientSessionScope: () => session,
}));
vi.mock('@/lib/server-confirmed-submission', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/server-confirmed-submission')>(),
  useSubmissionSession: () => 'test',
}));
const order = { id: 'o1', customer: 'Guest', total: 20000, items: 1, status: 'completed', payment: 'payos', createdAt: '', payment_id: 'p1', payment_method: 'payos', payment_status: 'paid', payment_amount: 20000, refund_amount: 5000, refund_status: 'partial' };
const customer = { id: 'c1', name: 'Customer', phone: '0900000000', tier: 'gold', totalOrders: 2, totalSpent: 20000, lastVisit: '' };
beforeEach(() => { vi.resetAllMocks(); session.role = 'owner'; });

describe('manual refund confirmation', () => {
  it('requires transfer confirmation and locks uncertain writes for reconciliation', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Network unavailable'));
    renderWithProviders(<ManualOrderRefund order={order} onRecorded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ghi nhận hoàn tiền/i }));
    expect(screen.getByText(/15\.000/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Lý do/i), { target: { value: 'Return' } });
    fireEvent.change(screen.getByLabelText(/Mã chuyển khoản/i), { target: { value: 'BANK-1' } });
    expect(screen.getByRole('button', { name: /Xác nhận ghi nhận/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận ghi nhận/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/đối soát|tải lại|Reconcile/i);
    expect(screen.getByRole('button', { name: /Xác nhận ghi nhận/i })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it('does not expose a refund action to cashier', () => {
    session.role = 'cashier';
    renderWithProviders(<ManualOrderRefund order={order} onRecorded={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Ghi nhận hoàn tiền/i })).toBeNull();
  });
  it('uses persisted pending tranche amount rather than cumulative refund_amount when retrying loyalty reversal', async () => {
    const onRecorded = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      success: true,
      data: {
        paymentId: 'p1',
        amount: 3000,
        refund_status: 'partial',
        manual_transfer_ref: 'BANK-TRANCHE-2',
        loyalty_reversal: { status: 'reversed' },
      },
    });
    const pendingOrder = {
      ...order,
      refund_amount: 8000,
      pendingLoyaltyReversal: true,
      pendingLoyaltyTransferRef: 'BANK-TRANCHE-2',
      pendingLoyaltyRefundAmount: 3000,
    };
    renderWithProviders(<ManualOrderRefund order={pendingOrder} onRecorded={onRecorded} />);
    fireEvent.click(screen.getByRole('button', { name: /Thử thu hồi lại điểm loyalty|Retry loyalty reversal/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/payments/refund',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"amount":3000'),
        }),
      ),
    );
    expect(onRecorded).toHaveBeenCalledTimes(1);
  });
  it('inspects unreconciled legacy refunds before allowing acknowledgeLegacy reconciliation', async () => {
    const unrecErr = Object.assign(new Error('Unreconciled'), {
      status: 409,
      code: 'REFUND_HISTORY_UNRECONCILED',
    });
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(unrecErr)
      .mockResolvedValueOnce({
        success: true,
        data: {
          ready: false,
          unreconciledCount: 1,
          unreconciledRefunds: [
            {
              payment_id: 'pay-legacy-1',
              order_id: 'ord-legacy-1',
              amount: 50000,
              refund_amount: 50000,
              refund_status: 'completed',
              refunded_at: '2026-10-01T00:00:00Z',
            },
          ],
        },
      })
      .mockResolvedValueOnce({ success: true, data: { ready: true } });

    renderWithProviders(<ManualOrderRefund order={order} onRecorded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ghi nhận hoàn tiền/i }));
    fireEvent.change(screen.getByLabelText(/Lý do/i), { target: { value: 'Return' } });
    fireEvent.change(screen.getByLabelText(/Mã chuyển khoản/i), { target: { value: 'BANK-2' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận ghi nhận/i }));

    const inspectBtn = await screen.findByRole('button', { name: /Kiểm tra & đối soát|Đối soát/i });
    fireEvent.click(inspectBtn);

    // Step 1 only performs GET inspection; no POST with acknowledgeLegacy yet
    expect(await screen.findByText(/ord-legacy-1/)).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith('/api/payments/refund-readiness');
    expect(apiFetch).toHaveBeenCalledTimes(2);

    const checkboxes = screen.getAllByRole('checkbox');
    const ackCheckbox = checkboxes[checkboxes.length - 1]!;
    fireEvent.click(ackCheckbox);
    const confirmReconcileBtn = screen.getByRole('button', { name: /Xác nhận đã kiểm tra và hoàn tất đối soát/i });
    fireEvent.click(confirmReconcileBtn);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/payments/refund-readiness/reconcile',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ acknowledgeLegacy: true }),
        }),
      ),
    );
  });
});

describe('CRM account and rewards', () => {
  it('loads profile points and history and reloads after confirmed adjustment', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { customerId: 'c1', account: { email: 'customer@example.test', points: 20, recentOrders: [] }, tier: { name: 'gold', cashbackRate: 0.07, pointMultiplier: 1.3 }, recentEvents: { events: [{ id: 'e1', source: 'loyalty', timestamp: '2026-11-21', payload: { points: 20, reason: 'Purchase' } }] } } });
    renderWithProviders(<CustomerDetail customer={customer} onClose={vi.fn()} />);
    expect(await screen.findByText(/Points: 20/)).toBeTruthy();
    expect(screen.getByText(/Purchase/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Điểm (+/-) / Points'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Lý do / Reason'), { target: { value: 'Correction' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Lưu điểm / Save points'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/loyalty/admin/adjust-points', expect.objectContaining({ method: 'POST', body: expect.stringContaining('idempotencyKey') })));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
  });
  it('allows authorized reward creation and activation updates', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { rewards: [{ id: 'r1', name: 'Coffee', pointsCost: 10, type: 'free_item', value: 1, isActive: true }] } });
    renderWithProviders(<RewardsManager />);
    expect(await screen.findByText(/Coffee/)).toBeTruthy();
    fireEvent.click(screen.getByText('Tắt / Deactivate'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/loyalty/rewards/r1', expect.objectContaining({ method: 'PATCH', body: '{"isActive":false}' })));
    fireEvent.change(screen.getByLabelText('Tên / Name'), { target: { value: 'Tea' } });
    fireEvent.change(screen.getByLabelText('Điểm đổi / Points cost'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Giá trị / Value'), { target: { value: '5000' } });
    fireEvent.click(screen.getByText('Tạo phần thưởng / Create reward'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/loyalty/rewards', expect.objectContaining({ method: 'POST' })));
  });
});
