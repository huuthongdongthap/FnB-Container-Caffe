import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import StitchAdminPOS from '@/components/stitch/StitchAdminPOS';

describe('StitchAdminPOS', () => {
  it('renders loading state', () => {
    render(<StitchAdminPOS loading={true} />);
    expect(screen.getByText('Initializing POS Terminal...')).toBeInTheDocument();
  });

  it('renders error state with reboot button', () => {
    render(<StitchAdminPOS error="Terminal offline" />);
    expect(screen.getByText('Terminal offline')).toBeInTheDocument();
    expect(screen.getByText('Reboot Terminal')).toBeInTheDocument();
  });

  it('renders header with brand and session info', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('AURA CAFE')).toBeInTheDocument();
    expect(screen.getByText('Terminal Session: Active')).toBeInTheDocument();
  });

  it('renders search input and category chips', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByPlaceholderText('Search menu items, orders, or customers...')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getByText('Pastries')).toBeInTheDocument();
  });

  it('renders menu items in grid (Coffee category by default)', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('Midnight Espresso')).toBeInTheDocument();
    expect(screen.getByText('Chrome Velvet')).toBeInTheDocument();
    expect(screen.getByText('Industrial Cold')).toBeInTheDocument();
    expect(screen.getAllByText('$6.50').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$8.25')).toBeInTheDocument();
  });

  it('renders popular add-ons section', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('Popular Add-ons')).toBeInTheDocument();
    expect(screen.getByText('Oat Milk')).toBeInTheDocument();
    expect(screen.getByText('Double Shot')).toBeInTheDocument();
    expect(screen.getByText('Vanilla Bean')).toBeInTheDocument();
  });

  it('renders cart sidebar with order info', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('Order Summary')).toBeInTheDocument();
    expect(screen.getByText('Table 12')).toBeInTheDocument();
    expect(screen.getByText('Guest 2 • Order #842')).toBeInTheDocument();
  });

  it('shows empty cart message', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('Cart is empty. Select menu items to begin.')).toBeInTheDocument();
  });

  it('renders empty search result message', () => {
    render(<StitchAdminPOS />);
    const searchInput = screen.getByPlaceholderText('Search menu items, orders, or customers...');
    fireEvent.change(searchInput, { target: { value: 'XYZZZ_NOT_FOUND' } });
    expect(screen.getByText('No menu items match your search.')).toBeInTheDocument();
  });

  it('renders payment buttons', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('PayOS')).toBeInTheDocument();
    expect(screen.getByText('COD')).toBeInTheDocument();
    expect(screen.getByText('Complete Order')).toBeInTheDocument();
  });

  it('renders footer bar', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText(/AURA Terminal v2.4/)).toBeInTheDocument();
    expect(screen.getByText('Open Drawer')).toBeInTheDocument();
    expect(screen.getByText('Print Receipt')).toBeInTheDocument();
    expect(screen.getByText('End Shift')).toBeInTheDocument();
  });

  it('switches active category', () => {
    render(<StitchAdminPOS />);
    fireEvent.click(screen.getByText('Tea'));
    expect(screen.getByText('Matcha Zen')).toBeInTheDocument();
    expect(screen.getByText('Golden Matcha Latte')).toBeInTheDocument();
  });
});
