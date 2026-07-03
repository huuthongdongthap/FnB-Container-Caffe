import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import StitchAdminOrders from '@/components/stitch/StitchAdminOrders';

describe('StitchAdminOrders', () => {
  it('renders loading state', () => {
    render(<StitchAdminOrders loading={true} />);
    expect(screen.getByText('Loading Orders...')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    render(<StitchAdminOrders error="Failed to fetch orders" />);
    expect(screen.getByText('Failed to fetch orders')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders stats grid', () => {
    render(<StitchAdminOrders />);
    expect(screen.getByText('Active Orders')).toBeInTheDocument();
    expect(screen.getByText('In Preparation')).toBeInTheDocument();
    expect(screen.getByText('Ready for Pickup')).toBeInTheDocument();
    expect(screen.getByText('Avg. Lead Time')).toBeInTheDocument();
    expect(screen.getByText('8.5m')).toBeInTheDocument();
  });

  it('renders order cards', () => {
    render(<StitchAdminOrders />);
    expect(screen.getByText('Julian Vane')).toBeInTheDocument();
    expect(screen.getByText('Elena Thorne')).toBeInTheDocument();
    expect(screen.getByText('Marcus Chen')).toBeInTheDocument();
    expect(screen.getByText('#AC-9821')).toBeInTheDocument();
    expect(screen.getByText('#AC-9819')).toBeInTheDocument();
  });

  it('renders status chips and search input', () => {
    render(<StitchAdminOrders />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getAllByText('Preparing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Served').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText('Search orders, tables, or customers...')).toBeInTheDocument();
  });

  it('renders empty state when no orders', () => {
    render(<StitchAdminOrders orders={[]} />);
    expect(screen.getByText('No orders yet. They will appear here once placed.')).toBeInTheDocument();
  });

  it('filters orders by search query', () => {
    render(<StitchAdminOrders />);
    const searchInput = screen.getByPlaceholderText('Search orders, tables, or customers...');
    fireEvent.change(searchInput, { target: { value: 'NO_MATCH_12345' } });
    expect(screen.getByText(/No orders match your search/)).toBeInTheDocument();
  });

  it('renders cancelled order with note', () => {
    render(<StitchAdminOrders />);
    expect(screen.getByText('Guest User')).toBeInTheDocument();
    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
  });

  it('renders sidebar with navigation items', () => {
    render(<StitchAdminOrders />);
    expect(screen.getByText('Terminal v1.0')).toBeInTheDocument();
    expect(screen.getByText('Industrial Luxury')).toBeInTheDocument();
    expect(screen.getByText('New Order')).toBeInTheDocument();
  });

  it('renders pagination', () => {
    render(<StitchAdminOrders />);
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });
});
