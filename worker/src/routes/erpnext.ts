/**
 * ERPNext CRM Routes — /api/erpnext
 * CRM lead creation, customer notes, tags.
 */

import { createErpnextCrmClientWithKv, CrmUpdateData } from '../clients/erpnext-crm-client';
import { ErpnextClient } from '../clients/erpnext-client';
import { verifyJWT, getAuthToken } from '../lib/jwt';
import { erpnextConfigureSchema, erpnextLeadSchema, erpnextTagSchema, customerUpdateSchema, zodErrorResponseRaw } from '../lib/validators';

interface Env {
	AURA_DB?: D1Database;
	AUTH_KV?: import('@cloudflare/workers-types').KVNamespace;
	ERPNEXT_URL?: string;
	ERPNEXT_API_KEY?: string;
	ERPNEXT_API_SECRET?: string;
	JWT_SECRET?: string;
}

const ERPNEXT_CONFIG_ADMIN_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const jsonResp = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

function erpnextKvKeys(tenantId: string): { url: string; key: string; secret: string } {
	const effective = tenantId && tenantId !== '*' ? tenantId : 'default';
	if (effective === 'default') {
		return { url: 'erpnext:api_url', key: 'erpnext:api_key', secret: 'erpnext:api_secret' };
	}
	return { url: `erpnext:${effective}:api_url`, key: `erpnext:${effective}:api_key`, secret: `erpnext:${effective}:api_secret` };
}

async function verifyErpnextAdminRole(
	request: Request,
	env: Env,
	resolvedTenantId?: string,
): Promise<{ ok: true; tenantId: string } | { ok: false; response: Response }> {
	const token = getAuthToken(request);
	if (!token || !env.JWT_SECRET) {
		return { ok: false, response: jsonResp({ success: false, error: 'Unauthorized' }, 401) };
	}
	const revoked = typeof env.AUTH_KV?.get === 'function' ? await env.AUTH_KV.get(`revoked:${token}`) : null;
	if (revoked) {
		return { ok: false, response: jsonResp({ success: false, error: 'Token đã bị thu hồi' }, 401) };
	}
	const payload = await verifyJWT(token, env.JWT_SECRET);
	if (!payload || !ERPNEXT_CONFIG_ADMIN_ROLES.includes(payload.role)) {
		return { ok: false, response: jsonResp({ success: false, error: 'Không đủ quyền truy cập' }, 403) };
	}
	const claimTenant = (payload as unknown as { tenant_id?: string; tenantId?: string }).tenant_id
		|| (payload as unknown as { tenantId?: string }).tenantId
		|| 'default';
	const effectiveTenant = resolvedTenantId && resolvedTenantId !== '*' ? resolvedTenantId : (claimTenant === '*' ? 'default' : claimTenant);
	return { ok: true, tenantId: effectiveTenant };
}

