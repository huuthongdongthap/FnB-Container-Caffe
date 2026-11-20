import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test-utils';
import GenerateQRPage from '@/pages/admin/GenerateQR';

const stableT = (key?: string) => key ?? '';
const stableI18n = { language: 'vi', changeLanguage: vi.fn() };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: stableI18n,
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const READY_TABLE = {
  id: 'tbl_1',
  table_number: 'B01',
  zone: 'Tầng 1',
  status: 'available',
  slug: 'alpha-brew-b01',
  signed_url: 'https://auraspace.cafe/s/alpha-brew?table=B01',
  qr_png_url: '/api/admin/qr/alpha-brew-b01/png',
};

describe('GenerateQRPage print safety and tenant-neutral metadata', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/png')) {
          return { ok: false, status: 500 };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [READY_TABLE] }),
        };
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses tenant-neutral metadata copy without hardcoded flagship branding', async () => {
    renderWithProviders(<GenerateQRPage />);
    await waitFor(() => expect(screen.getByTestId('qr-card')).toBeTruthy());
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      expect(metaDesc.getAttribute('content') || '').not.toMatch(/AURA CAFE/i);
    }
    expect(document.body.innerHTML).not.toMatch(/AURA CAFE/i);
  });

  it('shows an explicit error card (never decorative SVG) and blocks window.print on PNG failure, then allows print after retry succeeds', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/real-qr-png');
    URL.revokeObjectURL = vi.fn();

    let failPng = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/png')) {
          if (failPng) return { ok: false, status: 500 };
          return {
            ok: true,
            status: 200,
            blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [READY_TABLE] }),
        };
      })
    );

    try {
      renderWithProviders(<GenerateQRPage />);

      const img = (await waitFor(() => screen.getByRole('img'))) as HTMLImageElement;

      // Simulate PNG load failure: must show explicit error state, never a decorative SVG QR
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.getByTestId('qr-card').getAttribute('data-qr-error')).toBe('true');
      });
      expect(document.querySelector('img[src^="data:image/svg+xml"]')).toBeNull();
      expect(screen.getByRole('status')).toBeTruthy();

      const printBtn = screen.getByRole('button', { name: /qrCodes\.printAll/i });
      fireEvent.click(printBtn);

      expect(printSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeTruthy();

      // Retry after PNG endpoint recovers -> real blob image loads -> print allowed
      failPng = false;
      const cardRetryBtn = screen.getByRole('status').querySelector('button') as HTMLButtonElement;
      fireEvent.click(cardRetryBtn);

      const recoveredImg = (await waitFor(() => screen.getByRole('img'))) as HTMLImageElement;
      expect(recoveredImg.getAttribute('src')).toBe('blob:http://localhost/real-qr-png');
      Object.defineProperty(recoveredImg, 'complete', { configurable: true, value: true });
      Object.defineProperty(recoveredImg, 'naturalWidth', { configurable: true, value: 400 });

      fireEvent.click(printBtn);
      expect(printSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
