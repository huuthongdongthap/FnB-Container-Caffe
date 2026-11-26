export interface InvoiceRecord {
  id: number | string;
  order_id?: string;
  erpnext_id?: string;
  erpnext_model?: string;
  sync_status?: string;
  attempts?: number;
  error_message?: string | null;
  created_at: string;
  last_synced_at?: string;
  customer_name: string | null;
  total_amount?: string | number | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  // Subscription invoice fields (`/api/subscriptions/invoices/list`)
  subscription_id?: string;
  invoice_number?: string | null;
  amount_vnd?: number | null;
  status?: string;
  period_start?: string;
  period_end?: string;
  paid_at?: string | null;
  payment_method?: string | null;
  plan_name?: string | null;
}

export function getStatusLabel(status: string, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  const LABELS: Record<string, string> = {
    synced: t('invoices.status.synced', { defaultValue: 'Đã đồng bộ' }),
    failed: t('invoices.status.failed', { defaultValue: 'Thất bại' }),
    pending: t('invoices.status.pending', { defaultValue: 'Chờ thanh toán' }),
    paid: t('invoices.status.paid', { defaultValue: 'Đã thanh toán' }),
    manual: t('invoices.status.manual', { defaultValue: 'Thanh toán thủ công' }),
    processing: t('invoices.status.processing', { defaultValue: 'Đang xử lý' }),
    cancelled: t('invoices.status.cancelled', { defaultValue: 'Đã hủy' }),
    canceled: t('invoices.status.cancelled', { defaultValue: 'Đã hủy' }),
  };
  return LABELS[status] || status;
}

export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '---';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '---';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '---';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '---';
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '---';
  }
}
