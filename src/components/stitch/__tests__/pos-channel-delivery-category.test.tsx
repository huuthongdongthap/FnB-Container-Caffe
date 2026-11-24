import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CartSidebar } from '../StitchPOSNew-cart-sidebar';
import { MenuSection } from '../StitchPOSNew-menu-section';
import { resolvePosCategoryLabel } from '../StitchPOSNew-types';

vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {
    ShoppingCart: Icon,
    CreditCard: Icon,
    Wallet: Icon,
    ArrowRight: Icon,
    Plus: Icon,
    Minus: Icon,
    Search: Icon,
    Coffee: Icon,
    User: Icon,
    Phone: Icon,
    X: Icon,
    Sparkles: Icon,
    Loader2: Icon,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'vi' },
  }),
}));

vi.mock('../StitchPOSNew-customer-lookup', () => ({
  CustomerLookup: () => null,
}));

vi.mock('@/hooks/use-pos-customer', () => ({
  usePosCustomerLookup: () => ({
    mutate: vi.fn(),
    isPending: false,
    data: null,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('POS Channel, Delivery Shipping, PayOS-only & Category Labels (#151, #152, #153, #154, #157)', () => {
  it('maps English category slugs to Vietnamese labels', () => {
    expect(resolvePosCategoryLabel('traditional-coffee')).toBe('Cà Phê Truyền Thống');
    expect(resolvePosCategoryLabel('fruit-tea')).toBe('Trà Trái Cây');
    expect(resolvePosCategoryLabel('milk-tea')).toBe('Trà Sữa');
    expect(resolvePosCategoryLabel('pastries')).toBe('Bánh Ngọt');
    expect(resolvePosCategoryLabel('cat_trad_coffee')).toBe('Cà Phê Truyền Thống');
  });

  it('hides table selector in takeaway and delivery modes, shows it only in dine_in', () => {
    const tables = [{ id: 't1', name: 'Bàn 1', status: 'available' }];
    const baseProps = {
      cart: [],
      addToCart: vi.fn(),
      removeFromCart: vi.fn(),
      subtotal: 0,
      tax: 0,
      total: 0,
      tables,
      cartOpen: true,
      setCartOpen: vi.fn(),
      onSelectTable: vi.fn(),
    };

    const { rerender } = render(<CartSidebar {...baseProps} orderType="takeaway" />);
    expect(screen.queryByTestId('pos-table-selector')).toBeNull();
    expect(screen.getByTestId('pos-bill-channel-badge').textContent).toContain('Mang về');

    rerender(<CartSidebar {...baseProps} orderType="dine_in" selectedTableId="t1" />);
    expect(screen.getByTestId('pos-table-selector')).toBeTruthy();
    expect(screen.getByTestId('pos-bill-channel-badge').textContent).toBe('Bàn 1');

    rerender(<CartSidebar {...baseProps} orderType="delivery" deliveryAddress="123 Lê Lợi" />);
    expect(screen.queryByTestId('pos-table-selector')).toBeNull();
    expect(screen.getByTestId('pos-bill-channel-badge').textContent).toBe('Giao hàng');
    expect(screen.getByTestId('pos-bill-delivery-summary').textContent).toContain('123 Lê Lợi');
  });

  it('adds 15,000đ shipping fee for 1 delivery item, waives it for 2+ items, and disables COD on delivery', () => {
    const baseProps = {
      addToCart: vi.fn(),
      removeFromCart: vi.fn(),
      tax: 0,
      orderType: 'delivery' as const,
      deliveryAddress: '123 Lê Lợi',
      cartOpen: true,
      setCartOpen: vi.fn(),
      onPayment: vi.fn(),
    };

    const { rerender } = render(
      <CartSidebar
        {...baseProps}
        cart={[{ id: 'm1', name: 'Cà phê sữa đá', price: 35000, quantity: 1 }]}
        subtotal={35000}
        total={35000}
      />,
    );

    const codBtn = screen.getByRole('button', { name: 'posNew.cod' });
    expect((codBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('pos-delivery-payos-note')).toBeTruthy();
    expect(screen.getByTestId('pos-shipping-fee-row').textContent).toContain('15.000₫');
    expect(screen.getByTestId('pos-payable-total').textContent).toContain('50.000₫');

    rerender(
      <CartSidebar
        {...baseProps}
        cart={[{ id: 'm1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 }]}
        subtotal={70000}
        total={70000}
      />,
    );
    expect(screen.getByTestId('pos-shipping-fee-row').textContent).toContain('Miễn phí');
    expect(screen.getByTestId('pos-payable-total').textContent).toContain('70.000₫');
  });

  it('renders walk-in delivery recipient name and phone inputs in MenuSection', () => {
    render(
      <MenuSection
        searchQuery=""
        onSearchChange={vi.fn()}
        activeCategory="All"
        onCategoryChange={vi.fn()}
        filteredItems={[]}
        addOns={[]}
        getQuantity={() => 0}
        addToCart={vi.fn()}
        removeFromCart={vi.fn()}
        cartOpen={true}
        orderType="delivery"
        onOrderTypeChange={vi.fn()}
        deliveryAddress="123 Lê Lợi"
        onDeliveryAddressChange={vi.fn()}
        deliveryRecipientName="Nguyễn Văn A"
        onDeliveryRecipientNameChange={vi.fn()}
        deliveryRecipientPhone="0901234567"
        onDeliveryRecipientPhoneChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('pos-delivery-recipient-name')).toBeTruthy();
    expect(screen.getByTestId('pos-delivery-recipient-phone')).toBeTruthy();
  });
});
