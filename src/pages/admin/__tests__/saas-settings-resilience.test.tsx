import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  actionCalls, apiMock, defaultGet, deferred, payment, renderSettings, setupApi,
  waitForActionUnlocked, waitForSettings, type ApiResponse,
} from './saas-settings-test-support';

describe('SaaS settings load resilience', () => {
  beforeEach(() => setupApi());

  it('shows an explicit error, then retries rejected initial loads successfully', async () => {
    let failed = true;
    setupApi({ get: (path) => failed ? Promise.reject(new Error('Mất kết nối')) : defaultGet(path) });
    renderSettings();
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
    failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitForSettings();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(6);
  });

  it('recognizes unsuccessful envelopes and disables unavailable payment actions', async () => {
    setupApi({ get: (path) => path === '/api/saas/payment-config'
      ? { success: false, error: 'Không đủ quyền' } : defaultGet(path) });
    renderSettings('payment');
    await waitForSettings();
    expect(screen.getByRole('alert')).toHaveTextContent('Không đủ quyền');
    expect(screen.getByRole('button', { name: 'Lưu cấu hình thanh toán' })).toBeDisabled();
  });

  it('preserves branding, payment credentials and domain drafts across a failed refresh and retry', async () => {
    let failRefresh = false;
    setupApi({
      get: (path) => failRefresh ? Promise.reject(new Error('Refresh thất bại')) : defaultGet(path),
      action: () => ({ success: true, data: { payosOrderCode: '123', amountVnd: 199000 } }),
    });
    renderSettings('branding');
    await waitForSettings();
    const branding = screen.getByDisplayValue('Tên đã lưu');
    fireEvent.change(branding, { target: { value: 'Tên đang soạn' } });
    fireEvent.click(screen.getByRole('button', { name: '2. Thanh toán trực tiếp (VietQR / PayOS)' }));
    fireEvent.change(screen.getByDisplayValue(payment.bankAccountNo), { target: { value: '987654321' } });
    fireEvent.change(screen.getByPlaceholderText('PayOS API Key'), { target: { value: 'draft-key' } });
    fireEvent.click(screen.getByRole('button', { name: '4. Tên miền riêng (Custom Domain)' }));
    fireEvent.change(screen.getByPlaceholderText('order.quancuaban.vn'), { target: { value: 'draft.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: '1. Gói & Hóa đơn SaaS' }));
    failRefresh = true;
    fireEvent.click(screen.getAllByRole('button', { name: /Thanh toán 1 tháng/ })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh thất bại');
    await waitForActionUnlocked(screen.getByRole('button', { name: 'Thử lại' }));
    failRefresh = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '3. Thương hiệu quán' }));
    expect(screen.getByDisplayValue('Tên đang soạn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2. Thanh toán trực tiếp (VietQR / PayOS)' }));
    expect(screen.getByDisplayValue('987654321')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('PayOS API Key')).toHaveValue('draft-key');
    fireEvent.click(screen.getByRole('button', { name: '4. Tên miền riêng (Custom Domain)' }));
    expect(screen.getByPlaceholderText('order.quancuaban.vn')).toHaveValue('draft.example.test');
  });

  it.each(['payment', 'branding', 'domains'])('synchronously locks duplicate %s form submissions and releases on rejection', async (tab) => {
    const pending = deferred<ApiResponse>();
    setupApi({ action: () => pending.promise });
    const view = renderSettings(tab);
    await waitForSettings();
    const path = tab === 'payment' ? '/api/saas/payment-config' :
      tab === 'branding' ? '/api/saas/branding' : '/api/saas/domains';
    const label = tab === 'payment' ? 'Lưu cấu hình thanh toán' :
      tab === 'branding' ? 'Lưu thương hiệu' : '+ Thêm tên miền (Pro+)';
    const form = view.container.querySelector('form')!;
    const button = screen.getByRole('button', { name: label });
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(actionCalls(path)).toHaveLength(1);
    expect(button).toBeDisabled();
    await act(async () => pending.reject(new Error('Không lưu được')));
    await waitForActionUnlocked(button);
    expect(screen.getByText('Không lưu được')).toBeInTheDocument();
    act(() => fireEvent.submit(form));
    await waitFor(() => expect(actionCalls(path)).toHaveLength(2));
    await waitForActionUnlocked(button);
  });

  it('keeps unrelated dirty forms intact after a successful branding save', async () => {
    renderSettings('payment');
    await waitForSettings();
    fireEvent.change(screen.getByDisplayValue(payment.bankAccountNo), { target: { value: 'unsaved-account' } });
    fireEvent.click(screen.getByRole('button', { name: '3. Thương hiệu quán' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thương hiệu' }));
    await waitForActionUnlocked(screen.getByRole('button', { name: 'Lưu thương hiệu' }));
    expect(actionCalls('/api/saas/branding')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '2. Thanh toán trực tiếp (VietQR / PayOS)' }));
    expect(screen.getByDisplayValue('unsaved-account')).toBeInTheDocument();
  });
});
