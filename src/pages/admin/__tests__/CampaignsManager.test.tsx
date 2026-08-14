import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'campaigns.title': 'Marketing Campaigns',
        'campaigns.subtitle': 'Manage automated marketing campaigns',
        'campaigns.colCampaign': 'Campaign',
        'campaigns.colChannels': 'Channels',
        'campaigns.colStatus': 'Status',
        'campaigns.colSent': 'Sent',
        'campaigns.colSuccessRate': 'Success Rate',
        'campaigns.colLastRun': 'Last Run',
        'campaigns.colActions': 'Actions',
        'campaigns.active': 'Active',
        'campaigns.inactive': 'Inactive',
        'campaigns.configure': 'Configure',
        'campaigns.turnOff': 'Turn Off',
        'campaigns.turnOn': 'Turn On',
        'campaigns.delete': 'Delete',
        'campaigns.triggerWelcome': 'Welcome Campaign',
        'campaigns.triggerWelcomeEn': 'Welcome Campaign',
        'campaigns.triggerBirthday': 'Birthday Campaign',
        'campaigns.triggerBirthdayEn': 'Birthday Campaign',
        'campaigns.triggerWinback': 'Win-back Campaign',
        'campaigns.triggerWinbackEn': 'Win-back Campaign',
        'campaigns.triggerPostVisit': 'Post-visit Follow-up',
        'campaigns.triggerPostVisitEn': 'Post-visit Follow-up',
        'campaigns.triggerCashbackExpiry': 'Cashback Expiry',
        'campaigns.triggerCashbackExpiryEn': 'Cashback Expiry',
        'campaigns.loadError': 'Error: {{message}}',
        'campaigns.dataError': 'Error loading data',
        'campaigns.retry': 'Retry',
        'campaigns.emptyTitle': 'No campaigns configured',
        'campaigns.emptyDesc': 'Campaigns will appear here once created',
        'campaigns.customersLabel': '({{count}} customers)',
        'campaigns.modalTitle': 'Configure {{name}}',
        'campaigns.channelSelection': 'Select Channels',
        'campaigns.isActive': 'Active',
        'campaigns.saving': 'Saving...',
        'campaigns.cancel': 'Cancel',
        'campaigns.saveChanges': 'Save Changes',
        'campaigns.channelRequired': 'At least one channel required',
        'campaigns.deleteConfirmTitle': 'Delete Campaign',
        'campaigns.deleteConfirmMsg': 'Delete {{name}}?',
        'campaigns.deleting': 'Deleting...',
        'campaigns.confirmDelete': 'Delete',
        'campaigns.timing': 'Timing: {{timing}}',
        'campaigns.noTiming': 'No timing set',
      };
      return map[key ?? ''] ?? key ?? '';
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/use-campaigns-admin', () => ({
  useCampaignsAdmin: vi.fn(),
}));

import { useCampaignsAdmin } from '@/hooks/use-campaigns-admin';
import CampaignsManagerPage from '@/pages/admin/CampaignsManager';

const MOCK_CAMPAIGNS = [
  {
    trigger: 'welcome' as const,
    is_active: 1,
    channels: ['sms', 'email'] as const,
    meta: { description: 'Welcome new customers', timing_hint: 'On signup' },
  },
  {
    trigger: 'birthday' as const,
    is_active: 0,
    channels: ['zalo'] as const,
    meta: { description: 'Birthday rewards', timing_hint: '7 days before' },
  },
];

function setupHook(overrides: Partial<ReturnType<typeof useCampaignsAdmin>> = {}) {
  const defaults = {
    campaigns: MOCK_CAMPAIGNS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    stats: {},
    statsLoading: false,
    updateCampaign: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
    isDeleting: false,
    ...overrides,
  };
  vi.mocked(useCampaignsAdmin).mockReturnValue(defaults as any);
}

describe('CampaignsManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHook();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title', () => {
    renderWithProviders(<CampaignsManagerPage />);
    expect(screen.getByText('Marketing Campaigns')).toBeTruthy();
  });

  it('renders campaign rows in table', () => {
    renderWithProviders(<CampaignsManagerPage />);
    // Both trigger and en label keys render the same text → multiple elements
    expect(screen.getAllByText('Welcome Campaign').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Birthday Campaign').length).toBeGreaterThanOrEqual(1);
  });

  it('shows active/inactive badges', () => {
    renderWithProviders(<CampaignsManagerPage />);
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
  });

  it('renders channel badges for each campaign', () => {
    renderWithProviders(<CampaignsManagerPage />);
    expect(screen.getByText('SMS')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Zalo')).toBeTruthy();
  });

  it('shows error state when load fails', () => {
    setupHook({ error: new Error('Network error'), campaigns: [] });
    renderWithProviders(<CampaignsManagerPage />);
    expect(screen.getByText('Error loading data')).toBeTruthy();
  });
});
