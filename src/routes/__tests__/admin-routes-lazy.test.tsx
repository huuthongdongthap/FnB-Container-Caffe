import { Suspense } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { adminRoutes } from '../admin-routes';

const shellImport = vi.hoisted(() => vi.fn());

vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: () => <Outlet />,
  ADMIN_SHELL_ROLES: ['owner'],
}));
vi.mock('@/components/stitch/AdminShell', () => {
  shellImport();
  throw new Error('Synthetic AdminShell chunk load failure');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lazy admin route failures', () => {
  it('shows the route refresh fallback without escaping to the application root', async () => {
    const rootCaught = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Error reporting must stay inside the test when the real boundary catches.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    render(
      <ErrorBoundary fallback={<div>Escaped to application root</div>} onError={rootCaught}>
        <MemoryRouter initialEntries={['/admin/orders']}>
          <Suspense fallback={<div>Loading admin route</div>}>
            <Routes>{adminRoutes}</Routes>
          </Suspense>
        </MemoryRouter>
      </ErrorBoundary>,
    );

    const routeFallback = await screen.findByRole('alert');
    expect(shellImport).toHaveBeenCalledOnce();
    expect(within(routeFallback).getByText('Something went wrong / Đã xảy ra lỗi')).toBeInTheDocument();
    expect(within(routeFallback).getByRole('button', { name: 'Refresh / Làm mới' })).toBeInTheDocument();
    expect(screen.queryByText('Escaped to application root')).not.toBeInTheDocument();
    expect(rootCaught).not.toHaveBeenCalled();
  });
});
