import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { RegisterForm } from '@/components/auth/RegisterForm';

// All mock state in vi.hoisted so it's available within vi.mock's hoisted factory
const { mockRegister, mockStore, mockUseAuthStore } = vi.hoisted(() => {
  const register = vi.fn();
  const store = {
    register,
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
  return { mockRegister: register, mockStore: store, mockUseAuthStore: hook };
});

vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: mockUseAuthStore,
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.loading = false;
    mockStore.error = null;
    mockStore.token = null;
    mockUseAuthStore.getState = vi.fn(() => mockStore);
    mockRegister.mockResolvedValue(undefined);
  });

  it('renders name + email + phone + password inputs', () => {
    render(<RegisterForm />);
    expect(screen.getByPlaceholderText(/Nguyễn Văn A/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/email@example.com/i)).toBeDefined();
    expect(screen.getByPlaceholderText('0901234567')).toBeDefined();
    const passFields = screen.getAllByPlaceholderText('••••••••');
    expect(passFields.length).toBe(2);
  });

  it('shows validation error for empty required fields', async () => {
    render(<RegisterForm />);
    fireEvent.click(screen.getByRole('button', { name: /đăng ký|register/i }));

    await waitFor(() => {
      expect(screen.getByText(/Vui lòng nhập họ tên/i)).toBeDefined();
    });
  });

  it('calls register() on valid submit', async () => {
    mockStore.token = 'jwt-after-reg';
    mockUseAuthStore.getState = vi.fn(() => mockStore);
    render(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText(/Nguyễn Văn A/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/email@example.com/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('0901234567'), { target: { value: '0901234567' } });
    const passFields = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passFields[0]!, { target: { value: 'password123' } });
    fireEvent.change(passFields[1]!, { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /đăng ký|register/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('disables button during loading', () => {
    mockStore.loading = true;
    render(<RegisterForm />);
    const btn = screen.getByRole('button', { name: /đang đăng ký/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays API error on 409 duplicate', () => {
    mockStore.error = 'Email already exists';
    render(<RegisterForm />);
    expect(screen.getByText(/Email already exists/i)).toBeDefined();
  });
});