export async function handleErpnextRequest(request: Request, env: Env, resolvedTenantId?: string): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname.replace('/api/erpnext', '');
	const method = request.method;
	const activeTenant = resolvedTenantId && resolvedTenantId !== '*' ? resolvedTenantId : 'default';

	try {
		if (method === 'GET' && path === '/configure') {
			const keys = erpnextKvKeys(activeTenant);
			let cfgUrl = activeTenant === 'default' ? env.ERPNEXT_URL : undefined;
			let apiKey = activeTenant === 'default' ? env.ERPNEXT_API_KEY : undefined;
			if (env.AUTH_KV) {
				const kvUrl = await env.AUTH_KV.get(keys.url);
				const kvKey = await env.AUTH_KV.get(keys.key);
				if (kvUrl) cfgUrl = kvUrl;
				if (kvKey) apiKey = kvKey;
			}
			return jsonResp({
				success: true,
				configured: !!(cfgUrl && apiKey),
				url: cfgUrl ? cfgUrl.replace(/./g, (c, i) => {
					const slashIdx = cfgUrl.indexOf('/', 8);
					const end = slashIdx !== -1 ? slashIdx : cfgUrl.length;
					return i > 8 && i < end ? '*' : c;
				}) : null,
				key_set: !!apiKey,
				secret_set: !!apiKey,
				source: env.AUTH_KV ? 'kv' : 'env'
			});
		}

		if (method === 'POST' && path === '/configure') {
			const authCheck = await verifyErpnextAdminRole(request, env, resolvedTenantId);
			if (!authCheck.ok) return authCheck.response;
			if (!env.AUTH_KV) return jsonResp({ success: false, error: 'KV namespace not configured' }, 500);
			const confParsed = erpnextConfigureSchema.safeParse(await request.json());
			if (!confParsed.success) return zodErrorResponseRaw(confParsed.error);
			const keys = erpnextKvKeys(authCheck.tenantId);
			await env.AUTH_KV.put(keys.url, confParsed.data.url);
			await env.AUTH_KV.put(keys.key, confParsed.data.api_key);
			await env.AUTH_KV.put(keys.secret, confParsed.data.api_secret);
			try {
				const testClient = new ErpnextClient({ url: confParsed.data.url, apiKey: confParsed.data.api_key, apiSecret: confParsed.data.api_secret });
				await testClient.list('Customer', { limit: 1 });
				return jsonResp({ success: true, message: 'ERPNext configured and connection verified', connection_ok: true });
			} catch {
				return jsonResp({ success: true, message: 'ERPNext configured but connection test failed — check credentials', connection_ok: false });
			}
		}

		if (method === 'DELETE' && path === '/configure') {
			const authCheck = await verifyErpnextAdminRole(request, env, resolvedTenantId);
			if (!authCheck.ok) return authCheck.response;
			if (env.AUTH_KV) {
				const keys = erpnextKvKeys(authCheck.tenantId);
				await env.AUTH_KV.delete(keys.url);
				await env.AUTH_KV.delete(keys.key);
				await env.AUTH_KV.delete(keys.secret);
			}
			return jsonResp({ success: true, message: 'ERPNext credentials cleared' });
		}

		const client = await createErpnextCrmClientWithKv(env);
		if (!client) return jsonResp({ success: false, error: 'ERPNext not configured' }, 503);

		if (method === 'POST' && path === '/lead') {
			const leadParsed = erpnextLeadSchema.safeParse(await request.json());
			if (!leadParsed.success) return zodErrorResponseRaw(leadParsed.error);
			const result = await client.createLead(leadParsed.data);
			return jsonResp({ success: true, data: result }, 201);
		}

		if (method === 'GET' && path.startsWith('/customer/')) {
			const info = await client.getCustomerInfo(path.replace('/customer/', ''));
			return jsonResp({ success: true, data: info });
		}

		if (method === 'POST' && path.endsWith('/tag')) {
			const customerId = path.replace('/customer/', '').replace('/tag', '');
			const tagParsed = erpnextTagSchema.safeParse(await request.json());
			if (!tagParsed.success) return zodErrorResponseRaw(tagParsed.error);
			await client.addTag(customerId, tagParsed.data.tag);
			return jsonResp({ success: true });
		}

		if (method === 'DELETE' && path.endsWith('/tag')) {
			const customerId = path.replace('/customer/', '').replace('/tag', '');
			const tagParsed = erpnextTagSchema.safeParse(await request.json());
			if (!tagParsed.success) return zodErrorResponseRaw(tagParsed.error);
			await client.removeTag(customerId, tagParsed.data.tag);
			return jsonResp({ success: true });
		}

		if (method === 'PUT' && path.startsWith('/customer/')) {
			const customerId = path.replace('/customer/', '');
			const putParsed = customerUpdateSchema.safeParse(await request.json());
			if (!putParsed.success) return zodErrorResponseRaw(putParsed.error);
			await client.updateCustomer(customerId, putParsed.data as CrmUpdateData);
			return jsonResp({ success: true });
		}

		return jsonResp({ success: false, error: 'Not found' }, 404);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return jsonResp({ success: false, error: msg }, 500);
	}
}
