/**
 * ERPNext Invoices Routes — /api/erpnext-invoices
 * Invoice creation, VAT submission, retry.
 */

import { createErpnextAccountingClient, OrderInput } from '../clients/erpnext-accounting-client';

interface InvoiceEnv {
  AURA_DB?: D1Database;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
}

export async function handleErpnextInvoicesRequest(request: Request, env: InvoiceEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/erpnext-invoices', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const accountingClient = createErpnextAccountingClient(env);
    if (!accountingClient) {
      return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
    }

    // POST /api/erpnext-invoices/create — create invoice from order
    if (method === 'POST' && path === '/create') {
      const body = await request.json() as OrderInput;

      if (!body.id) {
        return json({ success: false, error: 'order id required' }, 400);
      }

      const result = await accountingClient.processOrderToInvoice(body, env);
      return json({ success: true, data: result }, 201);
    }

    // GET /api/erpnext-invoices/:orderId — get invoice by order ID
    if (method === 'GET' && path.match(/^\/[^/]+$/)) {
      const orderId = path.slice(1);
      const invoice = await accountingClient.getInvoiceByOrderId(orderId, env);

      if (!invoice) {
        return json({ success: false, error: 'No invoice found for this order' }, 404);
      }

      return json({ success: true, data: invoice });
    }

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

    // POST /api/erpnext-invoices/retry — retry failed syncs
    if (method === 'POST' && path === '/retry') {
      const db = env.AURA_DB;
      if (!db) return json({ success: false, error: 'Database not available' }, 503);

      const { results } = await db.prepare(
        "SELECT local_id FROM erpnext_mappings WHERE sync_status = 'failed' AND attempts < 5 ORDER BY created_at ASC LIMIT 10"
      ).all<{ local_id: string }>();

      const retried: string[] = [];
      const failed: Array<{ orderId: string; error: string }> = [];

      for (const row of results || []) {
        try {
          const body = await request.json().catch(() => ({}));
          const order: OrderInput = { id: row.local_id, ...(body as Record<string, unknown>) } as OrderInput;
          await accountingClient.processOrderToInvoice(order, env);
          retried.push(row.local_id);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          failed.push({ orderId: row.local_id, error: msg });
        }
      }

      return json({ success: true, data: { retried: retried.length, failed } });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }
}
