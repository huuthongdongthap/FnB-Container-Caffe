import { render, type RenderOptions } from '@testing-library/react';
import { renderHook as rtlRenderHook, type RenderHookOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { useAuthStore, type AuthUser } from '@/hooks/stores/use-auth-store';
import { type ReactElement, type ReactNode } from 'react';

export { screen, waitFor, within, fireEvent } from '@testing-library/react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export function renderHook<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>,
) {
  return rtlRenderHook(hook, { wrapper: AllProviders, ...options });
}

/**
 * Inject mock auth state for tests. Call before rendering components that read useAuthStore.
 */
export function createTestAuthState(token: string | null = 'test-jwt', user?: AuthUser) {
  const testUser: AuthUser = user || { id: 'test-1', name: 'Test User', email: 'test@test.com', role: 'customer' };
  useAuthStore.setState({ token, user: token ? testUser : null, loading: false, error: null });
  if (token) {
    localStorage.setItem('aura_auth', JSON.stringify({ token, user: testUser }));
  } else {
    localStorage.removeItem('aura_auth');
  }
}

export { renderWithProviders as render };
