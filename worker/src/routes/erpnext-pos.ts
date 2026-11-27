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
import { cookieWriteBlockReason, getAuthToken, verifyJWT } from '../lib/jwt';
import { StaffSessionError, validateStaffSession, type StaffSession } from '../lib/staff-session';
import { isHQSuperAdmin, resolvePilotStore } from '../middleware/tenant';
import { erpnextSalesOrderSchema, erpnextPosWebhookSchema, erpnextProductsBatchSyncSchema } from '../lib/validators';

interface PosEnv {
  AURA_DB?: D1Database;
  DB?: D1Database;
  AURA_KV?: KVNamespace;
  AUTH_KV?: KVNamespace;
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
  ERPNEXT_WEBHOOK_SECRET?: string;
  ERPNEXT_WEBHOOK_TENANT?: string;
  PILOT_TENANT_ID?: string;
  ALLOW_UNSIGNED_WEBHOOKS?: string;
  ALLOW_UNSIGNED_ERPNEXT_WEBHOOK?: string;
  ERPNEXT_MOCK?: string;
  JWT_SECRET?: string;
  STAFF_JWT_SECRET?: string;
  STAFF_SESSION_SECRET?: string;
  ENVIRONMENT?: string;
  NODE_ENV?: string;
}

async function computeWebhookHmacSha256(body: string, secret: string): Promise<{ hex: string; base64: string }> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const bytes = new Uint8Array(sigBuf);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return { hex, base64: btoa(binary) };
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
  const isNonDefaultTenant = Boolean(tenantId && tenantId !== 'default' && tenantId !== '*');
  if (env.AUTH_KV && typeof createErpnextClientWithKv === 'function') {
    const envForKv = isNonDefaultTenant
      ? { ...env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
      : env;
    const kvClient = await createErpnextClientWithKv(
      envForKv as unknown as Parameters<typeof createErpnextClientWithKv>[0],
      tenantId
    );
    if (kvClient) return kvClient;
    if (isNonDefaultTenant) return null;
  }
  return createErpnextClient(env);
}

const PRODUCT_SYNC_ALLOWED_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor']);

interface ExtractedRequestAuth {
  hasAuthHeader: boolean;
  hasSpoofedRoleHeader: boolean;
  verified: boolean;
  role: string | null;
  tenantId: string | null;
  isHqAdmin: boolean;
  errorStatus?: 401 | 403 | 503;
  errorMessage?: string;
}

