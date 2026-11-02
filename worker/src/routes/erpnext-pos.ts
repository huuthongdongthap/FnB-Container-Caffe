/**
 * ERPNext POS Routes — /api/erpnext-pos
 * Sales order creation, product availability, webhooks.
 */

import { createErpnextClient, ErpnextClient } from '../clients/erpnext-client';
import { createErpnextProductClient, type ProductEnv } from '../clients/erpnext-product-client';
import { erpnextSalesOrderSchema, erpnextPosWebhookSchema, erpnextProductsBatchSyncSchema } from '../lib/validators';

interface PosEnv {
  AURA_DB?: D1Database;
  AURA_KV?: KVNamespace;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
  ERPNEXT_WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

interface _SalesOrderInput { // eslint-disable-line no-unused-vars
  customer_name?: string;
  customer_phone?: string;
  items: Array<{
    item_code: string;
    item_name?: string;
    qty: number;
    rate: number;
    amount?: number;
  }>;
  table_id?: string;
  notes?: string;
}

function getClient(env: PosEnv): ErpnextClient | null {
  return createErpnextClient(env);
}

export async function handleErpnextPosRequest(
  request: Request,
  env: PosEnv,
  resolvedTenantId?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/erpnext-pos', '');
  const method = request.method;
  const rawTenantHeader = (request.headers.get('X-Tenant-ID') || request.headers.get('x-tenant-id') || '').trim();
  const tenantId = resolvedTenantId ?? (rawTenantHeader && rawTenantHeader !== '*' ? rawTenantHeader : 'default');

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  try {
    // POST /api/erpnext-pos/sales-order — create sales order
    if (method === 'POST' && path === '/sales-order') {
      const client = getClient(env);
      if (!client) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const body = await request.json() as Record<string, unknown>;
      const parsed = erpnextSalesOrderSchema.safeParse(body);
      if (!parsed.success) {
        return json({ success: false, error: parsed.error.issues[0].message }, 400);
      }
      const data = parsed.data;

      const orderItems = data.items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name || item.item_code,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount || item.qty * item.rate
      }));

      const salesOrder = {
        customer_name: data.customer_name || 'Walk-in Customer',
        contact_mobile: data.customer_phone || '',
        items: orderItems,
        custom_table_id: data.table_id || null,
        custom_notes: data.notes || '',
        company: 'AURA F&B',
        currency: 'VND',
        selling_price_list: 'Standard Selling'
      };

      const result = await client.create('Sales Order', salesOrder as unknown as Record<string, unknown>);
      return json({ success: true, data: result.data }, 201);
    }

    // GET /api/erpnext-pos/products/:code/availability
    if (method === 'GET' && path.startsWith('/products/') && path.endsWith('/availability')) {
      const itemCode = path.replace('/products/', '').replace('/availability', '');
      const productClient = createErpnextProductClient(env as unknown as ProductEnv);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const availability = await productClient.getProductAvailability(itemCode, tenantId);
      return json({ success: true, data: availability });
    }

    // GET /api/erpnext-pos/products/changed — delta sync
    if (method === 'GET' && path === '/products/changed') {
      const productClient = createErpnextProductClient(env as unknown as ProductEnv);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const since = url.searchParams.get('since') || new Date(Date.now() - 3600000).toISOString();
      const changed = await productClient.searchChangedProducts(since);
      return json({ success: true, data: changed });
    }

    // POST /api/erpnext-pos/products/sync — batch sync to local DB
    if (method === 'POST' && path === '/products/sync') {
      const productClient = createErpnextProductClient(env as unknown as ProductEnv);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const body = await request.json().catch(() => null);
      const parsed = erpnextProductsBatchSyncSchema.safeParse(body);
      if (!parsed.success) {
        return json({ success: false, error: parsed.error.issues[0].message }, 400);
      }
      const result = await productClient.syncProductsToLocal(env as unknown as ProductEnv, parsed.data.products);
      return json({ success: true, data: result });
    }

    // POST /api/erpnext-pos/webhook — receive ERPNext webhooks
    if (method === 'POST' && path === '/webhook') {
      const webhookSecret = env.ERPNEXT_WEBHOOK_SECRET?.trim() || '';
      const isProd = env.ENVIRONMENT === 'production';
      if (isProd && !webhookSecret) {
        return json({ success: false, error: 'ERPNext webhook secret not configured' }, 503);
      }
      if (webhookSecret) {
        const providedSecret = (
          request.headers.get('x-erpnext-webhook-secret') ||
          request.headers.get('x-frappe-webhook-signature') ||
          ''
        ).trim();
        if (!providedSecret || !constantTimeEqual(providedSecret, webhookSecret)) {
          return json({ success: false, error: 'Invalid webhook secret' }, 401);
        }
      }

      const body = await request.json() as Record<string, unknown>;
      const parsed = erpnextPosWebhookSchema.safeParse(body);
      if (!parsed.success) {
        return json({ success: false, error: parsed.error.issues[0].message }, 400);
      }
      if (env.AURA_DB) {
        await env.AURA_DB.prepare(
          'INSERT INTO erpnext_webhook_log (doctype, docname, action, payload, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          body.doctype || '', body.docname || '', body.action || '',
          JSON.stringify(body), new Date().toISOString()
        ).run();
      }
      return json({ success: true, message: 'Webhook received' });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }
}
