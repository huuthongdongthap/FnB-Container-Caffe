import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      let text = key ?? '';
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = `${text}:${k}=${String(v)}`;
        }
      }
      return text;
    },
    i18n: { language: 'vi', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: any) =>
      selector
        ? selector({ token: 'test-token', user: { id: 'u1', role: 'manager', tenant_id: 't1' }, fetchMe: vi.fn() })
        : { token: 'test-token', user: { id: 'u1', role: 'manager', tenant_id: 't1' }, fetchMe: vi.fn() },
    { getState: () => ({ token: 'test-token', user: { id: 'u1', role: 'manager', tenant_id: 't1' } }) },
  ),
}));

import BroadcastPage from '@/pages/admin/BroadcastPage';
import PromotionsManagerPage from '@/pages/admin/PromotionsManager';

const MOCK_PROMOS = [
  {
    code: 'SUMMER20',
    percent: 20,
    max_discount: 50000,
    min_order: 100000,
    usage_limit: 100,
    usage_count: 15,
    starts_at: '2026-06-01T00:00:00Z',
    expires_at: '2026-08-31T23:59:59Z',
    is_active: 1,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const MOCK_SEGMENTS = [
  { id: 'all', name: 'Tất cả', count: 50 },
  { id: 'vip', name: 'VIP', count: 12 },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MKT Promotion Notifications (Zalo ZNS & Facebook Page)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('BroadcastPage Facebook Page tab surfaces 503 unconfigured state honestly and keeps publish disabled', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/customers/segments')) {
        return jsonResponse({ data: MOCK_SEGMENTS });
      }
      if (url.includes('/api/promotions')) {
        return jsonResponse({ data: MOCK_PROMOS });
      }
      if (url.includes('/api/mixpost/accounts')) {
        return jsonResponse({ success: false, error: 'Mixpost not configured' }, 503);
      }
      return jsonResponse({ success: false, error: 'Unexpected request' }, 404);
    }) as unknown as typeof fetch;

    renderWithProviders(<BroadcastPage />);

    fireEvent.click(screen.getByRole('tab', { name: /broadcast\.tabFacebookPage/i }));

    await waitFor(() => {
      expect(screen.getByText('broadcast.fbNotConfigured')).toBeTruthy();
    });
    const publishBtn = screen.getByRole('button', { name: /broadcast\.fbPublishNow/i });
    expect(publishBtn).toBeDisabled();
  });

  it('BroadcastPage Facebook Page tab filters FB accounts, prefills promo, and shows real postId', async () => {
    const postedBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/customers/segments')) {
        return jsonResponse({ data: MOCK_SEGMENTS });
      }
      if (url.includes('/api/promotions')) {
        return jsonResponse({ data: MOCK_PROMOS });
      }
      if (url.includes('/api/mixpost/accounts')) {
        return jsonResponse({
          success: true,
          data: [
            { id: 7, name: 'AURA Cafe Page', provider: 'facebook_page' },
            { id: 8, name: 'AURA IG', provider: 'instagram' },
          ],
        });
      }
      if (url.includes('/api/mixpost/posts') && init?.method === 'POST') {
        postedBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse({ success: true, postId: 'fb_post_42' });
      }
      return jsonResponse({ success: false, error: 'Unexpected request' }, 404);
    }) as unknown as typeof fetch;

    renderWithProviders(<BroadcastPage />);
    fireEvent.click(screen.getByRole('tab', { name: /broadcast\.tabFacebookPage/i }));

    await waitFor(() => {
      expect(screen.getByText('AURA Cafe Page')).toBeTruthy();
    });
    expect(screen.queryByText('AURA IG')).toBeNull();

    // Quick-fill from active promo
    fireEvent.click(screen.getByText('SUMMER20 (-20%)'));
    const publishBtn = screen.getByRole('button', { name: /broadcast\.fbPublishNow/i });
    expect(publishBtn).not.toBeDisabled();

    fireEvent.click(publishBtn);
    await waitFor(() => {
      expect(screen.getByText(/fb_post_42/)).toBeTruthy();
    });
    expect(postedBodies).toHaveLength(1);
    expect(postedBodies[0]).toMatchObject({
      accounts: [7],
    });
    expect(String(postedBodies[0]?.content)).toContain('SUMMER20');
  });

  it('PromotionsManager row Notify modal sends Zalo ZNS with promo metadata and supports Facebook Page tab', async () => {
    let broadcastPayload: Record<string, unknown> | null = null;
    let generatePayload: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/promotions')) {
        return jsonResponse({ success: true, data: MOCK_PROMOS });
      }
      if (url.includes('/api/customers/segments')) {
        return jsonResponse({ data: MOCK_SEGMENTS });
      }
      if (url.includes('/api/broadcast/send') && init?.method === 'POST') {
        broadcastPayload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse({ success: true, sent_count: 12, failed_count: 0, total: 12 });
      }
      if (url.includes('/api/mixpost/accounts')) {
        return jsonResponse({
          success: true,
          data: [{ id: 9, name: 'AURA Sa Dec FB', provider: 'facebook_page' }],
        });
      }
      if (url.includes('/api/mixpost/generate') && init?.method === 'POST') {
        generatePayload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse({
          success: true,
          data: { content: 'Generated SUMMER20 copy #AuraCafe', hashtags: ['#AuraCafe'] },
        });
      }
      return jsonResponse({ success: false, error: 'Unexpected request' }, 404);
    }) as unknown as typeof fetch;

    renderWithProviders(<PromotionsManagerPage />);

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'notify' }));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vip' } });
    fireEvent.click(screen.getByRole('button', { name: /broadcast\.send/i }));

    // Step 1 opens inline confirmation before firing paid ZNS send
    expect(broadcastPayload).toBeNull();
    expect(screen.getByText('broadcast.confirmTitle')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /broadcast\.confirm$/i }));

    await waitFor(() => {
      expect(broadcastPayload).not.toBeNull();
    });
    expect(broadcastPayload).toMatchObject({
      segment: 'vip',
      channel: 'zns',
      promo_code: 'SUMMER20',
    });

    // Switch to Facebook Page tab inside the modal
    fireEvent.click(screen.getByRole('tab', { name: /notifyTabFacebook/i }));
    await waitFor(() => {
      expect(screen.getByText('AURA Sa Dec FB')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /broadcast\.fbGenerateBtn/i }));
    await waitFor(() => {
      expect(generatePayload).toEqual({ source: 'promotion', id: 'SUMMER20' });
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Generated SUMMER20 copy #AuraCafe',
      );
    });
  });

  it('BroadcastPage Facebook Page tab shows error alert (never false success) when Mixpost omits postId', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/customers/segments')) {
        return jsonResponse({ data: MOCK_SEGMENTS });
      }
      if (url.includes('/api/promotions')) {
        return jsonResponse({ data: MOCK_PROMOS });
      }
      if (url.includes('/api/mixpost/accounts')) {
        return jsonResponse({
          success: true,
          data: [{ id: 7, name: 'AURA Cafe Page', provider: 'facebook_page' }],
        });
      }
      if (url.includes('/api/mixpost/posts') && init?.method === 'POST') {
        return jsonResponse({ success: true });
      }
      return jsonResponse({ success: false, error: 'Unexpected request' }, 404);
    }) as unknown as typeof fetch;

    renderWithProviders(<BroadcastPage />);
    fireEvent.click(screen.getByRole('tab', { name: /broadcast\.tabFacebookPage/i }));

    await waitFor(() => {
      expect(screen.getByText('AURA Cafe Page')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('SUMMER20 (-20%)'));
    fireEvent.click(screen.getByRole('button', { name: /broadcast\.fbPublishNow/i }));

    await waitFor(() => {
      expect(screen.getByText('broadcast.fbPublishError')).toBeTruthy();
    });
    expect(screen.queryByText(/broadcast\.fbPublishSuccess/)).toBeNull();
  });

  it('formats fixed-amount VND promotions as currency and refreshes modal draft when promotion fields change in place', async () => {
    const fixedPromo = {
      code: 'CASH15K',
      tenant_id: 't1',
      percent: 0,
      discount_type: 'fixed',
      discount_value: 15000,
      max_discount: 0,
      min_order: 50000,
      usage_limit: 50,
      usage_count: 2,
      starts_at: '2026-06-01T00:00:00Z',
      expires_at: '2026-08-31T23:59:59Z',
      is_active: 1,
      created_at: '2026-06-01T00:00:00Z',
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/promotions')) {
        return jsonResponse({ success: true, data: [fixedPromo] });
      }
      if (url.includes('/api/customers/segments')) {
        return jsonResponse({ data: MOCK_SEGMENTS });
      }
      return jsonResponse({ success: true, data: [] });
    }) as unknown as typeof fetch;

    renderWithProviders(<PromotionsManagerPage />);

    await waitFor(() => {
      expect(screen.getByText('CASH15K')).toBeTruthy();
    });
    expect(screen.getByText('15.000đ')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'notify' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ưu đãi CASH15K — Giảm 15.000đ')).toBeTruthy();
    });
    expect(screen.getByDisplayValue(/Nhập mã CASH15K để giảm 15\.000đ tại AURA CAFE/)).toBeTruthy();
  });

  it('shows inline schedule validation error instead of throwing when schedule datetime is invalid', async () => {
    const postSpy = vi.fn();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/customers/segments')) {
        return jsonResponse({ data: MOCK_SEGMENTS });
      }
      if (url.includes('/api/promotions')) {
        return jsonResponse({ data: MOCK_PROMOS });
      }
      if (url.includes('/api/mixpost/accounts')) {
        return jsonResponse({
          success: true,
          data: [{ id: 7, name: 'AURA Cafe Page', provider: 'facebook_page' }],
        });
      }
      if (url.includes('/api/mixpost/posts') && init?.method === 'POST') {
        postSpy();
        return jsonResponse({ success: true, postId: 'fb_post_99' });
      }
      return jsonResponse({ success: false, error: 'Unexpected request' }, 404);
    }) as unknown as typeof fetch;

    renderWithProviders(<BroadcastPage />);
    fireEvent.click(screen.getByRole('tab', { name: /broadcast\.tabFacebookPage/i }));

    await waitFor(() => {
      expect(screen.getByText('AURA Cafe Page')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('SUMMER20 (-20%)'));
    const scheduleInput = screen.getByLabelText('broadcast.fbScheduleLabel') as HTMLInputElement;
    // Bypass HTML datetime-local input sanitization in jsdom to exercise invalid date guard
    scheduleInput.type = 'text';
    fireEvent.change(scheduleInput, { target: { value: 'not-a-valid-datetime' } });

    fireEvent.click(screen.getByRole('button', { name: /broadcast\.fbSchedulePost/i }));

    await waitFor(() => {
      expect(screen.getByText('broadcast.fbInvalidSchedule')).toBeTruthy();
    });
    expect(postSpy).not.toHaveBeenCalled();
  });
});
