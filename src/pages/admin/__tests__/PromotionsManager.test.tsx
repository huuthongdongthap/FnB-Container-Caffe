import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

import PromotionsManagerPage from '@/pages/admin/PromotionsManager';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: any) => selector ? selector({ token: 'test-token', user: null, fetchMe: vi.fn() }) : { token: 'test-token', user: null, fetchMe: vi.fn() },
    { getState: () => ({ token: 'test-token', user: null }) },
  ),
}));

vi.mock('@/lib/api-client', () => ({
  API_BASE: 'http://localhost:3001',
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, loading }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-loading={loading}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ label, error, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input {...props} />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />,
}));

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children, title }: any) =>
    open ? (
      <div data-testid="modal">
        <span data-testid="modal-title">{title}</span>
        {children}
      </div>
    ) : null,
}));

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
  {
    code: 'WELCOME10',
    percent: 10,
    max_discount: 0,
    min_order: 0,
    usage_limit: 0,
    usage_count: 50,
    starts_at: null,
    expires_at: null,
    is_active: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('PromotionsManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: MOCK_PROMOS }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    renderWithProviders(<PromotionsManagerPage />);
    expect(screen.getAllByText('title').length).toBeGreaterThanOrEqual(1);
  });

  it('shows promotion count after loading', async () => {
    renderWithProviders(<PromotionsManagerPage />);
    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeTruthy();
    });
    expect(screen.getByText('WELCOME10')).toBeTruthy();
  });

  it('shows promotion codes in table', async () => {
    renderWithProviders(<PromotionsManagerPage />);
    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeTruthy();
    });
  });

  it('renders add promotion button', () => {
    renderWithProviders(<PromotionsManagerPage />);
    expect(screen.getByText('addPromotion')).toBeTruthy();
  });

  it('opens modal when add button is clicked', async () => {
    renderWithProviders(<PromotionsManagerPage />);
    await waitFor(() => {
      expect(screen.getByText('addPromotion')).toBeTruthy();
    });
    const addBtn = screen.getByText('addPromotion');
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeTruthy();
    });
  });

  it('shows loading skeleton while fetching', async () => {
    // Override fetch to hang (never resolves)
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PromotionsManagerPage />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
