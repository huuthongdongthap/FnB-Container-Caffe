export interface TableSession {
  id: string;
  table_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: 'active' | 'ordering' | 'paid' | 'closed' | 'no_show';
  opened_at: string;
  closed_at: string | null;
  order_count: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenSessionInput {
  table_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
}

export interface CloseSessionInput {
  status?: 'closed' | 'no_show';
  notes?: string;
}

export const SESSION_STATUSES = ['active', 'ordering', 'paid', 'closed', 'no_show'] as const;

export function makeSessionId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return (`SES-${Date.now().toString(36)}${rand}`).toUpperCase();
}
