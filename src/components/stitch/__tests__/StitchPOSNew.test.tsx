import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchPOSNew } from '../StitchPOSNew';
import { formatPosPrice, type POSNewMenuItem, type POSNewAddOn } from '../StitchPOSNew-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'posNew.addOnPrefix': 'Add On Prefix',
        'posNew.addToCart': 'Add To Cart',
        'posNew.cartEmpty': 'Cart Empty',
        'posNew.cartSection': 'Cart Section',
        'posNew.category': 'Category',
        'posNew.categoryFilter': 'Category Filter',
        'posNew.closeCart': 'Close Cart',
        'posNew.cod': 'Cod',
        'posNew.completeOrder': 'Complete Order',
        'posNew.connected': 'Connected',
        'posNew.decrementQuantity': 'Decrement Quantity',
        'posNew.endShift': 'End Shift',
        'posNew.footerNav': 'Footer Nav',
        'posNew.incrementQuantity': 'Increment Quantity',
        'posNew.loadingText': 'Loading Text',
        'posNew.menuSection': 'Menu Section',
        'posNew.noItemsInCategory': 'No Items In Category',
        'posNew.noResults': 'No Results',
        'posNew.openCart': 'Open Cart',
        'posNew.openDrawer': 'Open Drawer',
        'posNew.order': 'Order',
        'posNew.orderSummary': 'Order Summary',
        'posNew.payos': 'Payos',
        'posNew.popularAddOns': 'Popular Add Ons',
        'posNew.printReceipt': 'Print Receipt',
        'posNew.reboot': 'Reboot',
        'posNew.schedule': 'Schedule',
        'posNew.searchPlaceholder': 'Search Placeholder',
        'posNew.subtotal': 'Subtotal',
        'posNew.tax': 'Tax',
        'posNew.terminalSession': 'Terminal Session',
        'posNew.terminalVersion': 'Terminal Version',
        'posNew.total': 'Total',
        'posNew.userProfile': 'User Profile',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  Plus: () => null,
  Minus: () => null,
  ShoppingCart: () => null,
  CreditCard: () => null,
  Wallet: () => null,
  ArrowRight: () => null,
  Clock: () => null,
  Terminal: () => null,
  PersonStanding: () => null,
  LogOut: () => null,
  Receipt: () => null,
  Printer: () => null,
  Loader2: () => null,
  AlertCircle: () => null,
  AlertTriangle: () => null,
  Coffee: () => null,
  Home: () => null,
  LayoutDashboard: () => null,
  ClipboardList: () => null,
  ChefHat: () => null,
  UserCheck: () => null,
  X: () => null,
}));

const CUSTOM_ITEMS: POSNewMenuItem[] = [
  { id: 'p1', name: 'Custom Brew', price: 5.0, category: 'Coffee' },
];

const _CUSTOM_ADDONS: POSNewAddOn[] = [
  { id: 'pa1', name: 'Extra Shot', price: 1.5 },
];

describe('formatPosPrice', () => {
  it.each([
    [0, '0₫'],
    [500, '500₫'],
    [999, '999₫'],
    [1000, '1.000₫'],
    [35000, '35.000₫'],
    [499.5, '500₫'],
  ])('formats %s as %s in VND', (value, expected) => {
    expect(formatPosPrice(value)).toBe(expected);
  });
});

