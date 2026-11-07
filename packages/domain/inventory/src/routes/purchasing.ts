import { Hono } from 'hono';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
import {
  createCanonicalPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '../policies/purchasing-receiving-policy';
import type { PurchaseOrderInput } from '../model/supplier-policy';

interface D1Database {
  prepare: (sql: string) => {
    bind: (...args: any[]) => {
      all: <T = any>() => Promise<{ results: T[] }>;
      first: <T = any>() => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number } }>;
    };
  };
  batch: (ops: any[]) => Promise<any[]>;
}

interface AppEnv {
  AURA_DB: D1Database;
  executionCtx?: { waitUntil: (p: Promise<any>) => void };
}

type AppContext = { Bindings: AppEnv };

const PURCHASING_MUTATION_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);
const PURCHASING_READ_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'kitchen',
  'chef',
  'barista',
]);

function verifyPurchasingTenant(
  c: any,
  mode: 'read' | 'write'
): { ok: true; tenantId: string } | { ok: false } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const resolvedTenant = getTenantId(c).trim() || 'default';
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedTenant = candidateOverrides[0] || '';

  if (!user) {
    if (mode === 'write') {
      return { ok: false };
    }
    if (requestedTenant || resolvedTenant === '*' || resolvedTenant.toLowerCase() === 'hq') {
      return { ok: false };
    }
    return { ok: true, tenantId: resolvedTenant };
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const contextTenant = typeof c.get?.('tenantId') === 'string' ? c.get('tenantId').trim() : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant ? contextTenant : 'default');
  const isHqAdmin =
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant === '*' || userTenant === 'hq' || userTenant.toLowerCase() === 'hq');

  if (isHqAdmin) {
    const rawTarget =
      resolvedTenant.toLowerCase() === 'hq' || resolvedTenant === '*'
        ? requestedTenant || '*'
        : requestedTenant || resolvedTenant;
    const normTarget =
      !rawTarget || rawTarget.toLowerCase() === 'hq' || rawTarget === '*'
        ? '*'
        : rawTarget;
    return { ok: true, tenantId: normTarget };
  }

  if (
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq' ||
    contextTenant === '*' ||
    contextTenant.toLowerCase() === 'hq' ||
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq'
  ) {
    return { ok: false };
  }

  if (userTenant !== '*' && (resolvedTenant !== userTenant || (requestedTenant && requestedTenant !== userTenant))) {
    return { ok: false };
  }

  return { ok: true, tenantId: userTenant === '*' ? resolvedTenant : userTenant };
}

function checkPurchasingReadAccess(c: any): Response | null {
  const userRole = c.get?.('user')?.role as string | undefined;
  if (userRole) {
    if (!PURCHASING_READ_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const tenantCheck = verifyPurchasingTenant(c, 'read');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant purchasing access denied' }, 403);
    }
    return null;
  }
  const preboundTenant = c.get?.('tenantId');
  const hasTenantMiddlewareContext = Boolean(
    c.get?.('tenantResolution') ||
      c.req?.header?.('Authorization') ||
      c.req?.header?.('X-Tenant-ID') ||
      c.req?.header?.('x-tenant-id') ||
      c.req?.header?.('X-Store-ID') ||
      c.req?.header?.('x-store-id')
  );
  if (!preboundTenant || hasTenantMiddlewareContext) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }
  const tenantCheck = verifyPurchasingTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant purchasing access denied' }, 403);
  }
  return null;
}

/**
 * Canonical Purchasing Router
 * Rules: PO creation does NOT touch stock. Stock is only incremented via Receiving.
 */
