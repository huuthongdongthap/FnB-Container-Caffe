import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerShell from '../CustomerShell';
import OpsShell from '../OpsShell';
import AdminShell from '../AdminShell';
import { getShellConfig, hasM3NavBar, MD3_SHELL_CONFIG } from '../shell-config';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'nav.home': 'Trang chủ',
        'nav.menu': 'Thực đơn',
        'nav.reservations': 'Đặt bàn',
        'nav.promotions': 'Ưu đãi',
        'nav.account': 'Tài khoản',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) {
        return optsOrFallback.defaultValue ?? key ?? '';
      }
      return key ?? '';
    },
    i18n: { language: 'vi', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Experience Shells Architecture', () => {
  describe('CustomerShell', () => {
    it('renders top app bar, navigation bar, and children on /menu', () => {
      render(
        <MemoryRouter initialEntries={['/menu']}>
          <CustomerShell>
            <div>Menu page content</div>
          </CustomerShell>
        </MemoryRouter>,
      );

      expect(screen.getByText('Menu page content')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getAllByText('Thực đơn')).toHaveLength(2); // Top app bar + bottom nav
      expect(screen.getByText('Trang chủ')).toBeInTheDocument();
      expect(screen.getByText('Đặt bàn')).toBeInTheDocument();
      expect(screen.getByText('Ưu đãi')).toBeInTheDocument();
      expect(screen.getByText('Tài khoản')).toBeInTheDocument();
    });

    it('hides bottom navigation bar on /checkout', () => {
      render(
        <MemoryRouter initialEntries={['/checkout']}>
          <CustomerShell>
            <div>Checkout page content</div>
          </CustomerShell>
        </MemoryRouter>,
      );

      expect(screen.getByText('Checkout page content')).toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  describe('OpsShell', () => {
    it('renders dark fullscreen container without header or navigation bar', () => {
      render(
        <MemoryRouter initialEntries={['/kds']}>
          <OpsShell>
            <div>Kitchen Display View</div>
          </OpsShell>
        </MemoryRouter>,
      );

      expect(screen.getByText('Kitchen Display View')).toBeInTheDocument();
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.getByTestId('ops-shell')).toBeInTheDocument();
    });
  });

  describe('AdminShell', () => {
    it('renders admin layout with children', () => {
      render(
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <AdminShell>
            <div>Admin Dashboard View</div>
          </AdminShell>
        </MemoryRouter>,
      );

      expect(screen.getByText('Admin Dashboard View')).toBeInTheDocument();
    });
  });

  describe('shell-config and hasM3NavBar', () => {
    it('returns true for 5 core customer tab routes', () => {
      expect(hasM3NavBar('/')).toBe(true);
      expect(hasM3NavBar('/menu')).toBe(true);
      expect(hasM3NavBar('/table-reservation')).toBe(true);
      expect(hasM3NavBar('/promotions')).toBe(true);
      expect(hasM3NavBar('/account')).toBe(true);
    });

    it('returns false for functional pages that hide bottom nav', () => {
      expect(hasM3NavBar('/checkout')).toBe(false);
      expect(hasM3NavBar('/order')).toBe(false);
      expect(hasM3NavBar('/checkin')).toBe(false);
      expect(hasM3NavBar('/track-order')).toBe(false);
    });

    it('returns false for operations and admin routes', () => {
      expect(hasM3NavBar('/kds')).toBe(false);
      expect(hasM3NavBar('/tv-menu')).toBe(false);
      expect(hasM3NavBar('/pos/table/12')).toBe(false);
      expect(hasM3NavBar('/admin')).toBe(false);
      expect(hasM3NavBar('/admin/dashboard')).toBe(false);
    });

    it('getShellConfig returns correct configuration per route', () => {
      expect(getShellConfig('/')?.showTop).toBe(false);
      expect(getShellConfig('/menu')?.title).toBe('Thực đơn');
      expect(getShellConfig('/checkout')?.showNav).toBe(false);
      expect(getShellConfig('/unknown-path')).toBeUndefined();
    });
  });
});
