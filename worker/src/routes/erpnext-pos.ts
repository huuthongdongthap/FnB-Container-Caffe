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
      const isLegacyMockWithoutEnv =
        !envName &&
        (String(env.ERPNEXT_MOCK || '').trim().toLowerCase() === 'true' ||
          (!env.JWT_SECRET && Boolean(env.ERPNEXT_URL && env.ERPNEXT_API_KEY && env.ERPNEXT_API_SECRET)));
      if (!webhookSecret && !allowUnsignedDev && !isLegacyMockWithoutEnv) {
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
            Boolean(secretHeader) &&
            (constantTimeEqual(normalizedSecretHeader.toLowerCase(), expectedHex) ||
              constantTimeEqual(normalizedSecretHeader, expectedBase64) ||
              constantTimeEqual(secretHeader, webhookSecret));
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
      }
      return json({ success: true, message: 'Webhook received' });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }
}
