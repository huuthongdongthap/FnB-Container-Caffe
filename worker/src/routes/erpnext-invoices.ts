/**
 * ERPNext Invoices Routes — /api/erpnext-invoices
 * Invoice creation, VAT submission, retry.
 */

import { createErpnextAccountingClient, OrderInput } from '../clients/erpnext-accounting-client';

export interface InvoiceEnv {
  AURA_DB?: D1Database;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
}

function matchesOrderTenant(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if (!row) return false;
  if ('tenant_id' in row && row.tenant_id !== undefined) {
    const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

async function verifyOrderTenantOwnership(
  db: D1Database | undefined,
  orderId: string,
  tenantId: string,
): Promise<boolean> {
  if (!db || tenantId === '*') return true;
  try {
    const orderRow = await db.prepare('SELECT id, tenant_id FROM orders WHERE id = ? LIMIT 1').bind(orderId).first<Record<string, unknown>>();
    if (!orderRow) return false;
    return matchesOrderTenant(orderRow, tenantId);
  } catch {
    try {
      const orderRow = await db.prepare('SELECT id FROM orders WHERE id = ? LIMIT 1').bind(orderId).first<Record<string, unknown>>();
      if (!orderRow) return false;
      return tenantId === 'default';
    } catch {
      return tenantId === 'default';
    }
  }
}

export async function handleErpnextInvoicesRequest(
  request: Request,
  env: InvoiceEnv,
  resolvedTenantId?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/erpnext-invoices', '');
  const method = request.method;
  const rawTenantHeader = (request.headers.get('X-Tenant-ID') || request.headers.get('x-tenant-id') || '').trim();
  const tenantId = resolvedTenantId ?? (rawTenantHeader && rawTenantHeader !== '*' ? rawTenantHeader : 'default');

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  try {
    const accountingClient = createErpnextAccountingClient(env);

    // POST /api/erpnext-invoices/create — create invoice from order
    if (method === 'POST' && path === '/create') {
      const body = await request.json() as OrderInput;

      if (!body.id) {
        return json({ success: false, error: 'order id required' }, 400);
      }

      if (!(await verifyOrderTenantOwnership(env.AURA_DB, body.id, tenantId))) {
        return json({ success: false, error: 'Order not found' }, 404);
      }

      if (!accountingClient) {
        return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
      }

      const result = await accountingClient.processOrderToInvoice(body, env);
      return json({ success: true, data: result }, 201);
    }

    // GET /api/erpnext-invoices/list — list all invoice mappings
    if (method === 'GET' && path === '/list') {
      const db = env.AURA_DB;
      if (!db) return json({ success: false, error: 'Database not available' }, 503);

      let dataResults: unknown[] = [];
      try {
        const { results } = await db.prepare(`
          SELECT m.id, m.local_id as order_id, m.erpnext_id, m.erpnext_model, m.sync_status,
                 m.attempts, m.created_at, m.last_synced_at, o.customer_name, o.total_amount,
                 o.customer_email, o.customer_phone, o.tenant_id
          FROM erpnext_mappings m
          LEFT JOIN orders o ON o.id = m.local_id
          WHERE m.local_type = ?
          ORDER BY m.created_at DESC LIMIT 100
        `).bind('order').all<Record<string, unknown>>();
        dataResults = (results || []).filter((r) => matchesOrderTenant(r, tenantId));
      } catch {
        try {
          const { results } = await db.prepare(`
            SELECT m.id, COALESCE(m.local_id, m.aura_order_id) as order_id,
                   COALESCE(m.erpnext_id, m.erpnext_invoice_id) as erpnext_id,
                   m.sync_status, m.created_at, m.last_synced_at
            FROM erpnext_mappings m ORDER BY m.created_at DESC LIMIT 100
          `).all();
          dataResults = tenantId === 'default' || tenantId === '*' ? (results || []) : [];
        } catch {
          dataResults = [];
        }
      }
      return json({ success: true, data: dataResults });
    }

    // POST /api/erpnext-invoices/retry — retry failed syncs
    if (method === 'POST' && path === '/retry') {
      if (!accountingClient) return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
      const db = env.AURA_DB;
      if (!db) return json({ success: false, error: 'Database not available' }, 503);

      let rows: Array<{ local_id: string; tenant_id?: string | null }> = [];
      try {
        const res = await db.prepare(
          "SELECT m.local_id, o.tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.sync_status = 'failed' AND m.attempts < 5 ORDER BY m.created_at ASC LIMIT 10"
        ).all<{ local_id: string; tenant_id?: string | null }>();
        rows = (res.results || []).filter((r) => matchesOrderTenant(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
          const res = await db.prepare(
            "SELECT local_id FROM erpnext_mappings WHERE sync_status = 'failed' AND attempts < 5 ORDER BY created_at ASC LIMIT 10"
          ).all<{ local_id: string }>();
          rows = res.results || [];
        }
      }

      const retried: string[] = [];
      const failed: Array<{ orderId: string; error: string }> = [];
      const body = await request.json().catch(() => ({}));

      for (const row of rows) {
        try {
          const order: OrderInput = { id: row.local_id, ...(body as Record<string, unknown>) } as OrderInput;
          await accountingClient.processOrderToInvoice(order, env);
          retried.push(row.local_id);
        } catch (e: unknown) {
          failed.push({ orderId: row.local_id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return json({ success: true, data: { retried: retried.length, failed } });
    }

    // GET /api/erpnext-invoices/:orderId — get invoice by order ID
    if (method === 'GET' && path.match(/^\/[^/]+$/)) {
      const orderId = path.slice(1);
      if (!(await verifyOrderTenantOwnership(env.AURA_DB, orderId, tenantId))) {
        return json({ success: false, error: 'Order not found' }, 404);
      }
      if (!accountingClient) return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
      const invoice = await accountingClient.getInvoiceByOrderId(orderId, env);
      if (!invoice) return json({ success: false, error: 'No invoice found for this order' }, 404);
      return json({ success: true, data: invoice });
    }

    if (!accountingClient) return json({ success: false, error: 'ERPNext accounting not configured' }, 503);

    // POST /api/erpnext-invoices/:id/vat — submit VAT e-invoice
    if (method === 'POST' && path.endsWith('/vat')) {
      const invoiceId = path.replace('/vat', '').slice(1);
      const body = await request.json() as { success: boolean; invoice_number?: string };
      await accountingClient.updateInvoiceVAT(invoiceId, body);
      return json({ success: true, message: 'VAT status updated' });
    }

    // GET /api/erpnext-invoices/:id/pdf — generate PDF
    if (method === 'GET' && path.endsWith('/pdf')) {
      const invoiceId = path.replace('/pdf', '').slice(1);
      const pdfInfo = await accountingClient.generateInvoicePDF(invoiceId);
      return json({ success: true, data: pdfInfo });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
