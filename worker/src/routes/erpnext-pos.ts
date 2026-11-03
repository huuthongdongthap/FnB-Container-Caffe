/**
 * ERPNext POS Routes — /api/erpnext-pos
 * Sales order creation, product availability, webhooks.
 */

import { createErpnextClient, createErpnextClientWithKv, ErpnextClient } from '../clients/erpnext-client';
import {
  createErpnextProductClient,
  createErpnextProductClientWithKv,
  type ProductEnv,
} from '../clients/erpnext-product-client';
import { erpnextSalesOrderSchema, erpnextPosWebhookSchema, erpnextProductsBatchSyncSchema } from '../lib/validators';

interface PosEnv {
  AURA_DB?: D1Database;
  AURA_KV?: KVNamespace;
  AUTH_KV?: KVNamespace;
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

async function getClient(env: PosEnv, tenantId?: string): Promise<ErpnextClient | null> {
  if (env.AUTH_KV && typeof createErpnextClientWithKv === 'function') {
    const kvClient = await createErpnextClientWithKv(
      env as unknown as Parameters<typeof createErpnextClientWithKv>[0],
      tenantId
    );
    if (kvClient) return kvClient;
  }
  return createErpnextClient(env);
}

const PRODUCT_SYNC_ALLOWED_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor']);

function extractRequestRole(request: Request): { hasAuthHeader: boolean; role: string | null } {
  const roleHeader = (request.headers.get('x-user-role') || '').trim().toLowerCase();
  if (roleHeader) {
    return { hasAuthHeader: true, role: roleHeader };
  }
  const authHeader = (request.headers.get('Authorization') || request.headers.get('authorization') || '').trim();
  let token = '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookieHeader = request.headers.get('Cookie') || request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match?.[1]) {
      token = decodeURIComponent(match[1].trim());
    }
  }
  if (!token) {
    return { hasAuthHeader: false, role: null };
  }
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return { hasAuthHeader: true, role: null };
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : null;
    return { hasAuthHeader: true, role };
  } catch {
    return { hasAuthHeader: true, role: null };
  }
}

async function getProductClient(env: PosEnv, tenantId?: string) {
  if (env.AUTH_KV && typeof createErpnextProductClientWithKv === 'function') {
    const kvProductClient = await createErpnextProductClientWithKv(
      env as unknown as Parameters<typeof createErpnextProductClientWithKv>[0],
      tenantId
    );
    if (kvProductClient) return kvProductClient;
  }
  return createErpnextProductClient(env as unknown as ProductEnv);
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
      const client = await getClient(env, tenantId);
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
      const productClient = await getProductClient(env, tenantId);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const availability = await productClient.getProductAvailability(itemCode, tenantId);
      return json({ success: true, data: availability });
    }

    // GET /api/erpnext-pos/products/changed — delta sync
    if (method === 'GET' && path === '/products/changed') {
      const productClient = await getProductClient(env, tenantId);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const since = url.searchParams.get('since') || new Date(Date.now() - 3600000).toISOString();
      const changed = await productClient.searchChangedProducts(since);
      return json({ success: true, data: changed });
    }

    // POST /api/erpnext-pos/products/sync — batch sync to local DB
    if (method === 'POST' && path === '/products/sync') {
      const { hasAuthHeader, role } = extractRequestRole(request);
      if (hasAuthHeader) {
        if (!role || !PRODUCT_SYNC_ALLOWED_ROLES.has(role)) {
          return json({ success: false, error: 'Forbidden' }, 403);
        }
      } else if ((env as Record<string, unknown>).JWT_SECRET) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }

      const productClient = await getProductClient(env, tenantId);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const body = await request.json().catch(() => null);
      const parsed = erpnextProductsBatchSyncSchema.safeParse(body);
      if (!parsed.success) {
        return json({ success: false, error: parsed.error.issues[0].message }, 400);
      }
      const writeTenant = !tenantId || tenantId === '*' ? 'default' : tenantId;
      const result = await productClient.syncProductsToLocal(
        env as unknown as ProductEnv,
        parsed.data.products,
        writeTenant
      );
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
        const now = new Date().toISOString();
        const writeTenant = !tenantId || tenantId === '*' ? 'default' : tenantId;
        const payloadStr = JSON.stringify(writeTenant !== 'default' ? { ...body, tenant_id: writeTenant } : body);
        try {
          await env.AURA_DB.prepare(
            'INSERT INTO erpnext_webhook_log (doctype, docname, action, payload, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            body.doctype || '', body.docname || '', body.action || '',
            payloadStr, writeTenant, now
          ).run();
        } catch {
          await env.AURA_DB.prepare(
            'INSERT INTO erpnext_webhook_log (doctype, docname, action, payload, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            body.doctype || '', body.docname || '', body.action || '',
            payloadStr, now
          ).run();
        }
      }
      return json({ success: true, message: 'Webhook received' });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }
}
