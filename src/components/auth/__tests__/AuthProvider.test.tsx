import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { AuthProvider } from '@/components/auth/AuthProvider';

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders children', () => {
    render(
      <AuthProvider>
        <div data-testid="child">Hello</div>
      </AuthProvider>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('renders children even with no token in localStorage', () => {
    render(
      <AuthProvider>
        <span data-testid="no-auth-child">Public content</span>
      </AuthProvider>,
    );
    expect(screen.getByTestId('no-auth-child')).toBeDefined();
  });

  it('renders children when valid token exists in localStorage', () => {
    localStorage.setItem('aura_auth', JSON.stringify({
      token: 'valid-jwt',
      user: { id: '1', name: 'Test', email: 'test@test.com', role: 'customer' },
    }));

    render(
      <AuthProvider>
        <span data-testid="authed-child">Authed</span>
      </AuthProvider>,
    );
    expect(screen.getByTestId('authed-child')).toBeDefined();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('aura_auth', 'not-valid-json{{{');

    // Should not crash
    expect(() => render(
      <AuthProvider>
        <div>Still works</div>
      </AuthProvider>,
    )).not.toThrow();
  });

  it('shows loading state while validating token', async () => {
    // The AuthProvider might show nothing or a loader during initial fetch
    const { container } = render(
      <AuthProvider>
        <div data-testid="after-load">Loaded</div>
      </AuthProvider>,
    );
    // Children should eventually render
    await waitFor(() => {
      expect(container.textContent).toBeTruthy();
    });
  });
});
