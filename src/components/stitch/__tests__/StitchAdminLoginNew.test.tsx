import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchAdminLoginNew } from '../StitchAdminLoginNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.adminLogin': 'Admin Login',
        'stitch.email': 'Email',
        'stitch.password': 'Password',
        'stitch.login': 'Login',
        'stitch.loggingIn': 'Logging in...',
        'stitch.forgotPassword': 'Forgot Password?',
        'stitch.backToSite': 'Back to Site',
        'stitch.loginSuccess': 'Login successful',
        'stitch.loginError': 'Login failed',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Headphones: () => null,
  Moon: () => null,
  Loader2: () => null,
  ShieldAlert: () => null,
}));

describe('StitchAdminLoginNew', () => {
  it('renders the login form', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText('Admin Login')).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it('renders login button', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText('Login')).toBeTruthy();
  });

  it('calls onLogin with email and password when form is submitted', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<StitchAdminLoginNew onLogin={onLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'admin@aura.cafe' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText('Login'));

    expect(onLogin).toHaveBeenCalledWith('admin@aura.cafe', 'secret123');
  });

  it('shows logging in state', () => {
    renderWithProviders(<StitchAdminLoginNew status="loading" />);
    expect(screen.getByText('Logging in...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchAdminLoginNew status="error" />);
    expect(screen.getByText('Login failed')).toBeTruthy();
  });

  it('toggles password visibility', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput.getAttribute('type')).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /show password|hide password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.getAttribute('type')).toBe('text');
  });

  it('renders brand name', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText(/AURA CAFE/i)).toBeTruthy();
  });

  it('renders forgot password link', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText('Forgot Password?')).toBeTruthy();
  });
});
