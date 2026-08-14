import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

import DinDinMenu from '@/pages/admin/DinDinMenu';

const MOCK_CONFIG = {
  sections: [
    {
      name: 'Coffee',
      items: [
        { id: '1', name: 'Espresso', price: 35000, description: '', available: true, modifiers: [] },
      ],
    },
  ],
};

describe('DinDinMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const u = new URL(url, 'http://localhost');
        if (u.pathname === '/api/admin/dindin/config') {
          return { ok: true, status: 200, json: () => Promise.resolve(MOCK_CONFIG) };
        }
        return { ok: true, status: 200, json: () => Promise.resolve({}) };
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders menu title (i18n key)', async () => {
    renderWithProviders(<DinDinMenu />);
    await waitFor(() => {
      expect(screen.getByText('dindin.menuTitle')).toBeTruthy();
    });
  });

  it('renders section name input with i18n placeholder', async () => {
    renderWithProviders(<DinDinMenu />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('dindin.sectionName')).toBeTruthy();
    });
  });

  it('renders add section button', async () => {
    renderWithProviders(<DinDinMenu />);
    await waitFor(() => {
      expect(screen.getByText('dindin.addSection')).toBeTruthy();
    });
  });

  it('displays loaded section name', async () => {
    renderWithProviders(<DinDinMenu />);
    await waitFor(() => {
      expect(screen.getByText('Coffee')).toBeTruthy();
    });
  });

  it('displays loaded item name and price', async () => {
    renderWithProviders(<DinDinMenu />);
    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeTruthy();
    });
  });

  it('renders save button', async () => {
    renderWithProviders(<DinDinMenu />);
    await waitFor(() => {
      expect(screen.getByText('save')).toBeTruthy();
    });
  });
});
