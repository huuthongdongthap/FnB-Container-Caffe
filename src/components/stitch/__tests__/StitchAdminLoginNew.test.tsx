import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchAdminLoginNew } from '../StitchAdminLoginNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'adminLogin.adminTerminalAccess': 'ADMIN TERMINAL ACCESS',
        'adminLogin.credentials': 'Enter your credentials to access the admin terminal.',
        'adminLogin.operatorEmail': 'OPERATOR EMAIL',
        'adminLogin.securityKey': 'SECURITY KEY',
        'adminLogin.signIn': 'SIGN IN',
        'adminLogin.loggingIn': 'SIGNING IN...',
        'adminLogin.emailAriaLabel': 'Email address input',
        'adminLogin.passwordAriaLabel': 'Password input',
        'adminLogin.showPasswordAriaLabel': 'Show password',
        'adminLogin.hidePasswordAriaLabel': 'Hide password',
        'adminLogin.signInAriaLabel': 'Sign in button',
        'adminLogin.forgotPassword': 'Forgot Password?',
        'adminLogin.forgotPasswordAriaLabel': 'Forgot password link',
        'adminLogin.pageAriaLabel': 'Admin login page',
        'adminLogin.supportAriaLabel': 'Contact support',
        'adminLogin.darkModeAriaLabel': 'Toggle dark mode',
        'adminLogin.loginFailed': 'Invalid credentials',
        'adminLogin.validationRequired': 'Email and password required',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
  it('renders the login form with email and password fields', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it('renders sign in button', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText('SIGN IN')).toBeTruthy();
  });

  it('calls onLogin with email and password when form is submitted', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<StitchAdminLoginNew onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@aura.cafe' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText('SIGN IN'));

    expect(onLogin).toHaveBeenCalledWith('admin@aura.cafe', 'secret123');
  });

  it('shows logging in state', () => {
    renderWithProviders(<StitchAdminLoginNew status="loading" />);
    expect(screen.getByText('SIGNING IN...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchAdminLoginNew status="error" />);
    expect(screen.getByText('Invalid credentials')).toBeTruthy();
  });

  it('renders brand name', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText(/AURA CAFE/i)).toBeTruthy();
  });

  it('renders forgot password link', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText('Forgot Password?')).toBeTruthy();
  });

  it('toggles password visibility', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput.getAttribute('type')).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /show password|hide password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.getAttribute('type')).toBe('text');
  });
});
