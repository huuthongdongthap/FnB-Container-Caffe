/**
 * ERPNext POS Routes — /api/erpnext-pos
 * Sales order creation, product availability, webhooks.
 */

import { createErpnextClient, ErpnextClient } from '../clients/erpnext-client';
import { createErpnextProductClient } from '../clients/erpnext-product-client';

interface PosEnv {
  AURA_DB?: D1Database;
  AURA_KV?: KVNamespace;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
}

interface SalesOrderInput {
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

export async function handleErpnextPosRequest(request: Request, env: PosEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/erpnext-pos', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    // POST /api/erpnext-pos/sales-order — create sales order
    if (method === 'POST' && path === '/sales-order') {
      const client = getClient(env);
      if (!client) return json({ success: false, error: 'ERPNext not configured' }, 503);

      const body = await request.json() as SalesOrderInput;

      if (!body.items || body.items.length === 0) {
        return json({ success: false, error: 'items required' }, 400);
      }

      const orderItems = body.items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name || item.item_code,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount || item.qty * item.rate,
      }));

      const salesOrder = {
        customer_name: body.customer_name || 'Walk-in Customer',
        contact_mobile: body.customer_phone || '',
        items: orderItems,
        custom_table_id: body.table_id || null,
        custom_notes: body.notes || '',
        company: 'AURA F&B',
        currency: 'VND',
        selling_price_list: 'Standard Selling',
      };

      const result = await client.create('Sales Order', salesOrder as unknown as Record<string, unknown>);
      return json({ success: true, data: result.data }, 201);
    }

    // GET /api/erpnext-pos/products/:code/availability
    if (method === 'GET' && path.startsWith('/products/') && path.endsWith('/availability')) {
      const itemCode = path.replace('/products/', '').replace('/availability', '');
      const productClient = createErpnextProductClient(env as any);
      if (!productClient) return json({ success: false, error: 'ERPNext not configured' }, 503);

      const availability = await productClient.getProductAvailability(itemCode);
      return json({ success: true, data: availability });
    }

    // GET /api/erpnext-pos/products/changed — delta sync
    if (method === 'GET' && path === '/products/changed') {
      const productClient = createErpnextProductClient(env as any);
      if (!productClient) return json({ success: false, error: 'ERPNext not configured' }, 503);

      const since = url.searchParams.get('since') || new Date(Date.now() - 3600000).toISOString();
      const changed = await productClient.searchChangedProducts(since);
      return json({ success: true, data: changed });
    }

    // POST /api/erpnext-pos/products/sync — batch sync to local DB
    if (method === 'POST' && path === '/products/sync') {
      const productClient = createErpnextProductClient(env as any);
      if (!productClient) return json({ success: false, error: 'ERPNext not configured' }, 503);

      const body = await request.json() as { products: Array<{ name: string; item_code: string; item_name: string; modified: string | null }> };
      const result = await productClient.syncProductsToLocal(env as any, body.products);
      return json({ success: true, data: result });
    }

    // POST /api/erpnext-pos/webhook — receive ERPNext webhooks
    if (method === 'POST' && path === '/webhook') {
      const body = await request.json() as Record<string, unknown>;
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