async function extractRequestRole(
  request: Request,
  env: PosEnv,
): Promise<ExtractedRequestAuth> {
  const hasSpoofedRoleHeader = Boolean((request.headers.get('x-user-role') || '').trim());
  const csrfBlockReason = cookieWriteBlockReason(request.method, request);
  if (csrfBlockReason) {
    return {
      hasAuthHeader: true,
      hasSpoofedRoleHeader,
      verified: false,
      role: null,
      tenantId: null,
      isHqAdmin: false,
      errorStatus: 403,
      errorMessage: csrfBlockReason,
    };
  }
  const authHeader = (request.headers.get('Authorization') || request.headers.get('authorization') || '').trim();
  let token = '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = getAuthToken(request) || '';
    if (!token) {
      const cookieHeader = request.headers.get('Cookie') || request.headers.get('cookie') || '';
      const match = cookieHeader.match(/(?:^|;\s*)(?:aura_staff_token|aura_access_token|access_token|token)=([^;]+)/);
      if (match?.[1]) {
        token = decodeURIComponent(match[1].trim());
      }
    }
  }
  if (!token) {
    return {
      hasAuthHeader: false,
      hasSpoofedRoleHeader,
      verified: false,
      role: null,
      tenantId: null,
      isHqAdmin: false,
    };
  }
  const secrets = [env.STAFF_JWT_SECRET, env.STAFF_SESSION_SECRET, env.JWT_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );
  for (const secret of secrets) {
    try {
      const payload = await verifyJWT(token, secret);
      if (payload) {
        const authKv = env.AUTH_KV ?? env.AURA_KV;
        if (authKv && typeof authKv.get === 'function') {
          try {
            const revoked = await authKv.get(`revoked:${token}`);
            if (revoked) {
              return {
                hasAuthHeader: true,
                hasSpoofedRoleHeader,
                verified: false,
                role: null,
                tenantId: null,
                isHqAdmin: false,
                errorStatus: 401,
                errorMessage: 'Session revoked',
              };
            }
          } catch {
            return {
              hasAuthHeader: true,
              hasSpoofedRoleHeader,
              verified: false,
              role: null,
              tenantId: null,
              isHqAdmin: false,
              errorStatus: 503,
              errorMessage: 'Auth state unavailable',
            };
          }
        }
        const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : null;
        const rawJwtTenant =
          (payload as { tenantId?: string; tenant_id?: string }).tenantId ??
          (payload as { tenantId?: string; tenant_id?: string }).tenant_id;
        const jwtTenant =
          typeof rawJwtTenant === 'string' && rawJwtTenant.trim() ? rawJwtTenant.trim() : 'default';
        const staffId = String(payload.id || (payload as { sub?: string }).sub || '').trim();
        const db = env.AURA_DB ?? env.DB;
        if (db && typeof db.prepare === 'function' && staffId) {
          const probeStmt = db.prepare('SELECT id FROM users WHERE id = ?');
          const boundProbe = probeStmt && typeof probeStmt.bind === 'function' ? probeStmt.bind(staffId) : null;
          const hasFirst = Boolean(boundProbe && typeof boundProbe.first === 'function');
          if (hasFirst) {
            const hasFullSessionClaims =
              Boolean((payload as { sessionType?: string }).sessionType) ||
              (payload as { authVersion?: number }).authVersion !== undefined;
            if (hasFullSessionClaims) {
              try {
                const claims: Partial<StaffSession> = {
                  ...(payload as unknown as Partial<StaffSession>),
                  id: staffId,
                  tenantId: jwtTenant,
                };
                await validateStaffSession(db, claims);
              } catch (err) {
                const status = err instanceof StaffSessionError ? err.status : 401;
                const message = err instanceof Error ? err.message : 'Invalid staff session';
                return {
                  hasAuthHeader: true,
                  hasSpoofedRoleHeader,
                  verified: false,
                  role: null,
                  tenantId: null,
                  isHqAdmin: false,
                  errorStatus: status,
                  errorMessage: message,
                };
              }
            } else {
              const userRow = await db
                .prepare('SELECT id, role, tenant_id, is_active, auth_version FROM users WHERE id = ?')
                .bind(staffId)
                .first<{ id: string; role?: string; tenant_id?: string | null; is_active?: number; auth_version?: number }>()
                .catch(() => null);
              if (userRow) {
                if (userRow.is_active === 0) {
                  return {
                    hasAuthHeader: true,
                    hasSpoofedRoleHeader,
                    verified: false,
                    role: null,
                    tenantId: null,
                    isHqAdmin: false,
                    errorStatus: 403,
                    errorMessage: 'Staff account inactive',
                  };
                }
                if (Number(userRow.auth_version || 1) > 1) {
                  return {
                    hasAuthHeader: true,
                    hasSpoofedRoleHeader,
                    verified: false,
                    role: null,
                    tenantId: null,
                    isHqAdmin: false,
                    errorStatus: 401,
                    errorMessage: 'Session revoked',
                  };
                }
              }
            }
          }
        }
        const isHqAdmin = isHQSuperAdmin({
          role: role ?? undefined,
          tenantId: jwtTenant,
          tenant_id: jwtTenant,
        });
        return {
          hasAuthHeader: true,
          hasSpoofedRoleHeader,
          verified: true,
          role,
          tenantId: jwtTenant,
          isHqAdmin,
        };
      }
    } catch {
      // Try next configured secret
    }
  }
  return {
    hasAuthHeader: true,
    hasSpoofedRoleHeader,
    verified: false,
    role: null,
    tenantId: null,
    isHqAdmin: false,
  };
}

