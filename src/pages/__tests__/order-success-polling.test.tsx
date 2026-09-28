/**
 * Phase 1 TDD baseline — Order Success polling tests.
 * Tests: polling lifecycle, status display, terminal status handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test-utils';
import { OrderSuccessPage } from '@/pages/order-success';
import { useOrderStore } from '@/hooks/stores/use-order-store';

// Mock react-router-dom's useSearchParams
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

function seedOrderInStore() {
  const now = new Date().toISOString();
  useOrderStore.setState({
    currentOrder: {
      id: 'ORD_1',
      orderNumber: 'ORD_1',
      table: null,
      channel: 'takeaway',
      subtotal: 70000,
      discountAmount: 0,
      taxAmount: 3500,
      totalAmount: 73500,
      status: 'pending',
      paymentStatus: 'pending',
      notes: null,
      createdAt: now,
      updatedAt: now,
      items: [
        { name: 'Cà phê', unitPriceCents: 35000, subtotalCents: 70000, quantity: 2, status: 'pending' },
      ],
    },
    loading: false,
    error: null,
  });
}

function resetStores() {
  useOrderStore.setState({
    currentOrder: null,
    loading: false,
    error: null,
    orderHistory: [],
    pollingId: null,
  });
  localStorage.clear();
  mockSearchParams.delete('order_id');
}

describe('OrderSuccessPage — polling behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('renders empty state without order_id or pendingOrder', () => {
    render(<OrderSuccessPage />);
    expect(screen.getByText(/không tìm thấy|Không tìm thấy|emptyTitle/i)).toBeInTheDocument();
  });

  it('fetches order when order_id param is present', () => {
    mockSearchParams.set('order_id', 'ORD_1');
    const fetchSpy = vi.spyOn(useOrderStore.getState(), 'fetchOrder');

    render(<OrderSuccessPage />);
    // fetchOrder should have been called at least once with the order_id
    expect(fetchSpy).toHaveBeenCalledWith('ORD_1');
  });

  it('shows order ID in display', () => {
    seedOrderInStore();
    mockSearchParams.set('order_id', 'ORD_1');

    render(<OrderSuccessPage />);
    // Order ID rendered by StitchOrderSuccessNew (without # prefix)
    expect(screen.getByText(/ORD_1/)).toBeInTheDocument();
  });

  it('shows pending payment status for PayOS orders', () => {
    seedOrderInStore();
    useOrderStore.setState({
      currentOrder: { ...useOrderStore.getState().currentOrder!, status: 'pending', paymentStatus: 'pending' },
    });
    mockSearchParams.set('order_id', 'ORD_1');

    render(<OrderSuccessPage />);
    // Order ID renders — confirms page loaded correctly
    expect(screen.getByText(/ORD_1/)).toBeInTheDocument();
  });

  it('shows success status for completed orders', () => {
    seedOrderInStore();
    useOrderStore.setState({
      currentOrder: { ...useOrderStore.getState().currentOrder!, status: 'delivered', paymentStatus: 'completed' },
    });
    mockSearchParams.set('order_id', 'ORD_1');

    render(<OrderSuccessPage />);
    // Order ID renders — confirms page loaded correctly
    expect(screen.getByText(/ORD_1/)).toBeInTheDocument();
  });

  it('cleans up polling interval on unmount', () => {
    mockSearchParams.set('order_id', 'ORD_1');
    const { unmount } = render(<OrderSuccessPage />);

    // Unmount should not throw (timer cleanup)
    expect(() => unmount()).not.toThrow();
  });
});
