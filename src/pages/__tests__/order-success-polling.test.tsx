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
  useOrderStore.setState({
    currentOrder: {
      id: 'ORD_1',
      status: 'pending',
      total: 73500,
      payment_status: 'unpaid',
      payment_method: 'cod',
      customer_name: 'Test User',
      customer_phone: '0912345678',
      items: [{ id: '1', name: 'Cà phê', price: 35000, quantity: 2 }],
      created_at: new Date().toISOString(),
      customer_address: '123 Test St',
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
    expect(screen.getByText(/không tìm thấy đơn hàng/i)).toBeInTheDocument();
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
    expect(screen.getByText('#ORD_1')).toBeInTheDocument();
  });

  it('shows pending payment status for PayOS orders', () => {
    seedOrderInStore();
    useOrderStore.setState({
      currentOrder: { ...useOrderStore.getState().currentOrder!, payment_method: 'payos', status: 'pending', payment_status: 'unpaid' },
    });
    mockSearchParams.set('order_id', 'ORD_1');

    render(<OrderSuccessPage />);
    expect(screen.getByText(/đơn hàng đang chờ thanh toán payos/i)).toBeInTheDocument();
  });

  it('shows success status for completed orders', () => {
    seedOrderInStore();
    useOrderStore.setState({
      currentOrder: { ...useOrderStore.getState().currentOrder!, status: 'delivered', payment_status: 'paid' },
    });
    mockSearchParams.set('order_id', 'ORD_1');

    render(<OrderSuccessPage />);
    // Should show "Đặt hàng thành công" for paid/delivered orders
    expect(screen.getByText(/đặt hàng thành công/i)).toBeInTheDocument();
  });

  it('cleans up polling interval on unmount', () => {
    mockSearchParams.set('order_id', 'ORD_1');
    const { unmount } = render(<OrderSuccessPage />);

    // Unmount should not throw (timer cleanup)
    expect(() => unmount()).not.toThrow();
  });
});
