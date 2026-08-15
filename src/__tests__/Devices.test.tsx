import { describe, it, expect, beforeEach, vi } from 'vitest';

// Vitest injects CJS `require`; declared locally to avoid @types/node dependency
declare const require: (id: string) => unknown;
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import { createTestAuthState } from '@/test-utils';
import AdminDevicesPage from '@/pages/admin/Devices';

/* ── Hoisted mocks (must be defined before vi.mock because of hoisting) ── */

const {
  MockSkeleton,
  MockCard,
  MockCardBody,
  MockInput,
  MockButton,
  MockModal,
} = vi.hoisted(() => {
  const R = require('react') as typeof import('react');
  return {
    MockSkeleton: () => R.createElement('div', { 'data-testid': 'skeleton' }),
    MockCard: (p: { children?: React.ReactNode }) => p.children ?? null,
    MockCardBody: (p: { children?: React.ReactNode }) => p.children ?? null,
    MockInput: () => null,
    MockButton: (p: { children?: React.ReactNode }) => p.children ?? null,
    MockModal: (p: { open?: boolean; children?: React.ReactNode }) => {
      if (!p.open) return null;
      return R.createElement('div', { 'data-testid': 'modal' }, p.children);
    },
  };
});

/* ── Module mocks ───────────────────────────────────────────────────── */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key?: string) => key ?? '', i18n: { language: 'vi' } }),
}));

vi.mock('lucide-react', () => ({
  Plus: () => null,
  Trash2: () => null,
  MonitorSmartphone: () => null,
  RefreshCw: () => null,
  Shield: () => null,
  KeyRound: () => null,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: MockSkeleton,
}));

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
  CardBody: MockCardBody,
  CardHeader: MockCardBody,
}));

vi.mock('@/components/ui/input', () => ({
  Input: MockInput,
}));

vi.mock('@/components/ui/button', () => ({
  Button: MockButton,
}));

vi.mock('@/components/ui/modal', () => ({
  Modal: MockModal,
}));

/* ── Helpers ────────────────────────────────────────────────────────── */

function mockFetch(devicesStatus: number, devicesBody: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/api/auth/staff')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ staff: [] }) } as Response);
    }
    return Promise.resolve({
      ok: devicesStatus >= 200 && devicesStatus < 300,
      status: devicesStatus,
      json: () => Promise.resolve(devicesBody),
    } as Response);
  });
}

const MOCK_DEVICES = {
  devices: [
    {
      id: 'dev-001',
      staff_id: 'staff-abc123456',
      device_name: 'Tablet Kitchen',
      role: 'kitchen',
      last_login_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'dev-002',
      staff_id: 'staff-xyz789012',
      device_name: null,
      role: 'waiter',
      last_login_at: null,
      created_at: '2025-02-20T14:30:00Z',
    },
  ],
};

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('AdminDevicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTestAuthState('test-token');
  });

  it('renders page heading', () => {
    mockFetch(200, MOCK_DEVICES);
    renderWithProviders(<AdminDevicesPage />);
    expect(screen.getByText('Quản lý thiết bị')).toBeTruthy();
  });

  it('renders devices after loading', async () => {
    mockFetch(200, MOCK_DEVICES);
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Tablet Kitchen')).toBeTruthy();
    });
  });

  it('shows empty state when no devices', async () => {
    mockFetch(200, { devices: [] });
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Chưa có thiết bị nào')).toBeTruthy();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockFetch(500, { error: 'Server error' });
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  it('shows session expired on 401', async () => {
    mockFetch(401, {});
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText(/Phiên đăng nhập hết hạn/)).toBeTruthy();
    });
  });

  it('shows stats after loading', async () => {
    mockFetch(200, MOCK_DEVICES);
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Tổng thiết bị')).toBeTruthy();
    });
  });

  it('shows role label for kitchen device', async () => {
    mockFetch(200, MOCK_DEVICES);
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Bếp / Kitchen')).toBeTruthy();
    });
  });

  it('shows relative time for last login', async () => {
    mockFetch(200, MOCK_DEVICES);
    renderWithProviders(<AdminDevicesPage />);
    await waitFor(() => {
      expect(screen.getByText(/trước/)).toBeTruthy();
    });
  });
});
