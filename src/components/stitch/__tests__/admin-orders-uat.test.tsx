import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchOrderMgmtNew } from '../StitchOrderMgmtNew';
import type { OrderData } from '../StitchOrderMgmtNew-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

const sampleOrders: OrderData[] = [
  {
    id: 'ORD-001',
    customer: 'Tran Thi B',
    customerPhone: '0901234567',
    table: 'Bàn 02',
    orderType: 'dine_in',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    timeAgo: '5 phút trước',
    createdTimeLabel: '09:30',
    status: 'confirmed',
    items: [{ name: 'Cà phê sữa đá', quantity: 2, modifiers: ['Ít đá'] }],
    total: '70.000 ₫',
  },
];

describe('StitchOrderMgmtNew UAT regressions (#127, #135, #136, #137, #138)', () => {
  it('keeps search input mounted and focused while isLoading is true (#127, #138)', () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <StitchOrderMgmtNew
        orders={sampleOrders}
        activeFilter="all"
        searchQuery="ab"
        isLoading={false}
        onSearch={onSearch}
        showDashboardPanels={false}
      />,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('ab');

    rerender(
      <StitchOrderMgmtNew
        orders={sampleOrders}
        activeFilter="all"
        searchQuery="abc"
        isLoading={true}
        onSearch={onSearch}
        showDashboardPanels={false}
      />,
    );

    // Input is still mounted (not unmounted by full-screen spinner)
    expect(screen.getByRole('textbox')).toHaveValue('abc');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders non-blocking mutationError banner without unmounting orders (#135)', () => {
    const onDismiss = vi.fn();
    render(
      <StitchOrderMgmtNew
        orders={sampleOrders}
        activeFilter="all"
        mutationError="Invalid status transition"
        onDismissMutationError={onDismiss}
        showDashboardPanels={false}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid status transition');
    expect(screen.getByText('Tran Thi B')).toBeInTheDocument();
  });

  it('supports search field selector, channel tabs, view toggle, and Details callback (#136, #138)', () => {
    const onSearchFieldChange = vi.fn();
    const onChannelChange = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <StitchOrderMgmtNew
        orders={sampleOrders}
        activeFilter="confirmed"
        activeChannel="all"
        searchField="all"
        statusCounts={{ all: 10, confirmed: 3 }}
        onSearchFieldChange={onSearchFieldChange}
        onChannelChange={onChannelChange}
        onViewDetails={onViewDetails}
        showDashboardPanels={false}
      />,
    );

    // Search field selector
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'customer_phone' } });
    expect(onSearchFieldChange).toHaveBeenCalledWith('customer_phone');

    // Channel filter
    fireEvent.click(screen.getByRole('button', { name: 'orderMgmt.channel.delivery' }));
    expect(onChannelChange).toHaveBeenCalledWith('delivery');

    // View mode toggle to table
    fireEvent.click(screen.getByRole('button', { name: 'terminal.viewTable' }));
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Details button
    fireEvent.click(screen.getByRole('button', { name: 'terminal.details' }));
    expect(onViewDetails).toHaveBeenCalledWith(sampleOrders[0]);
  });
});
