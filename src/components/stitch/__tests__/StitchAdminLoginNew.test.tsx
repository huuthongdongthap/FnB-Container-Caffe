import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchAdminLoginNew } from '../StitchAdminLoginNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
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

// The t() mock returns the key itself when no fallback is provided,
// so aria-labels resolve to i18n keys like 'adminLogin.emailAriaLabel'.
const EMAIL_LABEL = 'adminLogin.emailAriaLabel';
const PASSWORD_LABEL = 'adminLogin.passwordAriaLabel';

describe('StitchAdminLoginNew', () => {
  it('renders the login form with email and password fields', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeTruthy();
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeTruthy();
  });

  it('renders submit button with i18n key', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByText('adminLogin.initializeSession')).toBeTruthy();
  });

  it('calls onLogin with email and password when form is submitted', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<StitchAdminLoginNew onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'admin@aura.com' },
    });
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('adminLogin.initializeSession'));

    expect(onLogin).toHaveBeenCalledWith('admin@aura.com', 'password123');
  });

  it('shows loading state via status prop', () => {
    renderWithProviders(<StitchAdminLoginNew status="loading" />);
    expect(screen.getByText('adminLogin.authorizing')).toBeTruthy();
  });

  it('shows error state via errorMessage prop', () => {
    renderWithProviders(<StitchAdminLoginNew status="error" errorMessage="Invalid credentials" />);
    expect(screen.getByText('Invalid credentials')).toBeTruthy();
  });

  it('renders brand name', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    // Brand appears in header + footer
    expect(screen.getAllByText('AURA CAFE').length).toBeGreaterThanOrEqual(2);
  });

  it('toggles password visibility', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    const passwordInput = screen.getByLabelText(PASSWORD_LABEL);
    expect(passwordInput.getAttribute('type')).toBe('password');

    // Show password aria-label is also a key (no fallback)
    const toggleBtn = screen.getByRole('button', { name: 'adminLogin.showPasswordAriaLabel' });
    fireEvent.click(toggleBtn);
    expect(passwordInput.getAttribute('type')).toBe('text');
  });
});
