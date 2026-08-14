import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { StitchAdminLoginNew } from '../StitchAdminLoginNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

describe('StitchAdminLoginNew', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders login form fields', () => {
    renderWithProviders(<StitchAdminLoginNew />);
    expect(screen.getByLabelText(/adminLogin\.emailAriaLabel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adminLogin\.passwordAriaLabel/i)).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchAdminLoginNew />);
    const toggleBtn = screen.getByRole('button', { name: /adminLogin\.showPasswordAriaLabel/i });
    await user.click(toggleBtn);
    expect(screen.getByRole('button', { name: /adminLogin\.hidePasswordAriaLabel/i })).toBeInTheDocument();
  });

  it('updates email field on input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StitchAdminLoginNew />);
    const emailInput = screen.getByLabelText(/adminLogin\.emailAriaLabel/i);
    await user.type(emailInput, 'admin@test.com');
    expect(emailInput).toHaveValue('admin@test.com');
  });

  it('calls onLogin with credentials on submit', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<StitchAdminLoginNew onLogin={onLogin} />);
    await user.type(screen.getByLabelText(/adminLogin\.emailAriaLabel/i), 'admin@test.com');
    await user.type(screen.getByLabelText(/adminLogin\.passwordAriaLabel/i), 'pass123');
    await user.click(screen.getByRole('button', { name: /adminLogin\.submitAriaLabel/i }));
    expect(onLogin).toHaveBeenCalledWith('admin@test.com', 'pass123');
  });
});
