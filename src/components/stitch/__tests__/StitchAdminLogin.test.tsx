import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import StitchAdminLogin from '@/components/stitch/StitchAdminLogin';

describe('StitchAdminLogin', () => {
  it('renders login form in idle state', () => {
    render(<StitchAdminLogin />);
    expect(screen.getAllByText('AURA CAFE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Truy cập quản trị')).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('MÃ SỐ / EMAIL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
  });

  it('renders loading state when status is loading', () => {
    render(<StitchAdminLogin status="loading" />);
    expect(screen.getByText('Đang khởi tạo phiên đăng nhập...')).toBeInTheDocument();
    expect(screen.queryByText('Đăng nhập')).not.toBeInTheDocument();
  });

  it('renders error state when status is error', () => {
    render(<StitchAdminLogin status="error" errorMessage="Invalid credentials" />);
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByText('Thử lại')).toBeInTheDocument();
  });

  it('shows validation error on empty submit', async () => {
    render(<StitchAdminLogin />);
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(await screen.findByText(/Vui lòng nhập/)).toBeInTheDocument();
  });

  it('calls onLogin with email and password on valid submit', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<StitchAdminLogin onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText('MÃ SỐ / EMAIL'), { target: { value: 'admin@aura.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Đăng nhập'));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('admin@aura.com', 'password123');
    });
  });

  it('shows internal error when onLogin throws', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Auth failed'));
    render(<StitchAdminLogin onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText('MÃ SỐ / EMAIL'), { target: { value: 'admin@aura.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Đăng nhập'));

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', () => {
    render(<StitchAdminLogin />);
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find the eye toggle button (the one inside the password field)
    const allButtons = screen.getAllByRole('button');
    const eyeBtn = allButtons.find(b => b.querySelector('svg.lucide-eye') || b.querySelector('svg.lucide-eye-off'));
    expect(eyeBtn).toBeDefined();
    if (eyeBtn) {
      fireEvent.click(eyeBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
      fireEvent.click(eyeBtn);
      expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  it('renders secondary action buttons', () => {
    render(<StitchAdminLogin />);
    expect(screen.getByText('Vào với tư cách khách')).toBeInTheDocument();
    expect(screen.getByText('Liên hệ hỗ trợ')).toBeInTheDocument();
  });

  it('renders custom brand name', () => {
    render(<StitchAdminLogin brandName="TEST CAFE" />);
    expect(screen.getAllByText('TEST CAFE').length).toBeGreaterThanOrEqual(1);
  });
});
