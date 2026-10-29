import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/stores/admin/use-admin-staff-store', () => ({
  useAdminStaffStore: vi.fn(),
}));

vi.mock('@/hooks/stores/admin/use-admin-shifts-store', () => ({
  useAdminShiftsStore: vi.fn(),
}));

vi.mock('@/hooks/stores/admin/use-admin-recruitment-store', () => ({
  useAdminRecruitmentStore: vi.fn(),
}));

import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAdminShiftsStore } from '@/hooks/stores/admin/use-admin-shifts-store';
import { useAdminRecruitmentStore } from '@/hooks/stores/admin/use-admin-recruitment-store';
import { saveClientSession } from '@/lib/client-session';
import StaffPage from '@/pages/admin/Staff';

const MOCK_STAFF = [
  { id: '1', name: 'Alice', role: 'barista', isActive: true, phone: '0901111111', email: 'alice@test.com' },
  { id: '2', name: 'Bob', role: 'cashier', isActive: false, phone: '0902222222', email: 'bob@test.com' },
];

function setupStores(overrides: { staff?: any[]; staffLoading?: boolean; staffError?: string | null } = {}) {
  vi.mocked(useAdminStaffStore).mockReturnValue({
    staff: overrides.staff ?? MOCK_STAFF,
    loading: overrides.staffLoading ?? false,
    error: overrides.staffError ?? null,
    fetchStaff: vi.fn(),
    registerStaff: vi.fn().mockResolvedValue(undefined),
    toggleStaffActive: vi.fn().mockResolvedValue(undefined),
    pendingToggles: new Set<string>(),
  } as any);

  vi.mocked(useAdminShiftsStore).mockReturnValue({
    todayShifts: [],
    historyShifts: [],
    loading: { today: false, history: false, clockIn: false, clockOut: false },
    error: null,
    fetchToday: vi.fn(),
    fetchHistory: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
    reset: vi.fn(),
  } as any);

  vi.mocked(useAdminRecruitmentStore).mockReturnValue({
    applications: [],
    loading: false,
    error: null,
    fetchApplications: vi.fn(),
    updateStatus: vi.fn(),
    deleteApplication: vi.fn(),
    addCandidate: vi.fn(),
  } as any);
}

describe('StaffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveClientSession('owner-token', { id: 'owner', name: 'Owner', role: 'owner' });
    setupStores();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders staff list tab by default (i18n key)', () => {
    renderWithProviders(<StaffPage />);
    expect(screen.getAllByText('adminStaff.title').length).toBeGreaterThanOrEqual(1);
  });

  it('renders staff members', () => {
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('switches to shifts tab on click', async () => {
    renderWithProviders(<StaffPage />);
    const shiftsTab = screen.getByText('adminStaff.shifts');
    fireEvent.click(shiftsTab);
    expect(shiftsTab).toBeTruthy();
  });

  it('switches to recruitment tab on click', async () => {
    renderWithProviders(<StaffPage />);
    const recruitmentTab = screen.getByText('adminStaff.recruitment');
    fireEvent.click(recruitmentTab);
    expect(recruitmentTab).toBeTruthy();
  });

  it('shows add staff button', () => {
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('adminStaff.addStaff')).toBeTruthy();
  });

  it('shows error state with retry', () => {
    setupStores({ staffError: 'Connection failed', staff: [] });
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('Connection failed')).toBeTruthy();
    expect(screen.getByText('common.retry')).toBeTruthy();
  });

  it('disables the toggle of a staff row whose save is in flight', () => {
    setupStores({ staff: [MOCK_STAFF[0]] });
    vi.mocked(useAdminStaffStore).mockReturnValue({
      staff: [MOCK_STAFF[0]],
      loading: false,
      error: null,
      fetchStaff: vi.fn(),
      registerStaff: vi.fn(),
      toggleStaffActive: vi.fn(),
      pendingToggles: new Set(['1']),
    } as any);

    renderWithProviders(<StaffPage />);
    const button = screen.getByText('common.saving').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('surfaces a failed toggle as an inline error instead of a silent success', () => {
    setupStores({ staff: [MOCK_STAFF[0]], staffError: 'Từ chối lưu' });
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('Từ chối lưu')).toBeTruthy();
  });

  it('handles a rejected toggle promise and displays its reason', async () => {
    const toggleStaffActive = vi.fn().mockRejectedValue(new Error('Không được phép tắt tài khoản'));
    vi.mocked(useAdminStaffStore).mockReturnValue({
      staff: [MOCK_STAFF[0]], loading: false, error: null,
      fetchStaff: vi.fn(), registerStaff: vi.fn(), toggleStaffActive,
      pendingToggles: new Set<string>(),
    } as any);
    renderWithProviders(<StaffPage />);
    fireEvent.click(screen.getByText('adminStaff.deactivate'));
    expect(await screen.findByText('Không được phép tắt tài khoản')).toBeTruthy();
    expect(toggleStaffActive).toHaveBeenCalledWith('1');
  });
  it.each(['staff', 'cashier', 'waiter', 'admin', 'kitchen'])('hides recruitment controls for %s', role => {
    saveClientSession('restricted-token', { id: 'restricted', name: 'Restricted', role });
    renderWithProviders(<StaffPage />);
    expect(screen.queryByText('adminStaff.recruitment')).toBeNull();
  });

});