async function getProductClient(env: PosEnv, tenantId?: string) {
  const isNonDefaultTenant = Boolean(tenantId && tenantId !== 'default' && tenantId !== '*');
  if (env.AUTH_KV && typeof createErpnextProductClientWithKv === 'function') {
    const envForKv = isNonDefaultTenant
      ? { ...env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
      : env;
    const kvProductClient = await createErpnextProductClientWithKv(
      envForKv as unknown as Parameters<typeof createErpnextProductClientWithKv>[0],
      tenantId
    );
    if (kvProductClient) return kvProductClient;
    if (isNonDefaultTenant) return null;
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
      const hasJwtSecret = Boolean(
        (typeof env.STAFF_JWT_SECRET === 'string' && env.STAFF_JWT_SECRET.trim()) ||
        (typeof env.STAFF_SESSION_SECRET === 'string' && env.STAFF_SESSION_SECRET.trim()) ||
        (typeof env.JWT_SECRET === 'string' && env.JWT_SECRET.trim())
      );
      const authResult = await extractRequestRole(request, env);
      const { hasAuthHeader, hasSpoofedRoleHeader, verified, role } = authResult;
      if (authResult.errorStatus) {
        return json({ success: false, error: authResult.errorMessage || 'Unauthorized' }, authResult.errorStatus);
      }
      if (hasAuthHeader || hasSpoofedRoleHeader) {
        if (!verified) {
          return hasJwtSecret
            ? json({ success: false, error: 'Unauthorized' }, 401)
            : json({ success: false, error: 'Forbidden' }, 403);
        }
        if (!role || !PRODUCT_SYNC_ALLOWED_ROLES.has(role)) {
          return json({ success: false, error: 'Forbidden' }, 403);
        }
      } else if (hasJwtSecret) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }

      const syncTenant = verified && authResult.tenantId
        ? (authResult.isHqAdmin
            ? (resolvedTenantId && resolvedTenantId !== '*' && resolvedTenantId.toLowerCase() !== 'hq'
                ? resolvedTenantId
                : (rawTenantHeader && rawTenantHeader !== '*' && rawTenantHeader.toLowerCase() !== 'hq'
                    ? rawTenantHeader
                    : 'default'))
            : (authResult.tenantId === '*' || authResult.tenantId.toLowerCase() === 'hq'
                ? 'default'
                : authResult.tenantId))
        : tenantId;

      const earlyClient = !env.AUTH_KV ? await getProductClient(env, syncTenant) : undefined;
      if (!env.AUTH_KV && !earlyClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }

      const body = await request.json().catch(() => null);
      const parsed = erpnextProductsBatchSyncSchema.safeParse(body);
      if (!parsed.success) {
        return json({ success: false, error: parsed.error.issues[0].message }, 400);
      }

      const productClient = earlyClient ?? await getProductClient(env, syncTenant);
      if (!productClient) {
        return json({ success: false, error: 'ERPNext not configured' }, 503);
      }
      const writeTenant = !syncTenant || syncTenant === '*' ? 'default' : syncTenant;
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
      const envName = String(env.ENVIRONMENT || env.NODE_ENV || '').trim().toLowerCase();
      const allowUnsignedDev =
        (envName === 'development' || envName === 'test') &&
        (String(env.ALLOW_UNSIGNED_WEBHOOKS || '').trim().toLowerCase() === 'true' ||
          String(env.ALLOW_UNSIGNED_ERPNEXT_WEBHOOK || '').trim().toLowerCase() === 'true');
      if (!webhookSecret && !allowUnsignedDev) {
        return json({ success: false, error: 'ERPNext webhook secret not configured' }, 503);
      }

      const rawBody = await request.text();
      if (webhookSecret) {
        const frappeSignature = (request.headers.get('x-frappe-webhook-signature') || '').trim();
        const secretHeader = (request.headers.get('x-erpnext-webhook-secret') || '').trim();
        const { hex: expectedHex, base64: expectedBase64 } = await computeWebhookHmacSha256(rawBody, webhookSecret);
        let signatureValid = false;
        if (frappeSignature) {
          const normalizedSig = frappeSignature.replace(/^sha256=/i, '').trim();
          signatureValid =
            Boolean(normalizedSig) &&
            (constantTimeEqual(normalizedSig.toLowerCase(), expectedHex) ||
              constantTimeEqual(normalizedSig, expectedBase64));
        } else if (secretHeader) {
          const normalizedSecretHeader = secretHeader.replace(/^sha256=/i, '').trim();
          signatureValid =
            Boolean(normalizedSecretHeader) &&
            (constantTimeEqual(normalizedSecretHeader.toLowerCase(), expectedHex) ||
              constantTimeEqual(normalizedSecretHeader, expectedBase64));
        }
        if (!signatureValid) {
          return json({ success: false, error: 'Invalid webhook secret' }, 401);
        }
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return json({ success: false, error: 'Invalid JSON payload' }, 400);
      }
      const parsed = erpnextPosWebhookSchema.safeParse(body);
      if (!parsed.success) {
        return json({ success: false, error: parsed.error.issues[0].message }, 400);
      }
      const configuredWebhookTenantRaw = (
        (typeof env.ERPNEXT_WEBHOOK_TENANT === 'string' ? env.ERPNEXT_WEBHOOK_TENANT.trim() : '') ||
        (resolvedTenantId && resolvedTenantId.trim() && resolvedTenantId.trim() !== '*' && resolvedTenantId.trim().toLowerCase() !== 'hq'
          ? resolvedTenantId.trim()
          : '') ||
        resolvePilotStore(env as unknown as Record<string, unknown>) ||
        'default'
      ).trim();
      const writeTenant =
        !configuredWebhookTenantRaw || configuredWebhookTenantRaw === '*' || configuredWebhookTenantRaw.toLowerCase() === 'hq'
          ? 'default'
          : configuredWebhookTenantRaw;
      const db = env.AURA_DB ?? env.DB;
      if (db) {
        const now = new Date().toISOString();
        const payloadStr = JSON.stringify(writeTenant !== 'default' ? { ...body, tenant_id: writeTenant } : body);
        try {
          await db.prepare(
            'INSERT INTO erpnext_webhook_log (doctype, docname, action, payload, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            body.doctype || '', body.docname || '', body.action || '',
            payloadStr, writeTenant, now
          ).run();
        } catch {
          await db.prepare(
            'INSERT INTO erpnext_webhook_log (doctype, docname, action, payload, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            body.doctype || '', body.docname || '', body.action || '',
            payloadStr, now
          ).run();
        }
        await consumeErpnextWebhookEvent(db, (env.AUTH_KV ?? env.AURA_KV) as unknown as WebhookKvLike, {
          doctype: String(body.doctype || ''),
          docname: String(body.docname || ''),
          action: String(body.action || ''),
          payload: body,
          tenantId: writeTenant,
        }).catch(() => {});
      }
      return json({ success: true, message: 'Webhook received' });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }
}