export function purchasing(app: Hono<AppContext>) {
  app.post('/purchase-orders', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (!userRole || !PURCHASING_MUTATION_ROLES.has(userRole)) {
      return c.json(
        { success: false, error: userRole ? 'Insufficient permissions' : 'Authentication required' },
        userRole ? 403 : 401
      );
    }
    const tenantCheck = verifyPurchasingTenant(c, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant purchasing mutation denied' }, 403);
    }
    try {
      const db = c.env.AURA_DB;
      const tenantId = tenantCheck.tenantId;
      const body = (await c.req.json()) as PurchaseOrderInput;
      const po = await createCanonicalPurchaseOrder(
        db as any,
        {
          supplierId: body.supplier_id,
          items: body.items.map(i => ({
            ingredientId: i.ingredient_id,
            quantity: i.quantity,
            unitPrice: i.unit_cost,
          })),
          expectedDate: body.expected_date,
          notes: body.notes,
          tenantId,
        },
        tenantId
      );

      return c.json({ success: true, data: po }, 201);
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 400);
    }
  });

  app.post('/purchase-orders/:id/receive', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (!userRole || !PURCHASING_MUTATION_ROLES.has(userRole)) {
      return c.json(
        { success: false, error: userRole ? 'Insufficient permissions' : 'Authentication required' },
        userRole ? 403 : 401
      );
    }
    const tenantCheck = verifyPurchasingTenant(c, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant purchasing mutation denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
    const id = c.req.param('id');
    const body = (await c.req.json().catch(() => null)) as { items?: Array<{ ingredient_id: string; quantity: number }>; receipt_id?: string } | null;
    if (!body || !Array.isArray(body.items)) {
      return c.json({ success: false, error: 'Invalid receipt payload' }, 400);
    }

    const result = await receivePurchaseOrder(
      db as any,
      id,
      body.items.map(i => ({ ingredientId: i.ingredient_id, receivedQuantity: i.quantity })),
      { receiptId: body.receipt_id, tenantId }
    );

    if (!result.ok) {
      return c.json({ success: false, error: result.error }, 400);
    }
    return c.json({ success: true, data: result });
  });

  app.post('/purchase-orders/:id/cancel', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (!userRole || !PURCHASING_MUTATION_ROLES.has(userRole)) {
      return c.json(
        { success: false, error: userRole ? 'Insufficient permissions' : 'Authentication required' },
        userRole ? 403 : 401
      );
    }
    const tenantCheck = verifyPurchasingTenant(c, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant purchasing mutation denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
    const id = c.req.param('id');
    const result = await cancelPurchaseOrder(db as any, id, tenantId);
    if (!result.ok) {
      const status =
        result.error?.includes('received') || result.error?.includes('cancelled')
          ? 409
          : result.error?.includes('not_found') || result.error?.includes('not found')
            ? 404
            : 400;
      return c.json({ success: false, error: result.error }, status as any);
    }
    return c.json({ success: true });
  });

  app.get('/purchase-orders', async (c) => {
    const denied = checkPurchasingReadAccess(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantCheck = verifyPurchasingTenant(c, 'read');
    const tenantId = tenantCheck.ok ? tenantCheck.tenantId : (getTenantId(c).trim() || 'default');
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    const fetchLimit = Math.max(limit, 200);

    let results: Record<string, unknown>[] = [];
    if (tenantId && tenantId !== '*') {
      try {
        const res = await db
          .prepare(
            "SELECT * FROM purchase_orders WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?"
          )
          .bind(tenantId, limit)
          .all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        if (tenantId === 'default') {
          const res = await db
            .prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT ?')
            .bind(fetchLimit)
            .all<Record<string, unknown>>();
          results = res.results || [];
        } else {
          results = [];
        }
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT ?')
        .bind(fetchLimit)
        .all<Record<string, unknown>>();
      results = res.results || [];
    }

    const filtered = (results || [])
      .filter((r) => matchesTenantRow(r, tenantId))
      .slice(0, limit);

    return c.json({ success: true, data: filtered });
  });

  app.get('/purchase-orders/:id', async (c) => {
    const denied = checkPurchasingReadAccess(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantCheck = verifyPurchasingTenant(c, 'read');
    const tenantId = tenantCheck.ok ? tenantCheck.tenantId : (getTenantId(c).trim() || 'default');
    const id = c.req.param('id');

    const po = await db
      .prepare('SELECT * FROM purchase_orders WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    if (!po || !matchesTenantRow(po, tenantId)) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    const effectivePoTenant =
      typeof po.tenant_id === 'string' && po.tenant_id.trim()
        ? po.tenant_id.trim()
        : tenantId !== '*'
          ? tenantId
          : 'default';

    let rawItems: Record<string, unknown>[] = [];
    if (effectivePoTenant && effectivePoTenant !== '*') {
      try {
        const res = await db
          .prepare(
            "SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(id, effectivePoTenant)
          .all<Record<string, unknown>>();
        rawItems = res.results || [];
      } catch {
        if (effectivePoTenant === 'default') {
          const res = await db
            .prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?')
            .bind(id)
            .all<Record<string, unknown>>();
          rawItems = res.results || [];
        } else {
          rawItems = [];
        }
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?')
        .bind(id)
        .all<Record<string, unknown>>();
      rawItems = res.results || [];
    }
    const items = (rawItems || []).filter((item) => matchesTenantRow(item, effectivePoTenant));

    return c.json({ success: true, data: { ...po, items } });
  });

  app.get('/suppliers', async (c) => {
    const denied = checkPurchasingReadAccess(c);
    if (denied) return denied;
    const db = c.env.AURA_DB;
    const tenantCheck = verifyPurchasingTenant(c, 'read');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant purchasing access denied' }, 403);
    }
    const tenantId = tenantCheck.tenantId;
    let rows: Record<string, unknown>[] = [];
    if (tenantId && tenantId !== '*') {
      try {
        const res = await db
          .prepare(
            "SELECT * FROM suppliers WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY name ASC"
          )
          .bind(tenantId)
          .all<Record<string, unknown>>();
        rows = res.results || [];
      } catch {
        if (tenantId === 'default') {
          const res = await db
            .prepare('SELECT * FROM suppliers ORDER BY name ASC')
            .bind()
            .all<Record<string, unknown>>();
          rows = res.results || [];
        } else {
          rows = [];
        }
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM suppliers ORDER BY name ASC')
        .bind()
        .all<Record<string, unknown>>();
      rows = res.results || [];
    }
    const filtered = (rows || []).filter((r) => matchesTenantRow(r, tenantId));
    return c.json({ success: true, data: filtered });
  });
}
