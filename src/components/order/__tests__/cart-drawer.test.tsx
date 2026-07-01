import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { CartDrawer } from '@/components/order/cart-drawer';
import type { CartItem } from '@/hooks/stores/use-cart-store';

const MOCK_ITEMS: CartItem[] = [
  { id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 },
  { id: '2', name: 'Cold Brew', price: 45000, quantity: 1 },
];

describe('CartDrawer', () => {
  it('renders items when open', () => {
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={MOCK_ITEMS}
        subtotal={115000}
        serviceFee={5750}
        total={120750}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={185000}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    expect(screen.getByText('Cà phê sữa đá')).toBeInTheDocument();
    expect(screen.getByText('Cold Brew')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={[]}
        subtotal={0}
        serviceFee={0}
        total={0}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={300000}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    expect(screen.getByText('Giỏ hàng trống')).toBeInTheDocument();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(
      <CartDrawer
        open={true}
        onClose={onClose}
        items={MOCK_ITEMS}
        subtotal={115000}
        serviceFee={5750}
        total={120750}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={185000}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onUpdateQuantity when +/- buttons clicked', () => {
    const onUpdateQuantity = vi.fn();
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={MOCK_ITEMS}
        subtotal={115000}
        serviceFee={5750}
        total={120750}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={185000}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    const decreaseButtons = screen.getAllByRole('button', { name: /giảm số lượng/i });
    expect(decreaseButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(decreaseButtons[0]!);
    expect(onUpdateQuantity).toHaveBeenCalledWith('1', 1);
  });

  it('calls onRemove when delete button clicked', () => {
    const onRemove = vi.fn();
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={MOCK_ITEMS}
        subtotal={115000}
        serviceFee={5750}
        total={120750}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={185000}
        onUpdateQuantity={() => {}}
        onRemove={onRemove}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    const deleteButtons = screen.getAllByRole('button', { name: /xoá/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(deleteButtons[0]!);
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('shows free delivery message when qualifying', () => {
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={MOCK_ITEMS}
        subtotal={350000}
        serviceFee={17500}
        total={367500}
        qualifiesForFreeDelivery={true}
        remainingForFreeDelivery={0}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    expect(screen.getByText(/Miễn phí giao hàng/)).toBeInTheDocument();
  });

  it('shows free delivery threshold message', () => {
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={MOCK_ITEMS}
        subtotal={115000}
        serviceFee={5750}
        total={120750}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={185000}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={() => {}}
      />,
    );
    expect(screen.getByText(/185\.000/)).toBeInTheDocument();
  });

  it('calls onCheckout when checkout button clicked', () => {
    const onCheckout = vi.fn();
    render(
      <CartDrawer
        open={true}
        onClose={() => {}}
        items={MOCK_ITEMS}
        subtotal={115000}
        serviceFee={5750}
        total={120750}
        qualifiesForFreeDelivery={false}
        remainingForFreeDelivery={185000}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onClearCart={() => {}}
        onCheckout={onCheckout}
      />,
    );
    fireEvent.click(screen.getByText(/Thanh toán/));
    expect(onCheckout).toHaveBeenCalled();
  });
});
