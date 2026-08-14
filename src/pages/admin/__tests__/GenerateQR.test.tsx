import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import GenerateQRPage, { QrCard } from '@/pages/admin/GenerateQR';

const MOCK_FALLBACK: Record<string, string> = {
  'qrCodes.pageTitle': 'QR Codes',
  'qrCodes.printAll': 'Print',
  'qrCodes.regenerateAll': 'Regenerate All',
  'qrCodes.regenerating': 'Regenerating...',
  'qrCodes.tablesCount': '{{count}} tables',
  'qrCodes.table': 'table',
  'qrCodes.tables': 'tables',
  'qrCodes.zoneFilter': 'Zone:',
  'qrCodes.allZones': 'All zones',
  'qrCodes.noTablesZone': 'No tables found for selected zone.',
  'qrCodes.loading': 'Loading...',
  'qrCodes.noQR': 'No QR',
  'qrCodes.download': 'Download',
  'qrCodes.retry': 'Retry',
  'qrCodes.error.loadFailed': 'Failed to load tables',
  'qrCodes.error.regenerateFailed': 'Failed to regenerate QR codes',
  'qrCodes.status.available': 'Available',
  'qrCodes.status.occupied': 'Occupied',
  'qrCodes.status.reserved': 'Reserved',
  'qrCodes.printHeaderTitle': 'QR codes for staff — scan to open ordering page',
  'qrCodes.printHeaderHint': 'Place each card at the corresponding table in the zone above.',
  'qrCodes.printHeaderUrlHint': 'Signed URL for staff backup reference — do not share with customers.',
  'qrCodes.pageSubtitle': 'Generate and print QR codes for tables',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      if (!key) return '';
      let text = MOCK_FALLBACK[key] ?? key;
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

const FIXTURE = [
  {
    id: '1',
    table_number: 1,
    zone: 'indoor',
    status: 'available',
    slug: 't01-indoor',
    signed_url: 'https://example.com/api/qr/t01-indoor?ts=1&sig=abc',
    qr_png_url: '/api/admin/qr/t01-indoor/png',
  },
  {
    id: '2',
    table_number: 2,
    zone: 'indoor',
    status: 'occupied',
    slug: 't02-indoor',
    signed_url: null,
    qr_png_url: '/api/admin/qr/t02-indoor/png',
  },
  {
    id: '3',
    table_number: 10,
    zone: 'outdoor',
    status: 'reserved',
    slug: '10-outdoor',
    signed_url: null,
    qr_png_url: '/api/admin/qr/10-outdoor/png',
  },
];

describe('GenerateQRPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
        const u = new URL(url, 'http://localhost');
        const zoneFilter = u.searchParams.get('zone');
        const statusFilter = u.searchParams.get('status');
        const data = FIXTURE.filter((t) => {
          if (zoneFilter && t.zone !== zoneFilter) return false;
          if (statusFilter && t.status !== statusFilter) return false;
          return true;
        });
        return {
          ok: true as const,
          status: 200,
          json: () => Promise.resolve({ success: true, data }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPage = () => renderWithProviders(<GenerateQRPage />);

  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'QR Codes',
    );
  });

  it('renders zone filter with all zones', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText('Zone:')).toBeTruthy(),
    );
    const select = screen.getByLabelText('Zone:') as HTMLSelectElement;
    expect(select.value).toBe('all');
    expect(screen.getByRole('option', { name: 'All zones' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'indoor' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'outdoor' })).toBeTruthy();
  });

  it('filters tables by zone when selection changes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/^3\s/)).toBeTruthy());
    const select = screen.getByLabelText('Zone:') as HTMLSelectElement;
    select.value = 'indoor';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(screen.getByText(/^2\s/)).toBeTruthy());
  });

  it('renders QR cards', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(3),
    );
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(3);
  });

  it('shows print button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy(),
    );
    expect(
      screen.getByRole('button', { name: 'Print' }),
    ).not.toBeDisabled();
  });
});

describe('QrCard', () => {
  it('renders table number and QR image', () => {
    renderWithProviders(
      <QrCard
        tableNumber="5"
        zoneName="indoor"
        qrPngUrl="/api/admin/qr/t05-indoor/png"
        signedUrl="https://example.com/api/qr/t05-indoor?ts=1&sig=xyz"
        slug="t05-indoor"
        status="available"
        onDownload={() => {}}
      />,
    );
    expect(screen.getByText('5')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: /QR table 5 zone indoor/i }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });

  it('shows status badge', () => {
    renderWithProviders(
      <QrCard
        tableNumber="7"
        zoneName="outdoor"
        qrPngUrl="/api/admin/qr/t07-outdoor/png"
        signedUrl={null}
        slug="t07-outdoor"
        status="occupied"
        onDownload={() => {}}
      />,
    );
    expect(screen.getByText('Occupied')).toBeTruthy();
  });
});
