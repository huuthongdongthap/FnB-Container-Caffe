import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'audit.title': 'Audit Log',
        'audit.subtitle': 'View system activity and changes',
        'audit.refresh': 'Refresh',
        'audit.exportCsv': 'Export CSV',
        'audit.filterTitle': 'Filters',
        'audit.dateFrom': 'Date From',
        'audit.dateTo': 'Date To',
        'audit.actionLabel': 'Action',
        'audit.resourceLabel': 'Resource',
        'audit.actorLabel': 'Actor',
        'audit.actorPlaceholder': 'Filter by actor ID',
        'audit.search': 'Search',
        'audit.reset': 'Reset',
        'audit.tableHeader.time': 'Time',
        'audit.tableHeader.actor': 'Actor',
        'audit.tableHeader.action': 'Action',
        'audit.tableHeader.resourceType': 'Resource Type',
        'audit.tableHeader.resourceId': 'Resource ID',
        'audit.tableHeader.ip': 'IP Address',
        'audit.empty.noLogs': 'No audit logs',
        'audit.empty.noLogsDescription': 'Audit logs will appear here',
        'audit.empty.resetFilters': 'Reset Filters',
        'audit.error.loadFailed': 'Failed to load audit logs',
        'audit.error.retry': 'Retry',
        'audit.pagination.info': 'Page {{page}} of {{totalPages}} ({{total}} total)',
        'audit.pagination.prev': 'Previous',
        'audit.pagination.next': 'Next',
        'audit.dateRangeWarning': 'Invalid date range',
        'audit.csv.time': 'Time',
        'audit.csv.actor': 'Actor',
        'audit.csv.action': 'Action',
        'audit.csv.resourceType': 'Resource Type',
        'audit.csv.resourceId': 'Resource ID',
        'audit.csv.ip': 'IP',
        'audit.actionFilter.all': 'All Actions',
        'audit.actionFilter.create': 'Create',
        'audit.actionFilter.update': 'Update',
        'audit.actionFilter.delete': 'Delete',
        'audit.actionFilter.login': 'Login',
        'audit.actionFilter.logout': 'Logout',
        'audit.actionFilter.export': 'Export',
        'audit.resourceFilter.all': 'All Resources',
        'audit.resourceFilter.order': 'Order',
        'audit.resourceFilter.customer': 'Customer',
        'audit.resourceFilter.menu': 'Menu',
        'audit.resourceFilter.promotion': 'Promotion',
        'audit.resourceFilter.campaign': 'Campaign',
        'audit.resourceFilter.staff': 'Staff',
        'audit.resourceFilter.payment': 'Payment',
        'audit.resourceFilter.reservation': 'Reservation',
      };
      return map[key ?? ''] ?? key ?? '';
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/tree/audit/use-audit-store', () => ({
  useAuditStore: vi.fn((selector?: any) => {
    const state = {
      entries: MOCK_ENTRIES,
      total: MOCK_ENTRIES.length,
      loading: false,
      error: null,
      filters: { actorId: '', action: '', resourceType: '', dateFrom: '', dateTo: '', page: 1, pageSize: 20 },
      fetchLogs: vi.fn(),
      setFilter: vi.fn(),
      resetFilters: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

const MOCK_ENTRIES = [
  {
    id: '1',
    actorId: 'admin-1',
    actorName: 'Admin User',
    action: 'CREATE',
    resourceType: 'order',
    resourceId: 'ORD-001',
    details: null,
    ipAddress: '192.168.1.1',
    createdAt: '2025-01-15T10:30:00Z',
  },
  {
    id: '2',
    actorId: 'staff-2',
    actorName: 'Staff User',
    action: 'UPDATE',
    resourceType: 'customer',
    resourceId: 'CUST-002',
    details: null,
    ipAddress: '192.168.1.2',
    createdAt: '2025-01-15T11:45:00Z',
  },
];

import AuditLogViewerPage from '@/pages/admin/AuditLogViewer';

describe('AuditLogViewerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title', () => {
    renderWithProviders(<AuditLogViewerPage />);
    expect(screen.getByText('Audit Log')).toBeTruthy();
  });

  it('renders filter panel with date inputs', () => {
    renderWithProviders(<AuditLogViewerPage />);
    expect(screen.getByText('Filters')).toBeTruthy();
    // Date inputs rendered as <input type="date">
    const allInputs = document.querySelectorAll('input');
    expect(allInputs.length).toBeGreaterThanOrEqual(2); // dateFrom + dateTo
  });

  it('renders audit log entries in table', () => {
    renderWithProviders(<AuditLogViewerPage />);
    expect(screen.getByText('Admin User')).toBeTruthy();
    expect(screen.getByText('Staff User')).toBeTruthy();
    expect(screen.getByText('CREATE')).toBeTruthy();
    expect(screen.getByText('UPDATE')).toBeTruthy();
  });

  it('renders search and reset buttons', () => {
    renderWithProviders(<AuditLogViewerPage />);
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Reset')).toBeTruthy();
  });

  it('renders export CSV button', () => {
    renderWithProviders(<AuditLogViewerPage />);
    expect(screen.getByText('Export CSV')).toBeTruthy();
  });
});
