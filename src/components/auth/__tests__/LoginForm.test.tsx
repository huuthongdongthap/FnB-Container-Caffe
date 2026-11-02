import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { LoginForm } from '@/components/auth/LoginForm';
import { AccountNotLoggedIn } from '@/pages/account/account-not-logged-in';
import * as apiClient from '@/lib/api-client';
import * as clientSession from '@/lib/client-session';

// All mock state in vi.hoisted so it's available within vi.mock's hoisted factory
const { mockLogin, mockStore, mockUseAuthStore } = vi.hoisted(() => {
  const login = vi.fn();
  const store = {
    login,
    loading: false,
    error: null as string | null,
    token: null as string | null,
    user: null,
    clearError: vi.fn(),
    fetchMe: vi.fn(),
    logout: vi.fn(),
    getState: vi.fn(() => store),
  };
  const hook: {
    (selector?: (s: typeof store) => unknown): unknown;
    getState: () => typeof store;
    setState: (partial: Partial<typeof store>) => void;
  } = Object.assign(
    vi.fn((selector?: (s: typeof store) => unknown) => {
      if (typeof selector === 'function') return selector(store);
      return store;
    }),
    {
      getState: vi.fn(() => store),
      setState: vi.fn(),
    },
  );
  return { mockLogin: login, mockStore: store, mockUseAuthStore: hook };
});

vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: mockUseAuthStore,
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.loading = false;
    mockStore.error = null;
    mockStore.token = null;
    mockUseAuthStore.getState = vi.fn(() => mockStore);
    mockLogin.mockResolvedValue(undefined);
  });

  it('renders email + password inputs and submit button', () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText(/email/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/••••/)).toBeDefined();
    expect(screen.getByRole('button', { name: /đăng nhập|login/i })).toBeDefined();
  });

  it('shows validation error for empty fields', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập|login/i }));

    await waitFor(() => {
      expect(screen.getByText(/Vui lòng nhập email/i)).toBeDefined();
    });
  });

  it('calls login() on valid submit', async () => {
    mockStore.token = 'jwt-after-login';
    mockUseAuthStore.getState = vi.fn(() => mockStore);
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••/), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập|login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
    });
  });

  it('disables button during loading', () => {
    mockStore.loading = true;
    render(<LoginForm />);
    const btn = screen.getByRole('button', { name: /đang đăng nhập/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays API error message', () => {
    mockStore.error = 'Invalid email or password';
    render(<LoginForm />);
    expect(screen.getByText(/Invalid email or password/i)).toBeDefined();
  });

  it('completes self-service customer Phone OTP and Email login in AccountNotLoggedIn', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'apiFetch')
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        token: 'cust-jwt-1',
        customer: { id: 'c-1', name: 'Lan', phone: '0901234567', email: 'lan@aura.vn' },
      });
    const saveSpy = vi.spyOn(clientSession, 'saveClientSession').mockImplementation(() => {});

    render(<AccountNotLoggedIn />);
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.click(screen.getByRole('button', { name: /Nhận mã OTP/i }));

    await waitFor(() => expect(screen.getByLabelText('Mã OTP')).toBeDefined());
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận OTP/i }));

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith('cust-jwt-1', expect.objectContaining({
        id: 'c-1', phone: '0901234567', role: 'customer',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /Email & Mật khẩu/i }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lan@aura.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Pass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Đăng nhập bằng Email/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('lan@aura.vn', 'Pass123!'));
    fetchSpy.mockRestore();
    saveSpy.mockRestore();
  });
});
