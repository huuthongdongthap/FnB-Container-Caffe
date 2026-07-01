import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// vi.mock is hoisted — use vi.hoisted() for variables it references
const { mockGetState } = vi.hoisted(() => ({ mockGetState: vi.fn<() => { token: string | null }>(() => ({ token: null })) }));

// useAuthStore is a Zustand hook: callable with selector + has .getState/.setState
function mockHook(selector?: (s: { token: string | null }) => unknown) {
  const state = mockGetState();
  if (typeof selector === 'function') return selector(state);
  return state;
}
mockHook.getState = mockGetState;
mockHook.setState = vi.fn();

vi.mock('@/hooks/stores/use-auth-store', () => ({
  useAuthStore: mockHook,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderProtected(initialRoute = '/admin/dashboard', token: string | null = null) {
    mockGetState.mockReturnValue({ token });
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/admin/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin/dashboard" element={<div>Admin Dashboard</div>} />
            <Route path="/admin/orders" element={<div>Admin Orders</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders admin content when token exists', () => {
    renderProtected('/admin/dashboard', 'valid-token');
    expect(screen.getByText('Admin Dashboard')).toBeDefined();
  });

  it('redirects to /admin/login when token is null', () => {
    renderProtected('/admin/dashboard', null);
    expect(screen.getByText('Login Page')).toBeDefined();
  });

  it('redirects to /admin/login for any protected route when unauthenticated', () => {
    renderProtected('/admin/orders', null);
    expect(screen.getByText('Login Page')).toBeDefined();
  });

  it('allows access to child routes when authenticated', () => {
    renderProtected('/admin/orders', 'valid-token');
    expect(screen.getByText('Admin Orders')).toBeDefined();
  });
});
