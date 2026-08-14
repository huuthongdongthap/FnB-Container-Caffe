import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/use-birthday-admin', () => ({
  useBirthdayAdmin: vi.fn(),
}));

import { useBirthdayAdmin } from '@/hooks/use-birthday-admin';
import AdminBirthdayConfigPage from '@/pages/admin/BirthdayConfig';

function setupHook(overrides: Partial<ReturnType<typeof useBirthdayAdmin>> = {}) {
  const defaults = {
    config: {
      discountPercent: 10,
      freeItemEnabled: false,
      earlyWindowDays: 7,
      lateWindowDays: 3,
      autoSendEnabled: true,
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    sending: false,
    ...overrides,
  };
  vi.mocked(useBirthdayAdmin).mockReturnValue(defaults as any);
}

describe('AdminBirthdayConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHook();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title (i18n key)', () => {
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByText('adminBirthday.title')).toBeTruthy();
  });

  it('renders subtitle (i18n key)', () => {
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByText('adminBirthday.subtitle')).toBeTruthy();
  });

  it('shows skeleton while loading', () => {
    setupHook({ loading: true, config: null } as any);
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows error banner with retry when load fails', () => {
    setupHook({ error: 'network error', config: null } as any);
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByText('adminBirthday.saveError')).toBeTruthy();
    expect(screen.getByText('common.retry')).toBeTruthy();
  });

  it('renders form fields when config is loaded', () => {
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByDisplayValue('10')).toBeTruthy();
    expect(screen.getByDisplayValue('7')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });
});
