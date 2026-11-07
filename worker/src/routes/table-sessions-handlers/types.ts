import { matchesTenantRow } from '../../lib/db';

export { matchesTenantRow };

export function hasExplicitTenantId(row: Record<string, unknown> | null | undefined): boolean {
  if (!row || !('tenant_id' in row)) return false;
  return row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '';
}

export async function isTableAccessibleByTenant(
  db: D1Database,
  tableId: string | undefined,
  tenantId: string,
): Promise<boolean> {
  const rawTenant = (tenantId || '').trim() || 'default';
  const normTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  if (normTenant === '*') return true;
  if (!tableId) return normTenant === 'default';
  try {
    const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(tableId).first<Record<string, unknown>>();
    if (!table) return normTenant === 'default';
    return matchesTenantRow(table, normTenant);
  } catch {
    try {
      const legacyTable = await db.prepare('SELECT * FROM tables WHERE id = ?').bind(tableId).first<Record<string, unknown>>();
      if (!legacyTable) return normTenant === 'default';
      return matchesTenantRow(legacyTable, normTenant);
    } catch {
      return normTenant === 'default';
    }
  }
}

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
