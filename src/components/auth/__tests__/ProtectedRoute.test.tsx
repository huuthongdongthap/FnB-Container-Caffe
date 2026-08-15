import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// vi.mock is hoisted — use vi.hoisted() for variables it references
const { mockGetState } = vi.hoisted(() => ({ mockGetState: vi.fn<() => { user: { id: string; name: string; email: string; role: string } | null }>(() => ({ user: null })) }));

// useAuthStore is a Zustand hook: callable with selector + has .getState/.setState
function mockHook(selector?: (s: { user: { id: string; name: string; email: string; role: string } | null }) => unknown) {
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

  function renderProtected(initialRoute = '/admin/dashboard', user: { id: string; name: string; email: string; role: string } | null = null) {
    mockGetState.mockReturnValue({ user });
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

  it('renders admin content when user exists', () => {
    renderProtected('/admin/dashboard', { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'owner' });
    expect(screen.getByText('Admin Dashboard')).toBeDefined();
  });

  it('redirects to /admin/login when user is null', () => {
    renderProtected('/admin/dashboard', null);
    expect(screen.getByText('Login Page')).toBeDefined();
  });

  it('redirects to /admin/login for any protected route when unauthenticated', () => {
    renderProtected('/admin/orders', null);
    expect(screen.getByText('Login Page')).toBeDefined();
  });

  it('allows access to child routes when authenticated', () => {
    renderProtected('/admin/orders', { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'owner' });
    expect(screen.getByText('Admin Orders')).toBeDefined();
  });
});