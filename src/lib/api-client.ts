export const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

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

/* ── Error interceptor ───────────────────────── */

interface ErrorInterceptor {
  (error: ApiClientError, context: { path: string; method: string }): void;
}

let onError: ErrorInterceptor | null = null;

export function setErrorInterceptor(handler: ErrorInterceptor | null): void {
  onError = handler;
}

function reportError(error: ApiClientError, path: string, method: string): void {
  // Call external interceptor if configured
  onError?.(error, { path, method });

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error(`[API Error] ${method} ${path}:`, error.status, error.message);
  }

  // Report to analytics endpoint (fire-and-forget)
  try {
    const body = JSON.stringify({
      type: 'api_error',
      status: error.status,
      message: error.message,
      path,
      method,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/errors', body);
    } else {
      fetch('/api/errors', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Silently fail
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
    const apiError = new ApiClientError({
      status: res.status,
      message: body.message || `Request failed: ${res.status}`,
      errors: body.errors,
    });
    reportError(apiError, path, options.method ?? 'GET');
    throw apiError;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}
