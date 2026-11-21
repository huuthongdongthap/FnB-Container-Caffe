import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KitchenDisplay from '../kitchen-display';
import { apiFetch } from '@/lib/api-client';

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

    const startBtn = await screen.findByRole('button', { name: /Bắt đầu \/ Start/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('500 Server Error');
    });

    // Status remains pending (not faked as preparing)
    expect(screen.getByRole('button', { name: /Bắt đầu \/ Start/i })).toBeInTheDocument();

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

    const startBtn = await screen.findByRole('button', { name: /Bắt đầu \/ Start/i });
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
});
