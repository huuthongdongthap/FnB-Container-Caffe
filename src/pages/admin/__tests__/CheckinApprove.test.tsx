import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        title: 'Check-in Approval',
        pendingCount: '{{count}} pending',
        retry: 'Retry',
        pendingTitle: 'Pending Requests',
        loading: 'Loading...',
        noPendingRequests: 'No pending requests',
        detailTitle: 'Details',
        selectPrompt: 'Select a check-in request to review',
        noPhoto: 'No photo submitted',
        reject: 'Reject',
        approve: 'Approve',
        historyTitle: 'History',
        approvedLabel: 'Approved',
        rejectedLabel: 'Rejected',
        justNow: 'Just now',
        minutesAgo: '{{minutes}}m ago',
        hoursAgo: '{{hours}}h ago',
      };
      let text = map[key ?? ''] ?? key ?? '';
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/admin/checkin-row', () => ({
  CheckinRow: ({ checkin, isSelected, onClick }: any) => (
    <div
      data-testid={`checkin-row-${checkin.id}`}
      className={isSelected ? 'selected' : ''}
      onClick={onClick}
      role="button"
    >
      <span>{checkin.memberName}</span>
      <span>{checkin.memberPhone}</span>
    </div>
  ),
}));

import AdminCheckinApprovePage from '@/pages/admin/CheckinApprove';

describe('AdminCheckinApprovePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title', () => {
    renderWithProviders(<AdminCheckinApprovePage />);
    expect(screen.getByText('Check-in Approval')).toBeTruthy();
  });

  it('shows pending count after loading', async () => {
    renderWithProviders(<AdminCheckinApprovePage />);
    await waitFor(() => {
      expect(screen.getByText('3 pending')).toBeTruthy();
    });
  });

  it('renders check-in rows after loading', async () => {
    renderWithProviders(<AdminCheckinApprovePage />);
    await waitFor(() => {
      expect(screen.getByTestId('checkin-row-C001')).toBeTruthy();
      expect(screen.getByTestId('checkin-row-C002')).toBeTruthy();
      expect(screen.getByTestId('checkin-row-C003')).toBeTruthy();
    });
  });

  it('shows select prompt when no checkin is selected', async () => {
    renderWithProviders(<AdminCheckinApprovePage />);
    await waitFor(() => {
      expect(screen.getByText('Select a check-in request to review')).toBeTruthy();
    });
  });

  it('shows detail panel when a checkin row is clicked', async () => {
    renderWithProviders(<AdminCheckinApprovePage />);
    await waitFor(() => {
      expect(screen.getByTestId('checkin-row-C001')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('checkin-row-C001'));
    await waitFor(() => {
      // Name appears in both the row and detail panel
      expect(screen.getAllByText('Nguyen Van A').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Approve')).toBeTruthy();
      expect(screen.getByText('Reject')).toBeTruthy();
    });
  });
});
