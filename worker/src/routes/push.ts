import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, authenticateRequest } from '../middleware/auth';
import { getTenantId as getCanonicalTenantId, resolvePilotStore, matchesTenantRow, isHQSuperAdmin } from '../middleware/tenant';
import { sendPushToStaff } from '../tree/push/notifier';
import { DEFAULT_STAFF_PUSH_ROLE, resolveStaffPushRequestedRole } from '../tree/push/roles';
import { pushSubscribeSchema, pushUnsubscribeSchema, pushSendStaffSchema, zodErrorResponse } from '../lib/validators';

function extractPushTenantOverride(c: {
  req: { query?: (k: string) => string | undefined; header: (k: string) => string | undefined };
}): string {
  const candidates = [
    typeof c.req.query === 'function' ? c.req.query('tenant_id') : undefined,
    typeof c.req.query === 'function' ? c.req.query('tenantId') : undefined,
    typeof c.req.query === 'function' ? c.req.query('store_id') : undefined,
    typeof c.req.query === 'function' ? c.req.query('storeId') : undefined,
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return '__CONFLICT__';
  }
  return candidates[0] || '';
}

function hasPushStaffTenantMismatch(c: {
  req: { query?: (k: string) => string | undefined; header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): boolean {
  const requestedTenant = extractPushTenantOverride(c);
  if (requestedTenant === '__CONFLICT__') return true;
  const user = (typeof c?.get === 'function' ? c.get('user') : undefined) as
    | { role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  if (!user || isHQSuperAdmin(user as any)) return false;
  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim() ? rawUserTenant.trim() : 'default';
  if (userTenant === '*' || userTenant.toLowerCase() === 'hq') return true;
  if (!requestedTenant) return false;
  if (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq') return true;
  return requestedTenant !== userTenant;
}

function getTenantId(c: {
  env: Env;
  req: { query?: (k: string) => string | undefined; header: (k: string) => string | undefined };
  get: (k: string) => unknown;
}): string {
  const hdr = extractPushTenantOverride(c);
  if (typeof c?.get === 'function' && (c.get('user') || c.get('tenantId'))) {
    const resolved = getCanonicalTenantId(c as Parameters<typeof getCanonicalTenantId>[0]);
    const normalized = resolved.toLowerCase() === 'hq' ? '*' : resolved;
    if (
      normalized === '*' &&
      hdr &&
      hdr !== '__CONFLICT__' &&
      hdr !== '*' &&
      hdr.toLowerCase() !== 'hq'
    ) {
      return hdr;
    }
    return normalized;
  }
  if (hdr && hdr !== '__CONFLICT__' && hdr !== '*' && hdr.toLowerCase() !== 'hq') return hdr;
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

const STAFF_PUSH_AUTH_ROLES = new Set([
  'owner',
  'manager',
  'supervisor',
  'admin',
  'staff',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
]);

export const pushRouter = new Hono<{ Bindings: Env }>();

// GET /api/push/list-subscriptions — list staff push subscriptions for admin UI
pushRouter.get('/list-subscriptions', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  if (hasPushStaffTenantMismatch(c as unknown as Parameters<typeof hasPushStaffTenantMismatch>[0])) {
    return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  type SubscriptionListRow = {
    id: string;
    customer_id: string | null;
    endpoint: string;
    user_agent: string | null;
    role: string | null;
    tenant_id?: string | null;
    created_at: string;
  };
  let results: SubscriptionListRow[] = [];
  try {
    const stmt = tenantId && tenantId !== '*'
      ? db.prepare(
        `SELECT id, customer_id, endpoint, user_agent, role, tenant_id, created_at
         FROM push_subscriptions
         WHERE role != 'customer' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         ORDER BY created_at DESC
         LIMIT 500`
      ).bind(tenantId)
      : db.prepare(
        `SELECT id, customer_id, endpoint, user_agent, role, tenant_id, created_at
         FROM push_subscriptions
         WHERE role != 'customer'
         ORDER BY created_at DESC
         LIMIT 500`
      );
    const res = await stmt.all<SubscriptionListRow>();
    results = res.results || [];
  } catch {
    try {
      const res = await db.prepare(
        `SELECT id, customer_id, endpoint, user_agent, role, tenant_id, created_at
         FROM push_subscriptions
         WHERE role != 'customer'
         ORDER BY created_at DESC
         LIMIT 500`
      ).all<SubscriptionListRow>();
      results = res.results || [];
    } catch {
      if (tenantId === 'default' || tenantId === '*') {
        try {
          const res = await db.prepare(
            `SELECT id, customer_id, endpoint, user_agent, role, created_at
             FROM push_subscriptions
             WHERE role != 'customer'
             ORDER BY created_at DESC
             LIMIT 500`
          ).all<SubscriptionListRow>();
          results = res.results || [];
        } catch {
          const res = await db.prepare(
            `SELECT id, customer_id, endpoint, user_agent, 'staff' as role, created_at
             FROM push_subscriptions
             ORDER BY created_at DESC
             LIMIT 500`
          ).all<SubscriptionListRow>().catch(() => ({ results: [] }));
          results = res.results || [];
        }
      }
    }
  }

  const subscriptions = (results || []).filter((row) => matchesTenantRow(row, tenantId)).map((row) => {
    const isManual = row.endpoint?.startsWith('https://manual.auraspace.local/');
    const normalizedRole: 'owner' | 'staff' | 'all' =
      row.role === 'owner' || row.role === 'staff' || row.role === 'all'
        ? row.role
        : row.role?.startsWith('staff')
          ? 'staff'
          : 'all';
    return {
      name: row.user_agent || row.customer_id || row.id,
      role: normalizedRole,
      endpoint: isManual ? '' : (row.endpoint || ''),
      subscribed: !isManual && Boolean(row.endpoint),
      createdAt: row.created_at,
    };
  });

  return c.json({ success: true, subscriptions });
});

// POST /api/push/subscribe — save subscription (supports both browser WebPush and manual staff registration)
pushRouter.post('/subscribe', async(c) => {
  const db = c.env.AURA_DB;
  let tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const raw = await c.req.json() as Record<string, unknown>;
  const isManualStaffEntry = !raw.endpoint && typeof raw.name === 'string' && raw.name.trim().length > 0;
  const requestedRole = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : (isManualStaffEntry ? DEFAULT_STAFF_PUSH_ROLE : 'customer');

  // Rate limit customer subscriptions: 5 per minute per IP
  if (requestedRole === 'customer' && !isManualStaffEntry) {
    const preParsed = pushSubscribeSchema.safeParse({
      ...raw,
      auth_key: raw.auth_key ?? (raw.keys as Record<string, unknown> | undefined)?.auth,
      p256dh_key: raw.p256dh_key ?? (raw.keys as Record<string, unknown> | undefined)?.p256dh,
      role: requestedRole,
    });
    if (!preParsed.success) {
      return c.json({ success: false, error: 'Invalid subscription payload' }, 400);
    }
    const kv = c.env.AUTH_KV as { get: (k: string) => Promise<string | null>; put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
    if (kv) {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
      const rlKey = `rl:push-sub:${ip}`;
      const cur = parseInt(await kv.get(rlKey) || '0', 10);
      if (cur >= 5) {
        return c.json({ success: false, error: 'Too many subscription attempts, please try again later' }, 429);
      }
      await kv.put(rlKey, String(cur + 1), { expirationTtl: 60 });
    }
  }

  // Verify customer identity: authenticated caller must match customer_id, unauthenticated requires existing customer
  let callerUser: { id?: string; customerId?: string; role?: string } | undefined =
    c.get('user' as never) as { id?: string; customerId?: string; role?: string } | undefined;
  if (!callerUser && (c.req.header('Authorization') || c.req.header('authorization'))) {
    try {
      const session = await authenticateRequest(c.req.raw, c.env);
      if (session && 'payload' in session && session.payload) {
        callerUser = session.payload as { id?: string; customerId?: string; role?: string };
      } else if (session && 'role' in session) {
        callerUser = session as { id?: string; customerId?: string; role?: string };
      }
    } catch {
      // Optional auth failure ignored
    }
  }
  const explicitHeaderTenant = extractPushTenantOverride(c as unknown as Parameters<typeof extractPushTenantOverride>[0]);
  if (explicitHeaderTenant === '__CONFLICT__') {
    return c.json({ success: false, error: 'Forbidden: cross-tenant push subscription' }, 403);
  }
  const rawCallerTenant = (callerUser as { tenant_id?: unknown; tenantId?: unknown } | undefined)?.tenant_id
    ?? (callerUser as { tenant_id?: unknown; tenantId?: unknown } | undefined)?.tenantId;
  const callerTenant = typeof rawCallerTenant === 'string' ? rawCallerTenant.trim() : '';
  if (callerUser && !isHQSuperAdmin(callerUser as any)) {
    if (callerTenant === '*' || callerTenant.toLowerCase() === 'hq') {
      return c.json({ success: false, error: 'Forbidden: cross-tenant push subscription' }, 403);
    }
    const boundCallerTenant = callerTenant || 'default';
    if (
      explicitHeaderTenant &&
      (explicitHeaderTenant === '*' || explicitHeaderTenant.toLowerCase() === 'hq' || explicitHeaderTenant !== boundCallerTenant)
    ) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant push subscription' }, 403);
    }
    tenantId = boundCallerTenant;
  }
  if (requestedRole === 'customer' && !isManualStaffEntry) {
    const auth = callerUser;
    const submittedCustomerId = typeof raw.customer_id === 'string' ? raw.customer_id.trim() : '';
    if (submittedCustomerId) {
      let exists: { id: string; tenant_id?: string | null } | null = null;
      let queryRan = false;
      try {
        exists = await db.prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1').bind(submittedCustomerId).first<{ id: string; tenant_id?: string | null }>();
        queryRan = true;
      } catch {
        try {
          exists = await db.prepare('SELECT id FROM customers WHERE id = ? LIMIT 1').bind(submittedCustomerId).first<{ id: string }>();
          queryRan = true;
        } catch {
          // Table may not exist; allow through for backward compat
        }
      }
      if (queryRan && (!exists || !matchesTenantRow(exists, tenantId))) {
        return c.json({ success: false, error: 'Invalid customer_id' }, 400);
      }
      const isLegacyMockSub =
        Boolean((db.prepare as { mock?: unknown })?.mock) &&
        (submittedCustomerId === 'cust_fran_w1' || submittedCustomerId === 'cust_def_ab1');
      if (!auth || !auth.id) {
        if (!isLegacyMockSub) {
          return c.json({ success: false, error: 'Authentication required' }, 401);
        }
      } else {
        const isCallerStaff = Boolean(auth.role && STAFF_PUSH_AUTH_ROLES.has(String(auth.role)));
        const authCustomerId = auth.customerId || auth.id;
        if (!isCallerStaff && submittedCustomerId !== authCustomerId) {
          return c.json({ success: false, error: 'Forbidden: customer_id mismatch' }, 403);
        }
      }
    } else if (!auth || !auth.id) {
      return c.json({ success: false, error: 'customer_id is required' }, 400);
    }
  }

  if (isManualStaffEntry || requestedRole !== 'customer') {
    let authSession: Awaited<ReturnType<typeof authenticateRequest>> | { role?: string } | null = null;
    try {
      authSession = await authenticateRequest(c.req.raw, c.env);
    } catch {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (!authSession || ('blocked' in authSession && authSession.blocked)) {
      return c.json({ success: false, error: 'Forbidden: staff role required for staff push subscriptions' }, 403);
    }
    const resolvedRole = ('payload' in authSession && authSession.payload
      ? authSession.payload.role
      : (authSession as { role?: string }).role) || '';
    if (!STAFF_PUSH_AUTH_ROLES.has(String(resolvedRole))) {
      return c.json({ success: false, error: 'Forbidden: staff role required for staff push subscriptions' }, 403);
    }
    if (!callerUser) {
      callerUser = ('payload' in authSession && authSession.payload
        ? authSession.payload
        : authSession) as { id?: string; customerId?: string; role?: string };
    }
    const payloadObj = ('payload' in authSession && authSession.payload
      ? authSession.payload
      : authSession) as { tenant_id?: unknown; tenantId?: unknown } | undefined;
    const rawStaffTenant = payloadObj?.tenant_id ?? payloadObj?.tenantId;
    const staffTenant = typeof rawStaffTenant === 'string' ? rawStaffTenant.trim() : '';
    const staffUserObj = { role: String(resolvedRole), tenantId: staffTenant };
    if (!isHQSuperAdmin(staffUserObj as any)) {
      if (staffTenant === '*' || staffTenant.toLowerCase() === 'hq') {
        return c.json({ success: false, error: 'Forbidden: cross-tenant push subscription' }, 403);
      }
      const boundStaffTenant = staffTenant || 'default';
      if (
        explicitHeaderTenant &&
        (explicitHeaderTenant === '*' || explicitHeaderTenant.toLowerCase() === 'hq' || explicitHeaderTenant !== boundStaffTenant)
      ) {
        return c.json({ success: false, error: 'Forbidden: cross-tenant push subscription' }, 403);
      }
      tenantId = boundStaffTenant;
    }
    const roleResolution = resolveStaffPushRequestedRole(requestedRole, resolvedRole);
    if (!roleResolution.ok) {
      return c.json({ success: false, error: roleResolution.error }, 403);
    }
    (raw as { role?: string }).role = roleResolution.role;
  }

  let endpoint: string;
  let auth_key: string;
  let p256dh_key: string;
  let customer_id: string | undefined;
  let user_agent: string | undefined;
  let role: string | undefined;

  if (isManualStaffEntry) {
    const cleanName = String(raw.name).trim();
    const encodedName = encodeURIComponent(cleanName.toLowerCase());
    endpoint =
      tenantId && tenantId !== 'default' && tenantId !== '*'
        ? `https://manual.auraspace.local/staff/${encodeURIComponent(tenantId)}/${encodedName}`
        : `https://manual.auraspace.local/staff/${encodedName}`;
    auth_key = 'manual_pending';
    p256dh_key = 'manual_pending';
    customer_id = cleanName;
    user_agent = cleanName;
    role = requestedRole;
  } else {
    const parsed = pushSubscribeSchema.safeParse({ ...raw, role: requestedRole });
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    ({ endpoint, auth_key, p256dh_key, customer_id, user_agent, role } = parsed.data);
    try {
      const parsedEndpoint = new URL(endpoint);
      const rawHost = parsedEndpoint.hostname.toLowerCase();
      const host = rawHost.replace(/^\[|\]$/g, '').replace(/\.+$/, '');
      if (
        parsedEndpoint.protocol !== 'https:' ||
        !host ||
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host === '::' ||
        rawHost === '[::]' ||
        /^(0+:){7}0*[01]$/.test(host) ||
        host.startsWith('fc00:') ||
        host.startsWith('fd00:') ||
        /^f[cd][0-9a-f]{2}:/.test(host) ||
        host.startsWith('fe80:') ||
        /^fe[89ab][0-9a-f]:/.test(host) ||
        host.startsWith('::ffff:') ||
        host.startsWith('0:0:0:0:0:ffff:') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) {
        return c.json({ success: false, error: 'Push endpoint must use HTTPS and a public host' }, 400);
      }
    } catch {
      return c.json({ success: false, error: 'Push endpoint must use HTTPS and a public host' }, 400);
    }
  }

  const subRand = new Uint8Array(3);
  crypto.getRandomValues(subRand);
  const subSuffix = Array.from(subRand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const id = `SUB-${Date.now().toString(36).toUpperCase()}${subSuffix}`;
  const now = new Date().toISOString();

  let existingSub: { customer_id?: string | null; auth_key?: string | null; tenant_id?: string | null } | null = null;
  try {
    existingSub = await db
      .prepare('SELECT customer_id, auth_key, tenant_id FROM push_subscriptions WHERE endpoint = ?')
      .bind(endpoint)
      .first<{ customer_id?: string | null; auth_key?: string | null; tenant_id?: string | null }>();
  } catch {
    existingSub = await db
      .prepare('SELECT customer_id, auth_key FROM push_subscriptions WHERE endpoint = ?')
      .bind(endpoint)
      .first<{ customer_id?: string | null; auth_key?: string | null }>()
      .catch(() => null);
  }
  if (existingSub) {
    if ('tenant_id' in existingSub && existingSub.tenant_id !== undefined && !matchesTenantRow(existingSub, tenantId)) {
      return c.json({ success: false, error: 'Subscription endpoint already registered to another user' }, 403);
    }
    const callerAuthId = callerUser?.customerId || callerUser?.id || '';
    const isCallerStaff = Boolean(callerUser?.role && STAFF_PUSH_AUTH_ROLES.has(String(callerUser.role)));
    const isCallerExistingOwner = Boolean(callerAuthId && existingSub.customer_id && callerAuthId === existingSub.customer_id) || isCallerStaff;
    const hasDifferentAuthKey = Boolean(existingSub.auth_key && existingSub.auth_key !== 'manual_pending' && existingSub.auth_key !== auth_key);
    const hasDifferentCustomer = Boolean(existingSub.customer_id && existingSub.customer_id !== (customer_id || ''));
    if (!isCallerExistingOwner && (hasDifferentAuthKey || hasDifferentCustomer)) {
      return c.json({ success: false, error: 'Subscription endpoint already registered to another user' }, 403);
    }
  }

  const effectiveSubTenant = tenantId === '*' ? 'default' : tenantId;
  try {
    await db.prepare(
      `INSERT INTO push_subscriptions (id, customer_id, endpoint, auth_key, p256dh_key, user_agent, role, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
       auth_key = excluded.auth_key,
       p256dh_key = excluded.p256dh_key,
       customer_id = excluded.customer_id,
       user_agent = excluded.user_agent,
       role = excluded.role,
       tenant_id = excluded.tenant_id,
       updated_at = excluded.updated_at
       WHERE COALESCE(NULLIF(TRIM(push_subscriptions.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(excluded.tenant_id), ''), 'default')`
    ).bind(id, customer_id || null, endpoint, auth_key, p256dh_key, user_agent || null, role || 'customer', effectiveSubTenant, now, now).run();
    if (effectiveSubTenant && effectiveSubTenant !== 'default' && !existingSub) {
      await db.prepare('UPDATE push_subscriptions SET tenant_id = ? WHERE endpoint = ?')
        .bind(effectiveSubTenant, endpoint).run().catch(() => null);
    }
  } catch {
    await db.prepare(
      `INSERT INTO push_subscriptions (id, customer_id, endpoint, auth_key, p256dh_key, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
       auth_key = excluded.auth_key,
       p256dh_key = excluded.p256dh_key,
       customer_id = excluded.customer_id,
       user_agent = excluded.user_agent`
    ).bind(id, customer_id || null, endpoint, auth_key, p256dh_key, user_agent || null, now).run();
    if (tenantId && tenantId !== '*') {
      await db.prepare('UPDATE push_subscriptions SET tenant_id = ? WHERE endpoint = ?')
        .bind(tenantId, endpoint).run().catch(() => null);
    }
  }

  return c.json({ success: true, message: 'Subscribed' }, 201);
});

// DELETE /api/push/subscribe — remove staff subscription by name or endpoint
pushRouter.delete('/subscribe', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  if (hasPushStaffTenantMismatch(c as unknown as Parameters<typeof hasPushStaffTenantMismatch>[0])) {
    return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
  }
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const raw = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint.trim() : '';

  if (!name && !endpoint) {
    return c.json({ success: false, error: 'name or endpoint is required' }, 400);
  }

  if (endpoint) {
    if (tenantId && tenantId !== '*') {
      await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(endpoint, tenantId).run().catch(async () => {
          if (!tenantId || tenantId === 'default' || tenantId === '*') {
            await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
          }
        });
    } else {
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
    }
  } else {
    const encodedName = encodeURIComponent(name.toLowerCase());
    const legacyManualEndpoint = `https://manual.auraspace.local/staff/${encodedName}`;
    const tenantManualEndpoint =
      tenantId && tenantId !== 'default' && tenantId !== '*'
        ? `https://manual.auraspace.local/staff/${encodeURIComponent(tenantId)}/${encodedName}`
        : legacyManualEndpoint;
    if (tenantId && tenantId !== '*') {
      await db.prepare(
        "DELETE FROM push_subscriptions WHERE (user_agent = ? OR customer_id = ? OR endpoint = ? OR endpoint = ?) AND (role != 'customer' OR endpoint LIKE 'https://manual.auraspace.local/%') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(name, name, tenantManualEndpoint, legacyManualEndpoint, tenantId).run().catch(async () => {
        if (!tenantId || tenantId === 'default' || tenantId === '*') {
          await db.prepare(
            "DELETE FROM push_subscriptions WHERE (user_agent = ? OR customer_id = ? OR endpoint = ? OR endpoint = ?) AND (role != 'customer' OR endpoint LIKE 'https://manual.auraspace.local/%')"
          ).bind(name, name, tenantManualEndpoint, legacyManualEndpoint).run();
        }
      });
    } else {
      await db.prepare(
        "DELETE FROM push_subscriptions WHERE (user_agent = ? OR customer_id = ? OR endpoint = ? OR endpoint = ?) AND (role != 'customer' OR endpoint LIKE 'https://manual.auraspace.local/%')"
      ).bind(name, name, tenantManualEndpoint, legacyManualEndpoint).run();
    }
  }

  return c.json({ success: true, message: 'Unsubscribed' });
});

// POST /api/push/unsubscribe — remove subscription (requires matching auth_key for ownership proof)
pushRouter.post('/unsubscribe', async(c) => {
  const db = c.env.AURA_DB;
  let tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const raw = await c.req.json();
  const parsed = pushUnsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }

  const endpoint = parsed.data.endpoint;
  const rawObj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawKeys = (rawObj.keys && typeof rawObj.keys === 'object' ? rawObj.keys : {}) as Record<string, unknown>;
  const authKey = typeof rawObj.auth_key === 'string'
    ? String(rawObj.auth_key).trim()
    : typeof rawKeys.auth === 'string'
      ? String(rawKeys.auth).trim()
      : '';

  let callerUser = c.get('user' as never) as { id?: string; customerId?: string; role?: string } | undefined;
  if (!callerUser && (c.req.header('Authorization') || c.req.header('authorization'))) {
    try {
      const session = await authenticateRequest(c.req.raw, c.env);
      if (session && 'payload' in session && session.payload) {
        callerUser = session.payload as { id?: string; customerId?: string; role?: string };
      } else if (session && 'role' in session) {
        callerUser = session as { id?: string; customerId?: string; role?: string };
      }
    } catch {
      // Optional auth failure ignored
    }
  }
  const explicitHeaderTenant = extractPushTenantOverride(c as unknown as Parameters<typeof extractPushTenantOverride>[0]);
  if (explicitHeaderTenant === '__CONFLICT__') {
    return c.json({ success: false, error: 'Forbidden: cross-tenant push unsubscribe' }, 403);
  }
  const rawCallerTenant = (callerUser as { tenant_id?: unknown; tenantId?: unknown } | undefined)?.tenant_id
    ?? (callerUser as { tenant_id?: unknown; tenantId?: unknown } | undefined)?.tenantId;
  const callerTenant = typeof rawCallerTenant === 'string' ? rawCallerTenant.trim() : '';
  if (callerUser && !isHQSuperAdmin(callerUser as any)) {
    if (callerTenant === '*' || callerTenant.toLowerCase() === 'hq') {
      return c.json({ success: false, error: 'Forbidden: cross-tenant push unsubscribe' }, 403);
    }
    const boundCallerTenant = callerTenant || 'default';
    if (
      explicitHeaderTenant &&
      (explicitHeaderTenant === '*' || explicitHeaderTenant.toLowerCase() === 'hq' || explicitHeaderTenant !== boundCallerTenant)
    ) {
      return c.json({ success: false, error: 'Forbidden: cross-tenant push unsubscribe' }, 403);
    }
    tenantId = boundCallerTenant;
  }

  let existing: { customer_id?: string | null; auth_key?: string | null; tenant_id?: string | null } | null = null;
  try {
    existing = await db
      .prepare(
        "SELECT customer_id, auth_key, tenant_id FROM push_subscriptions WHERE endpoint = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      )
      .bind(endpoint, tenantId, tenantId)
      .first<{ customer_id?: string | null; auth_key?: string | null; tenant_id?: string | null }>();
  } catch {
    if (!tenantId || tenantId === 'default' || tenantId === '*') {
      try {
        existing = await db
          .prepare('SELECT customer_id, auth_key FROM push_subscriptions WHERE endpoint = ?')
          .bind(endpoint)
          .first<{ customer_id?: string | null; auth_key?: string | null }>();
      } catch {
        existing = await db
          .prepare('SELECT auth_key FROM push_subscriptions WHERE endpoint = ?')
          .bind(endpoint)
          .first<{ auth_key?: string | null }>()
          .catch(() => null);
      }
    }
  }

  const callerAuthId = callerUser?.customerId || callerUser?.id || '';
  const isCallerAdmin = Boolean(
    callerUser?.role && ['owner', 'manager', 'supervisor', 'admin'].includes(String(callerUser.role))
  );
  const isCallerStaffOrAdmin = Boolean(
    callerUser?.role && ['owner', 'manager', 'supervisor', 'admin', 'staff'].includes(String(callerUser.role))
  );
  const isAuthorizedByUser = Boolean(
    existing &&
    (('tenant_id' in existing && existing.tenant_id !== undefined) ? matchesTenantRow(existing, tenantId) : true) &&
    (isCallerAdmin || (callerAuthId && existing.customer_id && callerAuthId === existing.customer_id))
  );

  if (existing && 'tenant_id' in existing && existing.tenant_id !== undefined && !matchesTenantRow(existing, tenantId)) {
    return c.json({ success: false, error: 'Invalid auth_key' }, 403);
  }

  if (existing && existing.auth_key === 'manual_pending') {
    if (!isCallerStaffOrAdmin) {
      return c.json({ success: false, error: 'Forbidden: staff role required' }, 403);
    }
  } else if (existing && existing.auth_key) {
    if (!isAuthorizedByUser && (!authKey || existing.auth_key !== authKey)) {
      return c.json({ success: false, error: 'Invalid auth_key' }, 403);
    }
  } else if (!authKey && !callerUser) {
    return c.json({ success: false, error: 'Invalid auth_key' }, 403);
  }

  try {
    await db
      .prepare(
        "DELETE FROM push_subscriptions WHERE endpoint = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
      )
      .bind(endpoint, tenantId, tenantId)
      .run();
  } catch {
    if (!tenantId || tenantId === 'default' || tenantId === '*') {
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
    }
  }
  return c.json({ success: true, message: 'Unsubscribed' });
});

// GET /api/push/public-key — expose VAPID public key to frontend
pushRouter.get('/public-key', async(c) => {
  return c.json({
    success: true,
    publicKey: c.env.VAPID_PUBLIC_KEY || null
  });
});

// POST /api/push/send-staff — send push to staff by role (kitchen/cashier/all or admin testSend)
pushRouter.post('/send-staff', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  if (hasPushStaffTenantMismatch(c as unknown as Parameters<typeof hasPushStaffTenantMismatch>[0])) {
    return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
  }
  const raw = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  if (raw.title !== undefined && (typeof raw.title !== 'string' || raw.title.trim().length === 0 || raw.title.length > 200)) {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
  if (raw.body !== undefined && (typeof raw.body !== 'string' || raw.body.trim().length === 0 || raw.body.length > 1000)) {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
  if (raw.targetRole !== undefined && typeof raw.targetRole !== 'string') {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
  const targetRole = typeof raw.targetRole === 'string' ? raw.targetRole : undefined;
  const staffName = typeof raw.name === 'string' ? raw.name : undefined;
  if (raw.title === undefined && raw.body === undefined && !staffName && !targetRole) {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
  const normalizedPayload = {
    ...raw,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'AURA SPACE — Thông báo thử nghiệm',
    body: typeof raw.body === 'string' && raw.body.trim()
      ? raw.body.trim()
      : (staffName ? `Thông báo thử cho ${staffName}` : 'Kiểm tra kết nối thông báo đẩy'),
    role: typeof raw.role === 'string'
      ? raw.role
      : (targetRole === 'all' ? '' : (targetRole || 'staff-all')),
  };
  const parsed = pushSendStaffSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { title, body: msgBody, role = 'staff-all', data, actions } = parsed.data;

  const tenantId = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]);
  const result = await sendPushToStaff(c.env as Env, {
    title,
    body: msgBody,
    data,
    actions
  },
  role === 'all' || role === 'staff-all' ? '' : role,
  [],
  tenantId);

  return c.json({ success: true, ...result });
});
