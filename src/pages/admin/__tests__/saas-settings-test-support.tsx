import { expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSaasSettingsPage from '../SaasSettings';

const mocks = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  API_BASE: 'https://aura-space-worker.sadec-marketing-hub.workers.dev',
  apiFetch: mocks.apiMock,
}));
export const apiMock = mocks.apiMock;

export const me = {
  tenantId: 'tenant-a',
  tenant: { id: 'tenant-a', slug: 'quan-a', name: 'Quán A' },
  entitlement: {
    planId: 'pro', plan: { name: 'Pro', monthlyPriceVnd: 499000, annualPriceVnd: 4790400 },
    lifecycleState: 'active', isReadOnly: false, daysRemaining: 30,
    trialEndsAt: null, currentPeriodEnd: null,
  },
  usage: { tables: 5, maxTables: 50, staff: 2, maxStaff: 15 },
  branding: { display_name: 'Tên đã lưu', tagline: 'Slogan đã lưu' },
  domains: [{ id: 'domain-a', domain: 'order.example.test', status: 'pending', verification_token: 'txt-token' }],
};
export const payment = {
  provider: 'payos', hasPayosCredentials: true,
  bankBin: '970422', bankName: 'MB Bank', bankAccountNo: '123456789', bankAccountName: 'QUAN A',
  webhookUrl: 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api/webhook/payos/quan-a',
  webhookUrlPath: '/api/webhook/payos/quan-a',
};
export type ApiResponse = { success: boolean; error?: string; data?: unknown };
export function setupApi(options?: {
  get?: (path: string) => ApiResponse | Promise<ApiResponse>;
  action?: (path: string, init: { method?: string; body?: string }) => ApiResponse | Promise<ApiResponse>;
  invoices?: unknown[];
}) {
  apiMock.mockReset();
  apiMock.mockImplementation((path: string, init: { method?: string; body?: string } = {}) => {
    if (init.method) return options?.action?.(path, init) ?? { success: true };
    if (options?.get) return options.get(path);
    if (path === '/api/saas/me') return Promise.resolve({ success: true, data: me });
    if (path === '/api/saas/payment-config') return Promise.resolve({ success: true, data: payment });
    return Promise.resolve({ success: true, data: { invoices: options?.invoices ?? [] } });
  });
}

export function defaultGet(path: string): ApiResponse {
  if (path === '/api/saas/me') return { success: true, data: me };
  if (path === '/api/saas/payment-config') return { success: true, data: payment };
  return { success: true, data: { invoices: [] } };
}

export function renderSettings(tab = 'billing') {
  return render(<MemoryRouter initialEntries={[`/admin/saas-settings?tab=${tab}`]}>
    <AdminSaasSettingsPage />
  </MemoryRouter>);
}
export async function waitForSettings() {
  await screen.findByRole('heading', { name: 'Gói dịch vụ, Thanh toán & Thương hiệu' });
}
export function actionCalls(path: string) {
  return apiMock.mock.calls.filter(([url, init]) => url === path && init?.method);
}
export async function waitForActionUnlocked(button: HTMLElement) {
  await waitFor(() => expect(button).not.toBeDisabled());
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
