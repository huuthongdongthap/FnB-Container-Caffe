/**
 * ERPNext Invoices Routes — /api/erpnext-invoices
 * Invoice creation, VAT submission, retry.
 */

import {
  createErpnextAccountingClient,
  createErpnextAccountingClientWithKv,
  OrderInput,
} from '../clients/erpnext-accounting-client';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'erpnext-invoices' });

export interface InvoiceEnv {
  AURA_DB?: D1Database;
  AUTH_KV?: import('@cloudflare/workers-types').KVNamespace;
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

async function loadOrderForInvoice(
  db: D1Database | undefined,
  orderId: string,
  tenantId: string,
): Promise<{ allowed: boolean; orderRow: Record<string, unknown> | null }> {
  if (!db) {
    return { allowed: true, orderRow: null };
  }
  const selectQueries = [
    'SELECT id, items, total, discount_amount, customer_name, customer_phone, customer_id, tenant_id FROM orders WHERE id = ? LIMIT 1',
    'SELECT * FROM orders WHERE id = ? LIMIT 1',
    'SELECT id, tenant_id FROM orders WHERE id = ? LIMIT 1',
  ];
  for (const sql of selectQueries) {
    try {
      const orderRow = await db.prepare(sql).bind(orderId).first<Record<string, unknown>>();
      if (!orderRow) return { allowed: false, orderRow: null };
      return {
        allowed: tenantId === '*' ? true : matchesOrderTenant(orderRow, tenantId),
        orderRow,
      };
    } catch {
      // Try next schema variant
    }
  }
  try {
    const orderRow = await db.prepare('SELECT id FROM orders WHERE id = ? LIMIT 1').bind(orderId).first<Record<string, unknown>>();
    if (!orderRow) return { allowed: false, orderRow: null };
    return { allowed: tenantId === 'default' || tenantId === '*', orderRow };
  } catch {
    return { allowed: tenantId === 'default' || tenantId === '*', orderRow: null };
  }
}

async function verifyOrderTenantOwnership(
  db: D1Database | undefined,
  orderId: string,
  tenantId: string,
): Promise<boolean> {
  if (!db || tenantId === '*') return true;
  const { allowed } = await loadOrderForInvoice(db, orderId, tenantId);
  return allowed;
}

function mergeAuthoritativeOrder(
  body: OrderInput,
  orderRow: Record<string, unknown> | null,
): OrderInput {
  if (!orderRow) return body;
  const merged: OrderInput = { ...body, id: String(orderRow.id ?? body.id) };

  let parsedItems: unknown[] = [];
  if (typeof orderRow.items === 'string' && orderRow.items.trim()) {
    try {
      const raw = JSON.parse(orderRow.items);
      if (Array.isArray(raw)) parsedItems = raw;
    } catch {
      parsedItems = [];
    }
  } else if (Array.isArray(orderRow.items)) {
    parsedItems = orderRow.items;
  }

  const rawTotal = orderRow.total ?? orderRow.total_amount;
  const dbTotal =
    typeof rawTotal === 'number' && !Number.isNaN(rawTotal)
      ? rawTotal
      : typeof rawTotal === 'string' && rawTotal.trim() !== '' && !Number.isNaN(Number(rawTotal))
        ? Number(rawTotal)
        : undefined;

  if (parsedItems.length > 0) {
    merged.items = parsedItems.map((item) => {
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        id: String(rec.id ?? rec.item_code ?? 'ITEM'),
        item_code: typeof rec.item_code === 'string' ? rec.item_code : undefined,
        name: String(rec.name ?? rec.item_name ?? rec.item_code ?? 'Order Item'),
        quantity: Number(rec.quantity ?? rec.qty ?? 1),
        price: Number(rec.price ?? rec.rate ?? 0),
      };
    });
  } else if (dbTotal !== undefined && dbTotal > 0) {
    const clientItems = Array.isArray(body.items) ? body.items : [];
    const clientSum = clientItems.reduce(
      (sum, item) => sum + Number(item?.price ?? 0) * Number(item?.quantity ?? 1),
      0
    );
    if (clientItems.length > 0 && clientSum !== dbTotal) {
      merged.items = [{ ...clientItems[0], quantity: 1, price: dbTotal }];
    } else if (clientItems.length === 0) {
      merged.items = [
        {
          id: String(orderRow.id ?? body.id),
          item_code: 'ORDER-ITEM',
          name: 'Order Item',
          quantity: 1,
          price: dbTotal,
        },
      ];
    }
  }

