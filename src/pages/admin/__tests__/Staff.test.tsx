import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/stores/admin/use-admin-staff-store', () => ({
  useAdminStaffStore: vi.fn(),
}));

vi.mock('@/hooks/stores/admin/use-admin-shifts-store', () => ({
  useAdminShiftsStore: vi.fn(),
}));

import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAdminShiftsStore } from '@/hooks/stores/admin/use-admin-shifts-store';
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
    fetchShifts: vi.fn(),
  } as any);
}

describe('StaffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStores();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders staff list tab by default', () => {
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('Quản lý nhân viên')).toBeTruthy();
  });

  it('renders staff members', () => {
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('switches to shifts tab on click', async () => {
    renderWithProviders(<StaffPage />);
    const timekeepingTab = screen.getByText('Chấm công');
    fireEvent.click(timekeepingTab);
    // Tab switches - verify the active tab styling changed
    expect(timekeepingTab.className).toContain('bg-white');
  });

  it('shows add staff button', () => {
    renderWithProviders(<StaffPage />);
    expect(screen.getByText(/Thêm nhân viên/)).toBeTruthy();
  });

  it('shows error state with retry', () => {
    setupStores({ staffError: 'Connection failed', staff: [] });
    renderWithProviders(<StaffPage />);
    expect(screen.getByText('Connection failed')).toBeTruthy();
    expect(screen.getByText(/Thử lại/)).toBeTruthy();
  });
});
