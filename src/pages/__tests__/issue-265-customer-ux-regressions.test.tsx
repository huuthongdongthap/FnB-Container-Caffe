import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuestInfoForm } from '@/pages/TableOrder-components';
import { reviewRecordToEntry } from '@/pages/ReviewsPage-utils';
import { getShellConfig } from '@/components/stitch/shell-config';
import TableCheckin from '@/pages/TableCheckin';
import ForgotPasswordPage from '@/pages/forgot-password';
import AccountPage from '@/pages/account';
import { CheckoutPage } from '@/pages/checkout';
import { StitchCheckoutNew } from '@/components/stitch/StitchCheckoutNew';
import { StitchMobileOrderNew } from '@/components/stitch/StitchMobileOrderNew';
import * as apiClient from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useOrderStore } from '@/hooks/stores/use-order-store';

describe('Issue #265 customer frontend & UX regressions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.getState().clearCart();
    useAuthStore.setState({ user: null, loading: false, error: null });
    useOrderStore.setState({ currentOrder: null, loading: false, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders GuestInfoForm in sticky document flow rather than fixed overlay', () => {
    render(
      <MemoryRouter>
        <GuestInfoForm
          guestName=""
          guestPhone=""
          paymentMethod="cod"
          isSubmitting={false}
          submitError={null}
          onNameChange={() => {}}
          onPhoneChange={() => {}}
        />
      </MemoryRouter>,
    );
    const bar = screen.getByTestId('table-order-guest-form');
    expect(bar.className).toContain('sticky');
    expect(bar.className).not.toContain('fixed');
  });

  it('maps review content field when comment is absent', () => {
    const entry = reviewRecordToEntry({
      id: 'rev-1',
      order_id: 'ord-1',
      customer_name: 'Minh',
      rating: 5,
      comment: '',
      content: 'Cà phê muối rất ngon!',
      created_at: '2026-11-26T10:00:00Z',
    } as Parameters<typeof reviewRecordToEntry>[0]);
    expect(entry.content).toBe('Cà phê muối rất ngon!');
  });

  it('strips /vi and /en locale prefixes in getShellConfig for /order', () => {
    const viConfig = getShellConfig('/vi/order');
    const enConfig = getShellConfig('/en/order');
    expect(viConfig?.showTop).toBe(false);
    expect(viConfig?.showNav).toBe(false);
    expect(enConfig?.showTop).toBe(false);
    expect(enConfig?.showNav).toBe(false);
  });

  it('rejects invalid phone numbers on /table-checkin without writing to localStorage', () => {
    window.history.pushState({}, '', '/table-checkin?table=1');
    render(
      <MemoryRouter initialEntries={['/table-checkin?table=1']}>
        <TableCheckin />
      </MemoryRouter>,
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'Khach Hang' } });
    fireEvent.change(inputs[1]!, { target: { value: 'abc' } });
    const submitBtn = screen.getByRole('button', { name: /xác nhận/i });
    fireEvent.click(submitBtn);

    expect(window.localStorage.getItem('aura_saved_customer')).toBeNull();
    expect(screen.getByText(/Số điện thoại không hợp lệ/i)).toBeTruthy();
  });

  it('links forgot-password back-to-login to customer /login instead of /admin/login', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Quay lại đăng nhập/i });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('saves account profile updates to PATCH /api/customers/me instead of /api/auth/me', async () => {
    useAuthStore.setState({
      user: {
        id: 'cust-1',
        name: 'Minh Nguyen',
        email: 'minh@example.com',
        role: 'customer',
        phone: '0901234567',
      },
    });
    const apiSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/customers/me' && init?.method === 'PATCH') {
        return {
          success: true,
          data: {
            id: 'cust-1',
            name: 'Minh Updated',
            phone: '0909998888',
            email: 'minh@example.com',
            loyalty_tier: 'silver',
            loyalty_points: 120,
            lifetime_points: 120,
            cashback_balance: 0,
            total_spent: 0,
            total_earned: 0,
            visit_count: 1,
            created_at: '2026-01-01T00:00:00Z',
          },
        } as never;
      }
      if (path === '/api/customers/me') {
        return {
          success: true,
          data: {
            id: 'cust-1',
            name: 'Minh Nguyen',
            phone: '0901234567',
            email: 'minh@example.com',
            loyalty_tier: 'silver',
            loyalty_points: 120,
            lifetime_points: 120,
            cashback_balance: 0,
            total_spent: 0,
            total_earned: 0,
            visit_count: 1,
            created_at: '2026-01-01T00:00:00Z',
          },
        } as never;
      }
      if (path.startsWith('/api/orders')) {
        return { success: true, data: { orders: [] } } as never;
      }
      return { success: true, data: {} } as never;
    });

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    const editBtn = await screen.findByRole('button', { name: /Chỉnh sửa hồ sơ/i });
    fireEvent.click(editBtn);

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Minh Updated' } });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/i), { target: { value: '0909998888' } });
    fireEvent.submit(screen.getByTestId('account-edit-profile-form'));

    await waitFor(() => {
      const patchCall = apiSpy.mock.calls.find(
        ([url, opts]) => url === '/api/customers/me' && opts?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
    });
    const brokenAuthPatch = apiSpy.mock.calls.find(
      ([url, opts]) => url === '/api/auth/me' && opts?.method === 'PATCH',
    );
    expect(brokenAuthPatch).toBeUndefined();
  });

  it('preserves real productId instead of item.name when retrying a failed checkout order', async () => {
    vi.spyOn(useOrderStore.getState(), 'fetchOrder').mockImplementation(async () => {
      useOrderStore.setState({
        currentOrder: {
          id: 'ord-fail-1',
          orderNumber: 'ORD-001',
          items: [
            {
              productId: 'cf-salt-01',
              name: 'Cà phê muối',
              quantity: 2,
              unitPriceCents: 35000,
              subtotalCents: 70000,
              status: 'pending',
            } as never,
          ],
          channel: 'delivery',
          subtotal: 70000,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: 70000,
          status: 'failed',
          paymentStatus: 'failed',
          createdAt: '2026-11-26T10:00:00Z',
          updatedAt: '2026-11-26T10:00:00Z',
        },
      });
    });

    render(
      <MemoryRouter initialEntries={['/checkout?order_id=ord-fail-1']}>
        <CheckoutPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const cartItems = useCartStore.getState().items;
      expect(cartItems.length).toBe(1);
      expect(cartItems[0]?.id).toBe('cf-salt-01');
      expect(cartItems[0]?.productId).toBe('cf-salt-01');
      expect(cartItems[0]?.quantity).toBe(2);
    });
  });

  it('caps StitchCheckoutNew loyalty points redemption at 50% of subtotal to match backend', async () => {
    useAuthStore.setState({
      user: {
        id: 'cust-1',
        name: 'Nguyen Minh',
        email: 'minh@example.com',
        role: 'customer',
        phone: '0901234567',
      },
    });
    window.localStorage.setItem(
      'aura_checkout_form',
      JSON.stringify({
        fullName: 'Nguyen Minh',
        phone: '0901234567',
        address: '29 Nguyen Tat Thanh',
        orderType: 'delivery',
        paymentMethod: 'payos',
      }),
    );

    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string) => {
      if (path === '/api/loyalty/summary') {
        return {
          member: {
            tier: 'gold',
            tier_vi: 'Vàng',
            loyalty_points: 1000,
            balance: 0,
            lifetime_points: 1000,
            points_rate: 1,
          },
        } as never;
      }
      return { success: true } as never;
    });

    const onPlaceOrder = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <StitchCheckoutNew
          summary={{
            items: [
              {
                id: 'cf-1',
                name: 'Cà phê đặc biệt',
                variant: 'L',
                quantity: 1,
                price: 100000,
                imageUrl: '',
              },
            ],
            subtotal: 100000,
            tax: 0,
            deliveryFee: 0,
            total: 100000,
          }}
          onPlaceOrder={onPlaceOrder}
        />
      </MemoryRouter>,
    );

    const pointsToggle = await screen.findByTestId('checkout-redeem-points-toggle', {}, { timeout: 2500 });
    const pointsCheckbox = pointsToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(pointsCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Đặt Hàng|Place Order/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onPlaceOrder).toHaveBeenCalledTimes(1);
    });
    expect(onPlaceOrder.mock.calls[0]?.[0]?.redeemPoints).toBe(500);
  });

  it('re-syncs StitchMobileOrderNew cart from localStorage when tableId switches', () => {
    window.localStorage.setItem(
      'aura_table_order_cart:T01',
      JSON.stringify([
        {
          id: 'tc001',
          name: 'Cà phê đen',
          description: '',
          price: 20000,
          priceLabel: '20.000₫',
          category: 'coffee',
          imageSrc: '',
          imageAlt: '',
          quantity: 2,
        },
      ]),
    );
    window.localStorage.setItem(
      'aura_table_order_cart:T02',
      JSON.stringify([
        {
          id: 'te006',
          name: 'Trà đào',
          description: '',
          price: 30000,
          priceLabel: '30.000₫',
          category: 'tea',
          imageSrc: '',
          imageAlt: '',
          quantity: 1,
        },
      ]),
    );

    const { rerender } = render(
      <MemoryRouter>
        <StitchMobileOrderNew tableId="T01" />
      </MemoryRouter>,
    );
    expect(screen.getByText('40.000₫')).toBeTruthy();

    rerender(
      <MemoryRouter>
        <StitchMobileOrderNew tableId="T02" />
      </MemoryRouter>,
    );
    expect(screen.getByText('30.000₫')).toBeTruthy();
    const storedT02 = JSON.parse(window.localStorage.getItem('aura_table_order_cart:T02') || '[]');
    expect(storedT02).toHaveLength(1);
    expect(storedT02[0]?.id).toBe('te006');
  });
});