  if (dbTotal !== undefined) {
    merged.total = dbTotal;
  }
  const dbDiscount = orderRow.discount_amount ?? orderRow.discount;
  if (typeof dbDiscount === 'number' && !Number.isNaN(dbDiscount)) {
    (merged as unknown as Record<string, unknown>).discount_amount = dbDiscount;
  }
  if (typeof orderRow.customer_name === 'string' && orderRow.customer_name.trim()) {
    merged.customer_name = orderRow.customer_name;
  }
  if (typeof orderRow.customer_phone === 'string' && orderRow.customer_phone.trim()) {
    merged.customer_phone = orderRow.customer_phone;
  }
  if (typeof orderRow.customer_email === 'string' && orderRow.customer_email.trim()) {
    merged.customer_email = orderRow.customer_email;
  }
  if (typeof orderRow.customer_id === 'string' && orderRow.customer_id.trim()) {
    (merged as unknown as Record<string, unknown>).customer_id = orderRow.customer_id;
  }

  return merged;
}

async function verifyInvoiceTenantOwnership(
  db: D1Database | undefined,
  invoiceId: string,
  tenantId: string,
): Promise<boolean> {
  if (!db || tenantId === '*') return true;
  const queries: Array<{ sql: string; binds: unknown[] }> = [
    {
      sql: "SELECT COALESCE(NULLIF(TRIM(m.tenant_id), ''), o.tenant_id) AS tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.erpnext_id = ? OR m.local_id = ? LIMIT 1",
      binds: [invoiceId, invoiceId],
    },
    {
      sql: "SELECT COALESCE(NULLIF(TRIM(m.tenant_id), ''), o.tenant_id) AS tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.erpnext_name = ? OR m.local_id = ? LIMIT 1",
      binds: [invoiceId, invoiceId],
    },
    {
      sql: 'SELECT o.tenant_id AS tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.erpnext_id = ? OR m.local_id = ? LIMIT 1',
      binds: [invoiceId, invoiceId],
    },
    {
      sql: 'SELECT o.tenant_id AS tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.erpnext_name = ? OR m.local_id = ? LIMIT 1',
      binds: [invoiceId, invoiceId],
    },
    {
      sql: 'SELECT tenant_id FROM erpnext_mappings WHERE erpnext_name = ? LIMIT 1',
      binds: [invoiceId],
    },
    {
      sql: 'SELECT tenant_id FROM erpnext_mappings WHERE erpnext_id = ? LIMIT 1',
      binds: [invoiceId],
    },
    {
      sql: 'SELECT tenant_id FROM erpnext_mappings WHERE erpnext_invoice_id = ? LIMIT 1',
      binds: [invoiceId],
    },
    {
      sql: 'SELECT tenant_id FROM orders WHERE id = ? LIMIT 1',
      binds: [invoiceId],
    },
  ];

  for (const q of queries) {
    try {
      const row = await db.prepare(q.sql).bind(...q.binds).first<Record<string, unknown>>();
      if (row) {
        return matchesOrderTenant(row, tenantId);
      }
    } catch {
      // Try next schema variant
    }
  }

  try {
    const anyMapping = await db.prepare('SELECT 1 AS present FROM erpnext_mappings LIMIT 1').first<Record<string, unknown>>();
    if (anyMapping && Object.keys(anyMapping).length > 0) {
      return false;
    }
  } catch {
    // Table may not exist in minimal unit test mocks
  }

  return tenantId === 'default';
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
    const accountingClient =
      (env.AUTH_KV && typeof createErpnextAccountingClientWithKv === 'function'
        ? await createErpnextAccountingClientWithKv(env, tenantId)
        : null) ?? createErpnextAccountingClient(env);

    // POST /api/erpnext-invoices/create — create invoice from order
    if (method === 'POST' && path === '/create') {
      const body = await request.json() as OrderInput;

      if (!body.id) {
        return json({ success: false, error: 'order id required' }, 400);
      }

      const { allowed, orderRow } = await loadOrderForInvoice(env.AURA_DB, body.id, tenantId);
      if (!allowed) {
        return json({ success: false, error: 'Order not found' }, 404);
      }

      if (!accountingClient) {
        return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
      }

      const authoritativeOrder = mergeAuthoritativeOrder(body, orderRow);
      const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
      const result = await accountingClient.processOrderToInvoice(authoritativeOrder, env, effectiveTenant);
      return json({ success: true, data: result }, 201);
    }

    // GET /api/erpnext-invoices/list — list all invoice mappings
    if (method === 'GET' && path === '/list') {
      const db = env.AURA_DB;
      if (!db) return json({ success: false, error: 'Database not available' }, 503);

      let dataResults: unknown[] = [];
      try {
        let results: Array<Record<string, unknown>> | undefined;
        try {
          const res = await db.prepare(`
            SELECT m.id, m.local_id as order_id, m.erpnext_id, m.erpnext_model, m.sync_status,
                   m.attempts, m.created_at, m.last_synced_at, o.customer_name, o.total_amount,
                   o.customer_email, o.customer_phone,
                   COALESCE(NULLIF(TRIM(m.tenant_id), ''), o.tenant_id) AS tenant_id
            FROM erpnext_mappings m
            LEFT JOIN orders o ON o.id = m.local_id
            WHERE m.local_type = ?
              AND (? = '*' OR COALESCE(NULLIF(TRIM(COALESCE(m.tenant_id, o.tenant_id)), ''), 'default') = ?)
            ORDER BY m.created_at DESC LIMIT 100
          `).bind('order', tenantId, tenantId).all<Record<string, unknown>>();
          results = res.results;
        } catch {
          try {
            const res = await db.prepare(`
              SELECT m.id, m.local_id as order_id, m.erpnext_id, m.erpnext_model, m.sync_status,
                     m.attempts, m.created_at, m.last_synced_at, o.customer_name, o.total_amount,
                     o.customer_email, o.customer_phone, o.tenant_id
              FROM erpnext_mappings m
              LEFT JOIN orders o ON o.id = m.local_id
              WHERE m.local_type = ?
                AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
              ORDER BY m.created_at DESC LIMIT 100
            `).bind('order', tenantId, tenantId).all<Record<string, unknown>>();
            results = res.results;
          } catch {
            const res = await db.prepare(`
              SELECT m.id, m.local_id as order_id, m.erpnext_id, m.erpnext_model, m.sync_status,
                     m.attempts, m.created_at, m.last_synced_at, o.customer_name, o.total_amount,
                     o.customer_email, o.customer_phone, o.tenant_id
              FROM erpnext_mappings m
              LEFT JOIN orders o ON o.id = m.local_id
              WHERE m.local_type = ?
              ORDER BY m.created_at DESC LIMIT 100
            `).bind('order').all<Record<string, unknown>>();
            results = res.results;
          }
        }
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
        let res: { results?: Array<{ local_id: string; tenant_id?: string | null }> };
        try {
          res = await db.prepare(
            "SELECT m.local_id, COALESCE(NULLIF(TRIM(m.tenant_id), ''), o.tenant_id) AS tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.sync_status = 'failed' AND m.attempts < 5 AND (? = '*' OR COALESCE(NULLIF(TRIM(COALESCE(m.tenant_id, o.tenant_id)), ''), 'default') = ?) ORDER BY m.created_at ASC LIMIT 10"
          ).bind(tenantId, tenantId).all<{ local_id: string; tenant_id?: string | null }>();
        } catch {
          try {
            res = await db.prepare(
              "SELECT m.local_id, o.tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.sync_status = 'failed' AND m.attempts < 5 AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?) ORDER BY m.created_at ASC LIMIT 10"
            ).bind(tenantId, tenantId).all<{ local_id: string; tenant_id?: string | null }>();
          } catch {
            res = await db.prepare(
              "SELECT m.local_id, o.tenant_id FROM erpnext_mappings m LEFT JOIN orders o ON o.id = m.local_id WHERE m.sync_status = 'failed' AND m.attempts < 5 ORDER BY m.created_at ASC LIMIT 10"
            ).all<{ local_id: string; tenant_id?: string | null }>();
          }
        }
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
      const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';

      for (const row of rows) {
        try {
          const baseOrder: OrderInput = { id: row.local_id, ...(body as Record<string, unknown>) } as OrderInput;
          const loaded = await loadOrderForInvoice(db, row.local_id, tenantId).catch(() => ({
            allowed: true,
            orderRow: null,
          }));
          const order = mergeAuthoritativeOrder(baseOrder, loaded.orderRow);
          await accountingClient.processOrderToInvoice(order, env, effectiveTenant);
          retried.push(row.local_id);
        } catch (e: unknown) {
          log.error('erpnext_invoice_retry_failed', { orderId: row.local_id, error: e instanceof Error ? e.message : String(e) });
          failed.push({ orderId: row.local_id, error: 'Retry failed' });
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
      const explicitTenant = resolvedTenantId ?? (rawTenantHeader && rawTenantHeader !== '*' ? rawTenantHeader : undefined);
      const invoice = explicitTenant
        ? await accountingClient.getInvoiceByOrderId(orderId, env, explicitTenant === '*' ? 'default' : explicitTenant)
        : await accountingClient.getInvoiceByOrderId(orderId, env);
      if (!invoice) return json({ success: false, error: 'No invoice found for this order' }, 404);
      return json({ success: true, data: invoice });
    }

    // POST /api/erpnext-invoices/:id/vat — submit VAT e-invoice
    if (method === 'POST' && path.endsWith('/vat')) {
      const invoiceId = path.replace('/vat', '').slice(1);
      if (!(await verifyInvoiceTenantOwnership(env.AURA_DB, invoiceId, tenantId))) {
        return json({ success: false, error: 'Invoice not found' }, 404);
      }
      if (!accountingClient) return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
      const body = await request.json() as { success: boolean; invoice_number?: string };
      await accountingClient.updateInvoiceVAT(invoiceId, body);
      return json({ success: true, message: 'VAT status updated' });
    }

    // GET /api/erpnext-invoices/:id/pdf — generate PDF
    if (method === 'GET' && path.endsWith('/pdf')) {
      const invoiceId = path.replace('/pdf', '').slice(1);
      if (!(await verifyInvoiceTenantOwnership(env.AURA_DB, invoiceId, tenantId))) {
        return json({ success: false, error: 'Invoice not found' }, 404);
      }
      if (!accountingClient) return json({ success: false, error: 'ERPNext accounting not configured' }, 503);
      const pdfInfo = await accountingClient.generateInvoicePDF(invoiceId);
      return json({ success: true, data: pdfInfo });
    }

    if (!accountingClient) return json({ success: false, error: 'ERPNext accounting not configured' }, 503);

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    log.error('erpnext_invoices_request_failed', { error: e instanceof Error ? e.message : String(e) });
    return json({ success: false, error: 'Internal integration error' }, 500);
  }
}
