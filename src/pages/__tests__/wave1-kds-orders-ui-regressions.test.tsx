import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchKDSNew } from '@/components/stitch/StitchKDSNew';
import { FILTER_TABS, getActionForStatus } from '@/components/stitch/stitch-order-mgmt-default';
import { getStatusTransitionsForOrder } from '@/components/admin/OrderTable-constants';
import { formatTableWithPrefix } from '@/hooks/kds-order';
import { toCustomerOrderViewModel } from '@/hooks/stores/order-store-mappers';
import { deriveItemStation, sortMobileKdsOrders } from '@/pages/mobile/kitchen-display';
import KitchenOrderCard from '@/pages/mobile/kitchen-display-order-card';
import { timeAgo } from '@/pages/mobile/kitchen-display-styles';
import WaiterOrders from '@/pages/mobile/waiter-orders';

const mockMobileUser = { id: 'u1', name: 'Staff', role: 'waiter', tenantId: 'default' };
vi.mock('@/hooks/use-mobile-auth', () => ({
  useMobileAuth: () => ({
    token: 'tok-test',
    user: mockMobileUser,
    logout: vi.fn(),
    forgetDevice: vi.fn(),
  }),
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

describe('Wave 1 KDS & Orders UI Regressions (#213, #216, #220, #221, #234)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMobileUser.role = 'waiter';
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === '/mobile/tables') {
        return { success: true, tables: [{ id: 'tbl-1', table_number: 1, status: 'occupied' }] };
      }
      if (url === '/mobile/orders') {
        return {
          success: true,
          orders: [
            {
              id: 'ord-mob-ready',
              order_number: 'ORD-7788',
              order_type: 'takeaway',
              table_id: '',
              table_number: 0,
              customer_name: 'Chị Mai',
              payment_method: 'cash',
              payment_status: 'paid',
              notes: 'Ít ngọt | [OVERDUE]',
              status: 'ready',
              created_at: '2026-11-25 03:00:00',
              items: [{ name: 'Trà đào cam sả', quantity: 2, note: '' }],
            },
          ],
        };
      }
      if (url === '/api/products') {
        return { success: true, products: [{ id: 'p1', name: 'Latte', price: 45000 }] };
      }
      return { success: true };
    });
  });

  it('#213 & #216: renders single workflow pill + single SLA indicator, 3-lane queue numbers, collapsible >24h stale section, dynamic storeName, All-Day summary, and Recall drawer', () => {
    const onToggleItem = vi.fn();
    const onRecall = vi.fn();

    renderWithProviders(
      <StitchKDSNew
        storeName="SA ĐÉC FLAGSHIP"
        stationLocation="QUẦY BAR"
        onToggleItemReady={onToggleItem}
        onRecallTicket={onRecall}
        recentTickets={[
          { id: 'ord-rec-1', displayId: '#ORD-101', table: 'Bàn 02', status: 'ready', itemsSummary: '2x Latte' },
        ]}
        tickets={[
          {
            id: '#OVD_PREP',
            table: 'Bàn 01',
            type: 'DINE IN',
            status: 'overdue',
            rawStatus: 'preparing',
            isOverdue: true,
            items: [{ name: 'Espresso', quantity: 2, ready: false }],
            elapsedSeconds: 1020,
          },
          {
            id: '#WARN_PND',
            table: 'Bàn 03',
            type: 'DINE IN',
            status: 'pending',
            rawStatus: 'pending',
            isWarning: true,
            items: [{ name: 'Espresso', quantity: 1, ready: false }],
            elapsedSeconds: 700,
          },
          {
            id: '#FIFO_PND',
            table: 'Bàn 04',
            type: 'TOGO',
            status: 'pending',
            rawStatus: 'pending',
            items: [{ name: 'Matcha', quantity: 1 }],
            elapsedSeconds: 180,
          },
          {
            id: '#EXPO_RDY',
            table: 'Bàn 05',
            type: 'DINE IN',
            status: 'ready',
            rawStatus: 'ready',
            items: [{ name: 'Cold Brew', quantity: 1, ready: true }],
            elapsedSeconds: 400,
            readyWaitSeconds: 120,
          },
          {
            id: '#ZOMBIE_OLD',
            table: 'Bàn 09',
            type: 'DINE IN',
            status: 'overdue',
            rawStatus: 'preparing',
            isOverdue: true,
            items: [{ name: 'Old Coffee', quantity: 1 }],
            elapsedSeconds: 100_000,
          },
        ]}
      />,
    );

    // Dynamic store name rendered instead of hardcoded AURA CAFE
    expect(screen.getByText(/SA ĐÉC FLAGSHIP/)).toBeInTheDocument();

    // Queue numbers #1, #2 assigned in Pending lane
    expect(screen.getByTestId('kds-queue-rank-#WARN_PND')).toHaveTextContent('#1');
    expect(screen.getByTestId('kds-queue-rank-#FIFO_PND')).toHaveTextContent('#2');

    // Stale >24h ticket hidden inside collapsed stale section by default
    expect(screen.queryByText('#ZOMBIE_OLD')).toBeNull();

    // All-Day batch summary aggregates 3x Espresso + 1x Matcha across active non-ready in-shift tickets
    fireEvent.click(screen.getByRole('button', { name: /Tổng hợp món|All-Day Batch/i }));
    expect(screen.getByText('3×')).toBeInTheDocument();

    // Recall drawer opens and triggers onRecallTicket
    fireEvent.click(screen.getByRole('button', { name: /Gọi lại phiếu|Recall/i }));
    expect(screen.getByText(/#ORD-101/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hoàn tác|Undo/i }));
    expect(onRecall).toHaveBeenCalledWith('ord-rec-1', 'preparing');
  });

  it('#213 & #220 & #221: fixes Mobile KDS UTC timeAgo, cold tea/matcha station routing, notes/order_number display, and waiter/cashier button RBAC', () => {
    const fiveMinUtc = new Date(Date.now() - 5 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
    expect(timeAgo(fiveMinUtc, { lang: 'en' })).toBe('5m');
    expect(timeAgo(fiveMinUtc, { lang: 'vi' })).toBe('5p');

    expect(deriveItemStation({ name: 'Trà đào cam sả đá', quantity: 1 })).toBe('cold');
    expect(deriveItemStation({ name: 'Iced Matcha Latte', quantity: 1 })).toBe('cold');
    expect(deriveItemStation({ name: 'Hot Matcha Latte', quantity: 1 })).toBe('espresso');
    expect(deriveItemStation({ name: 'Double Espresso', quantity: 1 })).toBe('espresso');

    const sortedMob = sortMobileKdsOrders([
      { id: 'rdy', table_name: '1', status: 'ready', created_at: fiveMinUtc, ready_at: fiveMinUtc, items: [] },
      { id: 'pnd', table_name: '2', status: 'pending', created_at: fiveMinUtc, items: [] },
    ]);
    expect(sortedMob.map((o) => o.id)).toEqual(['pnd', 'rdy']);

    // Waiter sees order_number + notes, no duplicate 'Bàn Bàn 1', and NO Start Prep button
    const { rerender } = render(
      <KitchenOrderCard
        order={{
          id: 'ord-mob-1',
          order_number: 'ORD-555',
          customer_name: 'Anh Khoa',
          table_name: 'Bàn 1',
          order_type: 'dine_in',
          notes: 'Không đường | [OVERDUE]',
          status: 'pending',
          created_at: fiveMinUtc,
          items: [{ name: 'Cà phê đen', quantity: 1 }],
        }}
        userRole="waiter"
        updatingId={null}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText('#ORD-555')).toBeInTheDocument();
    expect(screen.getByText('Bàn 1')).toBeInTheDocument();
    expect(screen.queryByText('Bàn Bàn 1')).toBeNull();
    expect(screen.getByText(/Không đường/)).toBeInTheDocument();
    expect(screen.queryByText(/OVERDUE/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Bắt đầu|Start/i })).toBeNull();

    // Barista sees Start Prep button
    rerender(
      <KitchenOrderCard
        order={{
          id: 'ord-mob-1',
          order_number: 'ORD-555',
          table_name: 'Bàn 1',
          order_type: 'dine_in',
          status: 'pending',
          created_at: fiveMinUtc,
          items: [{ name: 'Cà phê đen', quantity: 1 }],
        }}
        userRole="barista"
        updatingId={null}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Bắt đầu|Start/i })).toBeInTheDocument();
  });

  it('#220 & #221: aligns FILTER_TABS, getActionForStatus, OrderTable transitions, formatTableWithPrefix, and order-store-mappers UTC/status labels', () => {
    const tabKeys = FILTER_TABS.map((t) => t.key);
    expect(tabKeys).toContain('delivering');
    expect(tabKeys).toContain('failed');
    expect(tabKeys).toContain('expired');

    expect(getActionForStatus('ready', 'delivery')).toBe('delivering');
    expect(getActionForStatus('ready', 'dine_in')).toBe('serve');

    expect(getStatusTransitionsForOrder('ready', 'dine_in')).toEqual(['served', 'cancelled']);
    expect(getStatusTransitionsForOrder('ready', 'delivery')).toEqual(['delivering', 'cancelled']);
    expect(getStatusTransitionsForOrder('served', 'dine_in')).toEqual(['completed']);

    expect(formatTableWithPrefix('Bàn 1', (c) => `Bàn ${c}`)).toBe('Bàn 1');
    expect(formatTableWithPrefix('05', (c) => `Bàn ${c}`)).toBe('Bàn 05');

    const vm = toCustomerOrderViewModel({
      id: 'ord-vm-1',
      orderNumber: 'ORD-VM1',
      items: [],
      channel: 'delivery',
      subtotal: 50000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 50000,
      status: 'delivering',
      paymentStatus: 'paid',
      createdAt: '2026-11-25 02:30:00',
      updatedAt: '2026-11-25 02:35:00',
    });
    expect(vm.displayStatus).toBe('Đang giao');
  });

  it('#234 & #221: gates + New Order FAB on WaiterOrders by role and renders order_number, Mang đi (not Bàn 0), and ready -> served action', async () => {
    mockMobileUser.role = 'waiter';
    const { unmount } = renderWithProviders(<WaiterOrders />);

    expect(await screen.findByText('#ORD-7788')).toBeInTheDocument();
    expect(screen.getByText(/Mang đi|To Go/i)).toBeInTheDocument();
    expect(screen.queryByText('Bàn 0')).toBeNull();
    expect(screen.getByRole('button', { name: 'New order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đã phục vụ|Served/i })).toBeInTheDocument();
    unmount();

    // Kitchen role cannot create mobile orders -> + FAB must be hidden
    mockMobileUser.role = 'kitchen';
    renderWithProviders(<WaiterOrders />);
    await screen.findByText('#ORD-7788');
    expect(screen.queryByRole('button', { name: 'New order' })).toBeNull();
  });
});