interface WebhookKvLike {
  get?: (key: string) => Promise<string | null>;
  put?: (key: string, value: string) => Promise<unknown>;
  delete?: (key: string) => Promise<unknown>;
}

export async function consumeErpnextWebhookEvent(
  db: D1Database,
  kv: WebhookKvLike | undefined,
  event: {
    doctype: string;
    docname: string;
    action: string;
    payload?: Record<string, unknown> | null;
    tenantId: string;
  }
): Promise<boolean> {
  const doctype = event.doctype.trim();
  const docname = event.docname.trim();
  if (!doctype || !docname) return false;
  const effectiveTenant =
    event.tenantId && event.tenantId.trim() && event.tenantId.trim() !== '*'
      ? event.tenantId.trim()
      : 'default';
  const now = new Date().toISOString();
  const data = (event.payload?.data && typeof event.payload.data === 'object'
    ? (event.payload.data as Record<string, unknown>)
    : event.payload || {}) as Record<string, unknown>;

  if (doctype === 'Item' || doctype === 'Bin') {
    const itemCode = String(data.item_code || docname).trim();
    const productKey = effectiveTenant !== 'default' ? `${effectiveTenant}::${itemCode}` : itemCode;
    const stockVal = typeof data.actual_qty === 'number' ? Math.floor(data.actual_qty) : null;
    const priceVal = typeof data.standard_rate === 'number' ? data.standard_rate : null;
    try {
      await db.prepare(
        `INSERT INTO erpnext_product_sync
          (product_id, erpnext_product_id, erpnext_item_code, cached_stock, cached_price, last_synced_at, erpnext_modified, tenant_id)
         VALUES (?, 0, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id) DO UPDATE SET
          erpnext_item_code = excluded.erpnext_item_code,
          cached_stock = COALESCE(excluded.cached_stock, erpnext_product_sync.cached_stock),
          cached_price = COALESCE(excluded.cached_price, erpnext_product_sync.cached_price),
          last_synced_at = excluded.last_synced_at,
          erpnext_modified = excluded.erpnext_modified
         WHERE COALESCE(NULLIF(TRIM(erpnext_product_sync.tenant_id), ''), 'default') = excluded.tenant_id`
      ).bind(productKey, itemCode, stockVal, priceVal, now, String(data.modified || now), effectiveTenant).run();
    } catch {
      // Optional table in minimal schemas
    }
    if (kv && typeof kv.delete === 'function') {
      const cacheKey =
        effectiveTenant !== 'default'
          ? `erpnext:product:availability:${effectiveTenant}:${itemCode}`
          : `erpnext:product:availability:${itemCode}`;
      await kv.delete(cacheKey).catch(() => {});
    }
    return true;
  }

  if (doctype === 'Customer') {
    const phone = typeof data.mobile_no === 'string' ? data.mobile_no.trim() : '';
    const email = typeof data.email_id === 'string' ? data.email_id.trim() : '';
    if (phone || email || docname) {
      await db.prepare(
        `UPDATE customers
         SET erpnext_id = ?, sync_status = 'synced'
         WHERE (erpnext_id = ? OR (? != '' AND phone = ?) OR (? != '' AND email = ?))
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      ).bind(docname, docname, phone, phone, email, email, effectiveTenant).run().catch(() => {});
    }
    return true;
  }

  if (doctype === 'Supplier') {
    const supName = typeof data.supplier_name === 'string' ? data.supplier_name.trim() : docname;
    await db.prepare(
      `INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, erpnext_model, sync_status, last_synced_at, tenant_id)
       VALUES (?, 'supplier', ?, ?, 'Supplier', 'synced', ?, ?)
       ON CONFLICT(id) DO UPDATE SET erpnext_id = excluded.erpnext_id, sync_status = 'synced', last_synced_at = excluded.last_synced_at`
    ).bind(`map_supplier_${effectiveTenant}_${supName}`, supName, docname, now, effectiveTenant).run().catch(() => {});
    return true;
  }

  if (doctype === 'Sales Invoice' || doctype === 'POS Invoice' || doctype === 'Sales Order') {
    const localOrderId = String(data.po_no || data.custom_aura_order_id || data.order_id || docname).trim();
    await db.prepare(
      `INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, erpnext_model, sync_status, last_synced_at, tenant_id)
       VALUES (?, 'order', ?, ?, ?, 'synced', ?, ?)
       ON CONFLICT(id) DO UPDATE SET erpnext_id = excluded.erpnext_id, sync_status = 'synced', last_synced_at = excluded.last_synced_at`
    ).bind(`map_order_${effectiveTenant}_${localOrderId}`, localOrderId, docname, doctype, now, effectiveTenant).run().catch(() => {});
    return true;
  }

  return false;
}

export async function processErpnextWebhookLog(
  db: D1Database,
  kv: WebhookKvLike | undefined,
  tenantId: string,
  limit = 50,
): Promise<number> {
  const effectiveTenant = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  const cursorKey =
    effectiveTenant === 'default'
      ? 'erpnext:webhook_log:last_id'
      : `erpnext:webhook_log:last_id:${effectiveTenant}`;
  const rawLastId = kv && typeof kv.get === 'function' ? await kv.get(cursorKey).catch(() => null) : null;
  const lastId = rawLastId ? Number(rawLastId) || 0 : 0;

  let rows: Array<{
    id: number;
    doctype: string;
    docname: string;
    action: string;
    payload?: string | null;
    tenant_id?: string | null;
  }> = [];
  try {
    const res = await db.prepare(
      `SELECT id, doctype, docname, action, payload, tenant_id
       FROM erpnext_webhook_log
       WHERE id > ?
         AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
       ORDER BY id ASC
       LIMIT ?`
    ).bind(lastId, effectiveTenant, effectiveTenant, limit).all<typeof rows[number]>();
    rows = res.results || [];
  } catch {
    return 0;
  }

  let processed = 0;
  let maxSeenId = lastId;
  for (const row of rows) {
    let parsedPayload: Record<string, unknown> | null = null;
    if (row.payload) {
      try {
        parsedPayload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        parsedPayload = null;
      }
    }
    const rowTenant =
      typeof row.tenant_id === 'string' && row.tenant_id.trim()
        ? row.tenant_id.trim()
        : effectiveTenant === '*'
          ? 'default'
          : effectiveTenant;
    const handled = await consumeErpnextWebhookEvent(db, kv, {
      doctype: row.doctype,
      docname: row.docname,
      action: row.action,
      payload: parsedPayload,
      tenantId: rowTenant,
    }).catch(() => false);
    if (handled) processed++;
    if (row.id > maxSeenId) maxSeenId = row.id;
  }

  if (maxSeenId > lastId && kv && typeof kv.put === 'function') {
    await kv.put(cursorKey, String(maxSeenId)).catch(() => {});
  }
  return processed;
}
