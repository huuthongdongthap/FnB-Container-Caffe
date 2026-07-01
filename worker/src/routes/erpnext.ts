/**
 * ERPNext CRM Routes — /api/erpnext
 * CRM lead creation, customer notes, tags.
 */

import { createErpnextCrmClient, CrmCustomerData, CrmUpdateData } from '../clients/erpnext-crm-client';

interface Env {
  AURA_DB?: D1Database;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
  JWT_SECRET?: string;
}

export async function handleErpnextRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/erpnext', '');
  const method = request.method;

  const client = createErpnextCrmClient(env);
  if (!client) {
    return new Response(JSON.stringify({ success: false, error: 'ERPNext not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // POST /api/erpnext/lead — create lead from customer
    if (method === 'POST' && path === '/lead') {
      const body = await request.json() as CrmCustomerData;
      const result = await client.createLead(body);
      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /api/erpnext/customer/:id — get customer info
    if (method === 'GET' && path.startsWith('/customer/')) {
      const customerId = path.replace('/customer/', '');
      const info = await client.getCustomerInfo(customerId);
      return new Response(JSON.stringify({ success: true, data: info }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /api/erpnext/customer/:id/tag — add tag
    if (method === 'POST' && path.endsWith('/tag')) {
      const customerId = path.replace('/customer/', '').replace('/tag', '');
      const body = await request.json() as { tag: string };
      await client.addTag(customerId, body.tag);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // DELETE /api/erpnext/customer/:id/tag — remove tag
    if (method === 'DELETE' && path.endsWith('/tag')) {
      const customerId = path.replace('/customer/', '').replace('/tag', '');
      const body = await request.json() as { tag: string };
      await client.removeTag(customerId, body.tag);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PUT /api/erpnext/customer/:id — update customer
    if (method === 'PUT' && path.startsWith('/customer/')) {
      const customerId = path.replace('/customer/', '');
      const body = await request.json();
      await client.updateCustomer(customerId, body as CrmUpdateData);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
