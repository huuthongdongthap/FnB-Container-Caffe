import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/api-client', () => {
  const MOCK_SUBS = [
    { name: 'Alice', role: 'owner', endpoint: 'https://push.example.com/123', subscribed: true, createdAt: '2025-01-01' },
    { name: 'Bob', role: 'staff', endpoint: '', subscribed: false },
  ];
  return {
    apiFetch: vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/push/list-subscriptions') {
        return { success: true, subscriptions: MOCK_SUBS };
      }
      if (url === '/api/admin/notification-settings') {
        return { autoNotifyNewOrder: false, soundAlerts: false };
      }
      return { success: true };
    }),
    API_BASE: 'https://test.api.com',
  };
});

import NotificationSettingsPage from '@/pages/admin/NotificationSettings';
import { apiFetch } from '@/lib/api-client';

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page header with bell icon text', async () => {
    renderWithProviders(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Push Notifications')).toBeTruthy();
    });
  });

  it('shows staff subscriptions table', async () => {
    renderWithProviders(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('Bob')).toBeTruthy();
    });
  });

  it('shows active/inactive status per subscription', async () => {
    renderWithProviders(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeTruthy();
      expect(screen.getByText('Inactive')).toBeTruthy();
    });
  });

  it('renders notification preference toggles', async () => {
    renderWithProviders(<NotificationSettingsPage />);
    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders Add button for new subscriptions', async () => {
    renderWithProviders(<NotificationSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add')).toBeTruthy();
    });
  });
});