describe('StitchPOSNew', () => {
  it('renders the empty cart total in VND, not USD', () => {
    renderWithProviders(<StitchPOSNew menuItems={CUSTOM_ITEMS} />);
    expect(screen.getAllByText('0₫').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('renders add-on chip prices below 1,000 in VND, not USD', () => {
    renderWithProviders(
      <StitchPOSNew
        menuItems={CUSTOM_ITEMS}
        addOns={[
          { id: 'a-low', name: 'Syrup Pump', price: 500 },
          { id: 'a-high', name: 'Oat Milk', price: 10000 },
        ]}
      />
    );
    expect(screen.getByText('+500₫')).toBeTruthy();
    expect(screen.getByText('+10.000₫')).toBeTruthy();
    expect(screen.queryByText('+$500.00')).toBeNull();
  });
  it('renders with default menu items', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Midnight Espresso')).toBeTruthy();
    expect(screen.getByText('Chrome Velvet')).toBeTruthy();
  });

  it('renders with custom menu items', () => {
    renderWithProviders(<StitchPOSNew menuItems={CUSTOM_ITEMS} />);
    expect(screen.getByText('Custom Brew')).toBeTruthy();
    expect(screen.queryByText('Midnight Espresso')).toBeNull();
  });

  it('renders search input', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByPlaceholderText('Search Placeholder')).toBeTruthy();
  });

  it('renders category filter chips', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Tea')).toBeTruthy();
  });

  it('shows empty cart state initially', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Cart Empty')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchPOSNew loading />);
    expect(screen.getByText('Loading Text')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchPOSNew error="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeTruthy();
  });

  it('adds items to cart when clicked', () => {
    renderWithProviders(<StitchPOSNew />);
    const espressoCard = screen.getByText('Midnight Espresso').closest('[data-glass]');
    if (espressoCard) {
      fireEvent.click(espressoCard);
      expect(screen.getByText('1')).toBeTruthy();
    }
  });

  it('renders brand name', () => {
    renderWithProviders(<StitchPOSNew brandName="MY POS" />);
    expect(screen.getByText('MY POS')).toBeTruthy();
  });

  it('calls onCompleteOrder when complete order button is clicked', () => {
    const onCompleteOrder = vi.fn();
    renderWithProviders(<StitchPOSNew onCompleteOrder={onCompleteOrder} />);
    // Find and click the add-to-cart button (aria-label based)
    const addBtns = screen.getAllByRole('button', { name: /Add to Cart/i });
    expect(addBtns.length).toBeGreaterThan(0);
    fireEvent.click(addBtns[0]!);
    // Now the complete order button should be enabled
    const completeBtn = screen.getByText('Complete Order');
    expect(completeBtn).not.toBeDisabled();
    fireEvent.click(completeBtn);
    expect(onCompleteOrder).toHaveBeenCalled();
  });

  it('renders table and guest labels', () => {
    renderWithProviders(<StitchPOSNew tableLabel="T-5" guestLabel="VIP" />);
    expect(screen.getByText('T-5')).toBeTruthy();
    expect(screen.getByText(/VIP/)).toBeTruthy();
  });

  it('maps cat_* category IDs to Vietnamese labels without fake English tabs and uses shrink-0', () => {
    const d1Items: POSNewMenuItem[] = [
      { id: 'tc001', name: 'Cà phê sữa đá', price: 25000, category: 'cat_trad_coffee' },
      { id: 'fp001', name: 'Matcha đá xay', price: 38000, category: 'cat_frappuccino' },
    ];
    renderWithProviders(
      <StitchPOSNew
        menuItems={d1Items}
        categoryLabels={{ cat_trad_coffee: 'Cà Phê Truyền Thống', cat_frappuccino: 'Đá Xay' }}
      />
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((el) => el.textContent)).toEqual(['Tất cả', 'Cà Phê Truyền Thống', 'Đá Xay']);
    expect(tabs[0]?.className).toContain('shrink-0');
    expect(screen.queryByText('Pastries')).toBeNull();
    expect(screen.queryByText('Brunch')).toBeNull();
  });

  it('displays real staff name and shift status badge without hardcoded Julian R.', () => {
    const onShiftAction = vi.fn();
    renderWithProviders(
      <StitchPOSNew
        menuItems={CUSTOM_ITEMS}
        staffName="Nguyễn Minh"
        activeShift={{ id: 'sh_1', shiftName: 'Ca sáng', clockIn: '2026-11-23T06:00:00+07:00' }}
        onShiftAction={onShiftAction}
      />
    );
    expect(screen.queryByText('Julian R.')).toBeNull();
    expect(screen.getByText('Nguyễn Minh')).toBeTruthy();
    const shiftBadge = screen.getByTestId('pos-shift-badge');
    expect(shiftBadge.textContent).toContain('Ca sáng');
    expect(shiftBadge.textContent).toContain('Đang mở');
    fireEvent.click(shiftBadge);
    expect(onShiftAction).toHaveBeenCalledTimes(1);
  });

  it('renders open-shift prompt when no active shift exists', () => {
    renderWithProviders(<StitchPOSNew menuItems={CUSTOM_ITEMS} activeShift={null} />);
    const shiftBadge = screen.getByTestId('pos-shift-badge');
    expect(shiftBadge.textContent).toContain('Chưa mở ca');
  });

  it('allows selecting a real table and passes selectedTableId to onCompleteOrder with 0% default tax', () => {
    const onSelectTable = vi.fn();
    const onCompleteOrder = vi.fn();
    renderWithProviders(
      <StitchPOSNew
        menuItems={[{ id: 'tc001', name: 'Cà phê sữa', price: 25000, category: 'cat_trad_coffee' }]}
        tables={[
          { id: 't01', name: 'Bàn 1', status: 'Available', capacity: 4 },
          { id: 't02', name: 'Bàn 2', status: 'Occupied', capacity: 2 },
        ]}
        selectedTableId="t01"
        onSelectTable={onSelectTable}
        onCompleteOrder={onCompleteOrder}
      />
    );
    const selector = screen.getByTestId('pos-table-selector') as HTMLSelectElement;
    expect(selector.value).toBe('t01');
    fireEvent.change(selector, { target: { value: 't02' } });
    expect(onSelectTable).toHaveBeenCalledWith('t02');

    // Add item and complete order — total must be 25000 (0% default tax, no 5% hidden fee)
    fireEvent.click(screen.getByText('Cà phê sữa'));
    fireEvent.click(screen.getByText('Complete Order'));
    expect(onCompleteOrder).toHaveBeenCalledWith(
      [{ id: 'tc001', name: 'Cà phê sữa', price: 25000, quantity: 1 }],
      25000,
      't01'
    );
    // No fake English add-ons by default and no dead Open Drawer button
    expect(screen.queryByText('Oat Milk')).toBeNull();
    expect(screen.queryByLabelText('Open Drawer')).toBeNull();
  });

  it('provides 1-tap navigation buttons in POSHeader', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<StitchPOSNew menuItems={CUSTOM_ITEMS} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByLabelText('Quản trị'));
    expect(onNavigate).toHaveBeenCalledWith('/admin');
    fireEvent.click(screen.getByLabelText('Đơn hàng'));
    expect(onNavigate).toHaveBeenCalledWith('/admin/orders');
    fireEvent.click(screen.getByLabelText('KDS'));
    expect(onNavigate).toHaveBeenCalledWith('/kds');
    fireEvent.click(screen.getByLabelText('Trang chủ'));
    expect(onNavigate).toHaveBeenCalledWith('/');
  });
});
