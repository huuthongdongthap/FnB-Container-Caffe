import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import KitchenDisplay from '../kitchen-display';
import { apiFetch } from '@/lib/api-client';
import { saveClientSession } from '@/lib/client-session';

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const sampleOrders = [
  {
    id: 'ord-1',
    order_number: 'ORD-001',
    table_name: '01',
    status: 'pending' as const,
    created_at: new Date().toISOString(),
    items: [{ name: 'Cà phê sữa', quantity: 1 }],
  },
];

describe('Mobile KitchenDisplay mutation error and retry behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces PATCH error per order without faking status update and allows retry', async () => {
    let patchCalls = 0;
    mockApiFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/mobile/kds/orders') {
        return { success: true, orders: sampleOrders };
      }
      if (url === '/mobile/kds/orders/ord-1/status' && options?.method === 'PATCH') {
        patchCalls += 1;
        if (patchCalls === 1) {
          throw new Error('500 Server Error');
        }
        return { success: true };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    render(<KitchenDisplay />);

    const startBtn = await screen.findByRole('button', { name: /Bắt đầu|Start/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('500 Server Error');
    });

    // Status remains pending (not faked as preparing)
    expect(screen.getByRole('button', { name: /Bắt đầu|Start/i })).toBeInTheDocument();

    // Retry succeeds and clears error
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(patchCalls).toBe(2);
  });

  it('blocks duplicate PATCH submissions while an order update is in flight', async () => {
    let resolvePatch!: () => void;
    let patchCalls = 0;

    mockApiFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/mobile/kds/orders') {
        return { success: true, orders: sampleOrders };
      }
      if (url === '/mobile/kds/orders/ord-1/status' && options?.method === 'PATCH') {
        patchCalls += 1;
        await new Promise<void>((resolve) => {
          resolvePatch = resolve;
        });
        return { success: true };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    render(<KitchenDisplay />);

    const startBtn = await screen.findByRole('button', { name: /Bắt đầu|Start/i });
    fireEvent.click(startBtn);
    fireEvent.click(startBtn);

    expect(patchCalls).toBe(1);
    expect(startBtn).toBeDisabled();

    resolvePatch();
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/mobile/kds/orders/ord-1/status',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('renders localized cancelled alert banner, dismisses it, and resets dismissed state on session change', async () => {
    const ordersWithCancelled = [
      ...sampleOrders,
      {
        id: 'ord-cancelled-1',
        order_number: '#ORD-909',
        table_name: '05',
        order_type: 'dine_in',
        status: 'cancelled' as const,
        cancel_alert: true,
        created_at: new Date().toISOString(),
        items: [{ name: 'Matcha Latte', quantity: 2 }],
      },
    ];

    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/mobile/kds/orders') {
        return { success: true, orders: ordersWithCancelled };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    render(<KitchenDisplay />);

    const alertBanner = await screen.findByRole('alert');
    expect(alertBanner).toHaveTextContent('#ORD-909');
    expect(alertBanner).toHaveTextContent('2x Matcha Latte');

    const dismissBtn = screen.getByRole('button', { name: /Đã hiểu|Dismiss|kds\.dismiss/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // Session switch clears dismissedCancelledIds so new session sees cancelled alerts cleanly
    await act(async () => {
      saveClientSession('token-new-session', {
        id: 'staff-next',
        name: 'Next Barista',
        role: 'barista',
        tenantId: 'store-b',
      });
    });

    const restoredBanner = await screen.findByRole('alert');
    expect(restoredBanner).toHaveTextContent('#ORD-909');
  });
});
