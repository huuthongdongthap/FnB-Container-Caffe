import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TableOrder } from '../TableOrder';
import type { CartItem } from '@/components/stitch';

const mockCreateOrder = vi.fn();
const mockFlushQueuedOrders = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/components/stitch/StitchLandingNew-nav', () => ({
  LandingNav: () => null,
}));

vi.mock('@/components/stitch/StitchLandingNew-footer', () => ({
  LandingFooter: () => null,
}));

vi.mock('@/components/stitch', () => ({
  StitchMobileOrderNew: ({
    tableId,
    onViewCart,
  }: {
    tableId?: string;
    onViewCart?: (cart: CartItem[]) => void;
  }) => (
    <div>
      <span data-testid="mock-table-id">{tableId}</span>
      <button
        type="button"
        onClick={() =>
          onViewCart?.([
            {
              id: 'tc001',
              name: 'Cà phê máy / phin truyền thống',
              price: 20000,
              quantity: 1,
              description: 'Robusta rang mộc',
              priceLabel: '20.000₫',
              category: 'coffee',
              imageSrc: '/coffee.webp',
              imageAlt: 'Cà phê',
            },
          ])
        }
      >
        Gửi đơn tại bàn
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/stores/use-order-store', () => {
  const state = {
    queuedOffline: false,
    error: null,
    createOrder: (...args: unknown[]) => mockCreateOrder(...args),
    flushQueuedOrders: (...args: unknown[]) => mockFlushQueuedOrders(...args),
  };
  return {
    useOrderStoreWithOfflineFlush: <T,>(selector: (s: typeof state) => T) => selector(state),
    useOrderStore: {
      getState: () => state,
    },
  };
});

describe('TableOrder cash payment display and submit payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockCreateOrder.mockResolvedValue({ id: 'ord-table-01' });
    mockFlushQueuedOrders.mockResolvedValue(undefined);
  });

  it('displays Tiền mặt tại quán before submit and submits cod without PayOS redirect', async () => {
    render(
      <MemoryRouter initialEntries={['/order?table=01']}>
        <Routes>
          <Route path="/order" element={<TableOrder />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('table-order-payment-method')).toHaveTextContent(
      'Phương thức thanh toán: Tiền mặt tại quán',
    );

    fireEvent.change(screen.getByPlaceholderText('Tên của bạn'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('Số điện thoại'), {
      target: { value: '0901234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn tại bàn' }));

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          table_id: '01',
          order_type: 'dine_in',
          payment_method: 'cod',
          customer_name: 'Nguyễn Văn A',
          customer_phone: '0901234567',
        }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith('/order-success?order_id=ord-table-01');
  });
});
