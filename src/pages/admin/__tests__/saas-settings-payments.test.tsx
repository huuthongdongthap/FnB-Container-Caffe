import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionCalls, deferred, payment, renderSettings, setupApi, waitForActionUnlocked,
  waitForSettings, type ApiResponse,
} from './saas-settings-test-support';

beforeEach(() => setupApi());
afterEach(() => vi.restoreAllMocks());

describe('SaaS settings payment affordances', () => {
  it('shows and copies the direct Worker webhook URL, not the browser origin', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderSettings('payment');
    await waitForSettings();
    expect(screen.getByText(payment.webhookUrl)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép Webhook URL' }));
    await screen.findByRole('button', { name: 'Đã sao chép' });
    expect(writeText).toHaveBeenCalledWith(payment.webhookUrl);
  });

  it('keeps the selectable URL and shows a manual-copy fallback when clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    renderSettings('payment');
    await waitForSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép Webhook URL' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sao chép Webhook URL thủ công');
    expect(screen.getByText(payment.webhookUrl)).toBeInTheDocument();
  });

  it('locks test requests synchronously, renders the returned VietQR and releases after success', async () => {
    const pending = deferred<ApiResponse>();
    setupApi({ action: () => pending.promise });
    renderSettings('payment');
    await waitForSettings();
    const button = screen.getByRole('button', { name: 'Kiểm tra kết nối' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(actionCalls('/api/saas/payment-config/test')).toHaveLength(1);
    expect(button).toBeDisabled();
    const sampleQrUrl = 'https://img.vietqr.io/image/MB-123456-compact2.png?amount=10000';
    await act(async () => pending.resolve({ success: true, data: { message: 'QR sẵn sàng', sampleQrUrl } }));
    expect(await screen.findByRole('img', { name: 'Mã VietQR kiểm tra kết nối' })).toHaveAttribute('src', sampleQrUrl);
    await waitForActionUnlocked(button);
  });

  it('does not render an untrusted QR URL and releases test action after an unsuccessful envelope', async () => {
    setupApi({ action: () => ({ success: false, error: 'Chưa cấu hình', data: { sampleQrUrl: 'https://evil.test/a.png' } }) });
    renderSettings('payment');
    await waitForSettings();
    const button = screen.getByRole('button', { name: 'Kiểm tra kết nối' });
    fireEvent.click(button);
    await screen.findByText('Chưa cấu hình');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await waitForActionUnlocked(button);
  });

  it.each(['https://pay.payos.vn/web/invoice-1', 'javascript:alert(1)'])('guards concurrent checkouts and validates fresh destination %s', async (checkoutUrl) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const pending = deferred<ApiResponse>();
    setupApi({ action: () => pending.promise });
    renderSettings();
    await waitForSettings();
    const button = screen.getAllByRole('button', { name: /Thanh toán 1 tháng/ })[0]!;
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(actionCalls('/api/saas/billing/checkout')).toHaveLength(1);
    expect(button).toBeDisabled();
    await act(async () => pending.resolve({ success: true, data: { checkoutUrl, amountVnd: 199000, payosOrderCode: '123' } }));
    await waitForActionUnlocked(button);
    if (checkoutUrl.startsWith('https:')) expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank', 'noopener,noreferrer');
    else expect(open).not.toHaveBeenCalled();
  });

  it('offers resume only for pending invoices with a validated PayOS destination', async () => {
    const invoice = { tier: 'pro', billing_cycle: 'monthly', amount_vnd: 499000, created_at: '2026-11-20' };
    setupApi({ invoices: [
      { ...invoice, id: 'safe', status: 'pending', checkout_url: 'https://pay.payos.vn/web/safe' },
      { ...invoice, id: 'paid-invoice', status: 'paid', checkout_url: 'https://pay.payos.vn/web/paid' },
      { ...invoice, id: 'unsafe', status: 'pending', checkout_url: 'https://pay.payos.vn.evil.test/web/a' },
      { ...invoice, id: 'missing', status: 'pending', checkout_url: null },
    ] });
    renderSettings();
    await waitForSettings();
    const links = screen.getAllByRole('link', { name: 'Thanh toán ngay' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://pay.payos.vn/web/safe');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(screen.getByText('paid-invoice').closest('tr')!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('locks domain verification and releases after a failed response', async () => {
    const pending = deferred<ApiResponse>();
    setupApi({ action: () => pending.promise });
    renderSettings('domains');
    await waitForSettings();
    const button = screen.getByRole('button', { name: 'Xác minh DNS' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(actionCalls('/api/saas/domains/domain-a/verify')).toHaveLength(1);
    await act(async () => pending.resolve({ success: false, error: 'TXT chưa đúng' }));
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByText('TXT chưa đúng')).toBeInTheDocument();
  });
});
