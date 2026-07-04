import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import StitchAdminPOS from '@/components/stitch/StitchAdminPOS';

describe('StitchAdminPOS', () => {
  it('renders loading state', () => {
    render(<StitchAdminPOS loading={true} />);
    expect(screen.getByText('Đang khởi tạo POS...')).toBeInTheDocument();
  });

  it('renders error state with reboot button', () => {
    render(<StitchAdminPOS error="Terminal offline" />);
    expect(screen.getByText('Terminal offline')).toBeInTheDocument();
    expect(screen.getByText('Khởi động lại')).toBeInTheDocument();
  });

  it('renders header with brand and session info', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('AURA CAFE')).toBeInTheDocument();
    expect(screen.getByText('Phiên POS: Đang hoạt động')).toBeInTheDocument();
  });

  it('renders search input and category chips', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByPlaceholderText('Tìm món, đơn hàng hoặc khách hàng...')).toBeInTheDocument();
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
    expect(screen.getByText('Món thêm phổ biến')).toBeInTheDocument();
    expect(screen.getByText('Oat Milk')).toBeInTheDocument();
    expect(screen.getByText('Double Shot')).toBeInTheDocument();
    expect(screen.getByText('Vanilla Bean')).toBeInTheDocument();
  });

  it('renders cart sidebar with order info', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('Tóm tắt đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Table 12')).toBeInTheDocument();
    expect(screen.getByText('Guest 2 • Order #842')).toBeInTheDocument();
  });

  it('shows empty cart message', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('Giỏ hàng trống. Vui lòng chọn món.')).toBeInTheDocument();
  });

  it('renders empty search result message', () => {
    render(<StitchAdminPOS />);
    const searchInput = screen.getByPlaceholderText('Tìm món, đơn hàng hoặc khách hàng...');
    fireEvent.change(searchInput, { target: { value: 'XYZZZ_NOT_FOUND' } });
    expect(screen.getByText('Không tìm thấy món phù hợp.')).toBeInTheDocument();
  });

  it('renders payment buttons', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText('PayOS')).toBeInTheDocument();
    expect(screen.getByText('COD')).toBeInTheDocument();
    expect(screen.getByText('Hoàn tất đơn hàng')).toBeInTheDocument();
  });

  it('renders footer bar', () => {
    render(<StitchAdminPOS />);
    expect(screen.getByText(/AURA Terminal v2.4/)).toBeInTheDocument();
    expect(screen.getByText('Mở ngăn kéo')).toBeInTheDocument();
    expect(screen.getByText('In hóa đơn')).toBeInTheDocument();
    expect(screen.getByText('End Shift')).toBeInTheDocument();
  });

  it('switches active category', () => {
    render(<StitchAdminPOS />);
    fireEvent.click(screen.getByText('Tea'));
    expect(screen.getByText('Matcha Zen')).toBeInTheDocument();
    expect(screen.getByText('Golden Matcha Latte')).toBeInTheDocument();
  });
});
