import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

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
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
    saveError: null,
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

  it('renders page title', () => {
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByText('Cấu hình quà tặng sinh nhật')).toBeTruthy();
  });

  it('shows English subtitle', () => {
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByText('Birthday Reward Settings')).toBeTruthy();
  });

  it('shows skeleton while loading', () => {
    setupHook({ isLoading: true, config: null });
    renderWithProviders(<AdminBirthdayConfigPage />);
    // Skeleton renders animated placeholder divs
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows error banner with retry when load fails', () => {
    setupHook({ error: 'network error', config: null });
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByText(/Failed to load configuration/)).toBeTruthy();
    expect(screen.getByText(/Retry/)).toBeTruthy();
  });

  it('renders form fields when config is loaded', async () => {
    renderWithProviders(<AdminBirthdayConfigPage />);
    expect(screen.getByDisplayValue('10')).toBeTruthy(); // discountPercent
    expect(screen.getByDisplayValue('7')).toBeTruthy();  // earlyWindowDays
    expect(screen.getByDisplayValue('3')).toBeTruthy();  // lateWindowDays
  });
});
