/**
 * Menu Queries
 * Converted from routes/menu.js with TypeScript + typed query params.
 * Business logic preserved exactly.
 */
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { verifyJWT } from 'worker/src/lib/jwt';
import { createLogger } from 'worker/src/middleware/logger';
import { isHQSuperAdmin, matchesTenantRow, resolvePilotStore } from 'worker/src/middleware/tenant';
import type { MenuItem } from 'worker/src/types/models';
import { parseAvailabilityFilter, toAvailabilityFlag } from '../policies/availability';

const log = createLogger({ route: 'menu' });

async function resolveMenuTenant(
  request: Request,
  env: Record<string, unknown>,
  tenantIdOverride?: string
): Promise<{ ok: true; tenantId: string } | { ok: false; status: 403; error: string }> {
  const url = new URL(request.url);
  const candidateOverrides = [
    url.searchParams.get('tenant_id'),
    url.searchParams.get('tenantId'),
    url.searchParams.get('store_id'),
    url.searchParams.get('storeId'),
    request.headers.get('X-Tenant-ID'),
    request.headers.get('x-tenant-id'),
    request.headers.get('X-Store-ID'),
    request.headers.get('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false, status: 403, error: 'Cross-tenant menu access denied' };
  }
  const requestedOverride = candidateOverrides[0] || '';
  const explicitOverride = tenantIdOverride ? tenantIdOverride.trim() : '';

  let callerUser =
    ((request as unknown as { user?: Record<string, unknown> }).user ??
      (env as { user?: Record<string, unknown> }).user) ||
    null;
  if (!callerUser) {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
    const jwtSecret = typeof env?.JWT_SECRET === 'string' ? env.JWT_SECRET : '';
    if (authHeader.startsWith('Bearer ') && jwtSecret.length >= 16) {
      const token = authHeader.slice(7).trim();
      const verified = await verifyJWT(token, jwtSecret).catch(() => null);
      if (verified && typeof verified === 'object') {
        callerUser = verified as unknown as Record<string, unknown>;
      }
    }
  }

  if (callerUser) {
    if (isHQSuperAdmin(callerUser as Parameters<typeof isHQSuperAdmin>[0])) {
      const cleanReq = requestedOverride && requestedOverride !== '*' && requestedOverride.toLowerCase() !== 'hq' ? requestedOverride : '';
      const cleanExp = explicitOverride && explicitOverride !== '*' && explicitOverride.toLowerCase() !== 'hq' ? explicitOverride : '';
      const userT = String(callerUser.tenantId ?? callerUser.tenant_id ?? '').trim();
      const cleanUser = userT && userT !== '*' && userT.toLowerCase() !== 'hq' ? userT : '';
      const raw =
        requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq'
          ? '*'
          : cleanReq || cleanExp || cleanUser || '*';
      return { ok: true, tenantId: !raw || raw.toLowerCase() === 'hq' || raw === '*' ? '*' : raw };
    }
    const userTenant = String(callerUser.tenantId ?? callerUser.tenant_id ?? '').trim() || 'default';
    if (userTenant === '*' || userTenant.toLowerCase() === 'hq') {
      return { ok: false, status: 403, error: 'Cross-tenant menu access denied' };
    }
    if (
      requestedOverride &&
      (requestedOverride === '*' ||
        requestedOverride.toLowerCase() === 'hq' ||
        requestedOverride !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Cross-tenant menu access denied' };
    }
    if (
      explicitOverride &&
      (explicitOverride === '*' ||
        explicitOverride.toLowerCase() === 'hq' ||
        explicitOverride !== userTenant)
    ) {
      return { ok: false, status: 403, error: 'Cross-tenant menu access denied' };
    }
    return { ok: true, tenantId: userTenant };
  }

  if (
    (requestedOverride && (requestedOverride === '*' || requestedOverride.toLowerCase() === 'hq')) ||
    (explicitOverride && (explicitOverride === '*' || explicitOverride.toLowerCase() === 'hq'))
  ) {
    return { ok: false, status: 403, error: 'Cross-tenant menu access denied' };
  }
  if (explicitOverride) {
    return { ok: true, tenantId: explicitOverride };
  }
  if (requestedOverride) {
    return { ok: true, tenantId: requestedOverride };
  }
  return { ok: true, tenantId: resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]) };
}

