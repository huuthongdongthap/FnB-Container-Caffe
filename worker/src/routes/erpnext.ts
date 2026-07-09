/**
 * ERPNext CRM Routes — /api/erpnext
 * CRM lead creation, customer notes, tags.
 */

import { createErpnextCrmClientWithKv, CrmCustomerData, CrmUpdateData } from '../clients/erpnext-crm-client';
import { ErpnextClient } from '../clients/erpnext-client';
import { verifyJWT, getAuthToken } from '../lib/jwt';
import { erpnextConfigureSchema, erpnextLeadSchema, erpnextTagSchema } from '../lib/validators';

interface Env {
  AURA_DB?: D1Database;
  AUTH_KV?: import('@cloudflare/workers-types').KVNamespace;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
  JWT_SECRET?: string;
}

export async function handleErpnextRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/erpnext', '');
  const method = request.method;

  try {
    // GET /api/erpnext/configure — return current config status
    if (method === 'GET' && path === '/configure') {
      let cfgUrl = env.ERPNEXT_URL;
      let apiKey = env.ERPNEXT_API_KEY;
      if (env.AUTH_KV) {
        const kvUrl = await env.AUTH_KV.get('erpnext:api_url');
        const kvKey = await env.AUTH_KV.get('erpnext:api_key');
        if (kvUrl) {
          cfgUrl = kvUrl;
        }
        if (kvKey) {
          apiKey = kvKey;
        }
      }
      return new Response(JSON.stringify({
        success: true,
        configured: !!(cfgUrl && apiKey),
        url: cfgUrl ? cfgUrl.replace(/./g, (c, i) => i > 8 && i < cfgUrl.indexOf('/', 8) ? '*' : c) : null,
        key_set: !!apiKey,
        secret_set: !!apiKey,
        source: env.AUTH_KV ? 'kv' : 'env'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/erpnext/configure — save credentials to KV
    if (method === 'POST' && path === '/configure') {
      const token = getAuthToken(request);
      if (!token || !env.JWT_SECRET) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json' }
        });
      }
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (!payload || !['owner', 'staff'].includes(payload.role)) {
        return new Response(JSON.stringify({ success: false, error: 'Không đủ quyền truy cập' }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!env.AUTH_KV) {
        return new Response(JSON.stringify({ success: false, error: 'KV namespace not configured' }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }
      const confParsed = erpnextConfigureSchema.safeParse(await request.json());
      if (!confParsed.success) {
        return new Response(JSON.stringify({ success: false, error: confParsed.error.issues[0].message }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await env.AUTH_KV.put('erpnext:api_url', confParsed.data.url);
      await env.AUTH_KV.put('erpnext:api_key', confParsed.data.api_key);
      await env.AUTH_KV.put('erpnext:api_secret', confParsed.data.api_secret);
      try {
        const testClient = new ErpnextClient({
          url: confParsed.data.url,
          apiKey: confParsed.data.api_key,
          apiSecret: confParsed.data.api_secret
        });
        await testClient.list('Customer', { limit: 1 });
        return new Response(JSON.stringify({
          success: true,
          message: 'ERPNext configured and connection verified',
          connection_ok: true
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({
          success: true,
          message: 'ERPNext configured but connection test failed — check credentials',
          connection_ok: false
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // DELETE /api/erpnext/configure — clear credentials from KV
    if (method === 'DELETE' && path === '/configure') {
      if (env.AUTH_KV) {
        await env.AUTH_KV.delete('erpnext:api_url');
        await env.AUTH_KV.delete('erpnext:api_key');
        await env.AUTH_KV.delete('erpnext:api_secret');
      }
      return new Response(JSON.stringify({ success: true, message: 'ERPNext credentials cleared' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // All other routes need ERPNext configured
    const client = await createErpnextCrmClientWithKv(env);
    if (!client) {
      return new Response(JSON.stringify({ success: false, error: 'ERPNext not configured' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/erpnext/lead — create lead from customer
    if (method === 'POST' && path === '/lead') {
      const leadParsed = erpnextLeadSchema.safeParse(await request.json());
      if (!leadParsed.success) {
        return new Response(JSON.stringify({ success: false, error: leadParsed.error.issues[0].message }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      const body = leadParsed.data;
      const result = await client.createLead(body);
      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 201, headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /api/erpnext/customer/:id — get customer info
    if (method === 'GET' && path.startsWith('/customer/')) {
      const customerId = path.replace('/customer/', '');
      const info = await client.getCustomerInfo(customerId);
      return new Response(JSON.stringify({ success: true, data: info }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/erpnext/customer/:id/tag — add tag
    if (method === 'POST' && path.endsWith('/tag')) {
      const customerId = path.replace('/customer/', '').replace('/tag', '');
      const tagParsed = erpnextTagSchema.safeParse(await request.json());
      if (!tagParsed.success) {
        return new Response(JSON.stringify({ success: false, error: tagParsed.error.issues[0].message }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await client.addTag(customerId, tagParsed.data.tag);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/erpnext/customer/:id/tag — remove tag
    if (method === 'DELETE' && path.endsWith('/tag')) {
      const customerId = path.replace('/customer/', '').replace('/tag', '');
      const tagParsed = erpnextTagSchema.safeParse(await request.json());
      if (!tagParsed.success) {
        return new Response(JSON.stringify({ success: false, error: tagParsed.error.issues[0].message }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await client.removeTag(customerId, tagParsed.data.tag);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /api/erpnext/customer/:id — update customer
    if (method === 'PUT' && path.startsWith('/customer/')) {
      const customerId = path.replace('/customer/', '');
      const putParsed = erpnextConfigureSchema.safeParse(await request.json());
      if (!putParsed.success) {
        return new Response(JSON.stringify({ success: false, error: putParsed.error.issues[0].message }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await client.updateCustomer(customerId, putParsed.data as CrmUpdateData);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
