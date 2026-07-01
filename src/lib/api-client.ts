const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor({ status, message, errors }: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Lazy token read: useAuthStore uses raw fetch (not apiFetch), so no circular dep.
  let token: string | null = null;
  try {
    const { useAuthStore } = await import('@/hooks/stores/use-auth-store');
    token = useAuthStore.getState().token;
  } catch { /* store not loaded yet */ }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    try {
      const { useAuthStore } = await import('@/hooks/stores/use-auth-store');
      useAuthStore.getState().logout();
    } catch { /* auth store may not be loaded */ }
  }

  if (!res.ok) {
    let body: Partial<ApiError> = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error response
    }
    throw new ApiClientError({
      status: res.status,
      message: body.message || `Request failed: ${res.status}`,
      errors: body.errors,
    });
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}