function parseTags(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function getMenu(request: Request, env: Record<string, unknown>, tenantIdOverride?: string) {
  try {
    const tenantRes = await resolveMenuTenant(request, env, tenantIdOverride);
    if (!tenantRes.ok) {
      return errorResponse(tenantRes.error, tenantRes.status);
    }
    const tenantId = tenantRes.tenantId;
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const available = url.searchParams.get('available');
    const search = url.searchParams.get('search');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    const parsedLimit = Math.max(1, parseInt(limit) || 50);
    const parsedOffset = Math.max(0, parseInt(offset) || 0);
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const availableFlag = parseAvailabilityFilter(available);

    const buildMenuQuery = (table: 'menu_items' | 'products', includeTenantScope: boolean) => {
      const selectPrefix =
        table === 'products'
          ? 'SELECT *, category_id as category, is_available as available FROM products WHERE 1=1'
          : 'SELECT * FROM menu_items WHERE 1=1';
      const catColumn = table === 'products' ? 'category_id' : 'category';
      const availColumn = table === 'products' ? 'is_available' : 'available';
      let sql = selectPrefix;
      const queryParams: unknown[] = [];
      if (includeTenantScope && tenantId !== '*') {
        if (tenantId === 'default') {
          sql += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'";
        } else {
          sql += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
          queryParams.push(tenantId);
        }
      }
      if (category) {
        sql += ` AND ${catColumn} = ?`;
        queryParams.push(category);
      }
      if (availableFlag !== null) {
        sql += ` AND ${availColumn} = ?`;
        queryParams.push(availableFlag);
      }
      if (search) {
        sql += ' AND (name LIKE ? OR description LIKE ?)';
        queryParams.push(`%${search}%`, `%${search}%`);
      }
      if (includeTenantScope || tenantId === '*') {
        sql += ` ORDER BY ${catColumn}, name LIMIT ? OFFSET ?`;
        queryParams.push(parsedLimit, parsedOffset);
      } else {
        sql += ` ORDER BY ${catColumn}, name`;
      }
      return { sql, params: queryParams };
    };

    let results: MenuItem[] = [];
    let useProductsFallback = false;
    let usedUnscopedFallback = false;
    try {
      if (tenantId !== '*') {
        try {
          const scoped = buildMenuQuery('menu_items', true);
          const res = await db.prepare(scoped.sql).bind(...scoped.params).all<MenuItem>();
          results = res.results ?? [];
        } catch {
          usedUnscopedFallback = true;
          const unscoped = buildMenuQuery('menu_items', false);
          const res = await db.prepare(unscoped.sql).bind(...unscoped.params).all<MenuItem>();
          results = res.results ?? [];
        }
      } else {
        const unscoped = buildMenuQuery('menu_items', false);
        const res = await db.prepare(unscoped.sql).bind(...unscoped.params).all<MenuItem>();
        results = res.results ?? [];
      }
    } catch {
      useProductsFallback = true;
      usedUnscopedFallback = false;
      if (tenantId !== '*') {
        try {
          const scopedProd = buildMenuQuery('products', true);
          const res = await db.prepare(scopedProd.sql).bind(...scopedProd.params).all<MenuItem>();
          results = res.results ?? [];
        } catch {
          usedUnscopedFallback = true;
          const unscopedProd = buildMenuQuery('products', false);
          const res = await db.prepare(unscopedProd.sql).bind(...unscopedProd.params).all<MenuItem>();
          results = res.results ?? [];
        }
      } else {
        const unscopedProd = buildMenuQuery('products', false);
        const res = await db.prepare(unscopedProd.sql).bind(...unscopedProd.params).all<MenuItem>();
        results = res.results ?? [];
      }
    }

    const tableName = useProductsFallback ? 'products' : 'menu_items';
    const catCol = useProductsFallback ? 'category_id' : 'category';
    const availCol = useProductsFallback ? 'is_available' : 'available';

    let items = (results ?? []).map((item: MenuItem) => ({
      ...item,
      tags: parseTags(item.tags),
      price: parseInt(item.price as unknown as string),
      available: toAvailabilityFlag(item.available ?? (item as unknown as { is_available?: unknown }).is_available)
    }));
    items = items.filter((item) => matchesTenantRow(item as unknown as Record<string, unknown>, tenantId));
    const filteredTotalBeforeSlice = items.length;
    if (usedUnscopedFallback && tenantId !== '*') {
      items = items.slice(parsedOffset, parsedOffset + parsedLimit);
    }

    const buildCountQuery = (includeTenantScope: boolean) => {
      let sql = `SELECT COUNT(*) as total FROM ${tableName} WHERE 1=1`;
      const countParams: unknown[] = [];
      if (includeTenantScope && tenantId !== '*') {
        if (tenantId === 'default') {
          sql += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default'";
        } else {
          sql += " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
          countParams.push(tenantId);
        }
      }
      if (category) {
        sql += ` AND ${catCol} = ?`;
        countParams.push(category);
      }
      if (availableFlag !== null) {
        sql += ` AND ${availCol} = ?`;
        countParams.push(availableFlag);
      }
      if (search) {
        sql += ' AND (name LIKE ? OR description LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }
      return { sql, params: countParams };
    };

    let countResult: { total: number }[] = [];
    let countUsedUnscopedFallback = false;
    if (tenantId !== '*') {
      try {
        const scopedCount = buildCountQuery(true);
        const res = await db.prepare(scopedCount.sql).bind(...scopedCount.params).all<{ total: number }>();
        countResult = res.results ?? [];
      } catch {
        countUsedUnscopedFallback = true;
        const unscopedCount = buildCountQuery(false);
        const res = await db.prepare(unscopedCount.sql).bind(...unscopedCount.params).all<{ total: number }>();
        countResult = res.results ?? [];
      }
    } else {
      const unscopedCount = buildCountQuery(false);
      const res = await db.prepare(unscopedCount.sql).bind(...unscopedCount.params).all<{ total: number }>();
      countResult = res.results ?? [];
    }
    const rawCount = countResult[0]?.total;
    const total =
      usedUnscopedFallback && countUsedUnscopedFallback && tenantId !== '*'
        ? filteredTotalBeforeSlice || Number(rawCount || 0)
        : rawCount || 0;

    return jsonResponse({
      success: true,
      items,
      pagination: {
        total: parseInt(total as unknown as string),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    log.error('GetMenu error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch menu', 500);
  }
}

export async function getMenuItem(request: Request, env: Record<string, unknown>, id: string, tenantIdOverride?: string) {
  try {
    const tenantRes = await resolveMenuTenant(request, env, tenantIdOverride);
    if (!tenantRes.ok) {
      return errorResponse(tenantRes.error, tenantRes.status);
    }
    const tenantId = tenantRes.tenantId;
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    let rawItem: MenuItem | undefined;
    try {
      const { results } = await db.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).all<MenuItem>();
      rawItem = (results ?? []).find((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
    } catch {
      const { results } = await db.prepare('SELECT *, category_id as category, is_available as available FROM products WHERE id = ?').bind(id).all<MenuItem>();
      rawItem = (results ?? []).find((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
    }
    if (!rawItem) {
      try {
        const { results } = await db.prepare('SELECT *, category_id as category, is_available as available FROM products WHERE id = ?').bind(id).all<MenuItem>();
        rawItem = (results ?? []).find((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        // Ignore if products fallback fails after menu_items succeeded
      }
    }
    if (!rawItem || !matchesTenantRow(rawItem as unknown as Record<string, unknown>, tenantId)) {
      return errorResponse('Menu item not found', 404);
    }

    const item = {
      ...rawItem,
      tags: parseTags(rawItem.tags),
      price: parseInt(rawItem.price as unknown as string),
      available: toAvailabilityFlag(rawItem.available ?? (rawItem as unknown as { is_available?: unknown }).is_available)
    };

    return jsonResponse({ success: true, item });
  } catch (error) {
    log.error('GetMenuItem error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch menu item', 500);
  }
}
