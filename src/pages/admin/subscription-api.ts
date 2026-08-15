import { API_BASE } from '@/lib/api-client';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function statusColor(status: string): 'success' | 'warning' | 'destructive' | 'info' | 'default' {
  switch (status) {
    case 'active': return 'success';
    case 'paused': return 'warning';
    case 'cancelled': return 'destructive';
    case 'pending': return 'info';
    default: return 'default';
  }
}

export function statusLabel(status: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const labels: Record<string, string> = {
    active: t('statusActive'),
    paused: t('statusPaused'),
    cancelled: t('statusCancelled'),
    pending: t('statusPending'),
  };
  return labels[status] || status;
}
