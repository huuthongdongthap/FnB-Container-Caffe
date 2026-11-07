import type { OpenAPIHono } from '@hono/zod-openapi';
import { ProductRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import {
  FORBIDDEN_TENANT_SENTINEL,
  formatProduct,
  matchesCatalogTenant,
  resolveCatalogTenantId,
  type ProductRow,
} from './helpers';
import { getDatabase } from '../../lib/db';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';

function verifyProductReadTenant(c: any): { ok: true; tenantId: string } | { ok: false; status: 403; error: string } {
  const resolved = resolveCatalogTenantId(c);
  if (resolved === FORBIDDEN_TENANT_SENTINEL) {
    return { ok: false, status: 403, error: 'Cross-tenant product read denied' };
  }
  const user = c.get('user') as { id?: string; role?: string; tenant_id?: string; tenantId?: string } | undefined;
  if (user && !isHQSuperAdmin(c)) {
    const userTenant = (user.tenant_id || user.tenantId || '').trim() || 'default';
    const ctxTenant = getTenantId(c).trim() || 'default';
    if (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant) {
      return { ok: false, status: 403, error: 'Cross-tenant product read denied' };
    }
    return { ok: true, tenantId: userTenant };
  }
  return { ok: true, tenantId: resolved };
}

export function registerProductReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // GET /api/products - List products with pagination, filtering, and search
  router.openapi(ProductRoutes.list as any, async (c: any) => {
    const tenantCheck = verifyProductReadTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
    }
    const db = getDatabase(c);
    const query = c.req.valid('query' as never) as {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      search?: string;
      categoryId?: string;
      status?: string;
      locale?: string;
      minPrice?: number;
      maxPrice?: number;
      tags?: string;
    };
    const { page = 1, limit = 20, sort = 'name', order = 'asc', search, categoryId, status, locale = 'vi', minPrice, maxPrice, tags } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId) {
      whereClause += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (status) {
      whereClause += ' AND p.is_available = ?';
      params.push(status === 'active' ? 1 : 0);
    }
    if (minPrice !== undefined) {
      whereClause += ' AND p.price >= ?';
      params.push(minPrice);
    }
    if (maxPrice !== undefined) {
      whereClause += ' AND p.price <= ?';
      params.push(maxPrice);
    }
    if (tags) {
      whereClause += ' AND p.tags LIKE ?';
      params.push(`%${tags}%`);
    }

    const tenantId = tenantCheck.tenantId;
    const safePage = Number.isFinite(Number(page)) && Number(page) >= 1 ? Math.floor(Number(page)) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) >= 1 ? Math.min(Math.floor(Number(limit)), 100) : 20;

    // Get products directly from canonical products table and filter by tenant before slicing
    const offset = (safePage - 1) * safeLimit;
    const allowedSorts: Record<string, string> = {
      sort_order: 'p.sort_order',
      name: 'p.name',
      price: 'p.price',
      created_at: 'p.created_at',
      updated_at: 'p.updated_at',
    };
    const safeSort = allowedSorts[sort] || 'p.sort_order';
    const safeDirection = (order?.toLowerCase() === 'desc') ? 'DESC' : 'ASC';
    const orderClause = `${safeSort} ${safeDirection}`;
    let rows: { results: ProductRow[] };
    try {
      rows = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
           AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
         ${whereClause}
         ORDER BY ${orderClause}`
      ).bind(...params).all()) as { results: ProductRow[] };
    } catch (err) {
      if (tenantId !== 'default') throw err;
      rows = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause}
         ORDER BY ${orderClause}`
      ).bind(...params).all()) as { results: ProductRow[] };
    }

    const rawRows = rows.results || [];
    const filteredRows = rawRows.filter((row) => matchesCatalogTenant(row, tenantId));
    const total = filteredRows.length;
    const pagedRows = filteredRows.slice(offset, offset + safeLimit);
    const products = pagedRows.map((row) => formatProduct(row, locale));

    return c.json({
      success: true,
      data: { products, meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } },
    });
  });

  // GET /api/products/:id - Get product by ID
  router.openapi(ProductRoutes.get as any, async (c: any) => {
    const tenantCheck = verifyProductReadTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
    }
    const db = getDatabase(c);
    const tenantId = tenantCheck.tenantId;
    const { id } = c.req.valid('param' as never) as { id: string };
    const locale = c.req.query('locale') || 'vi';

    let row: ProductRow | null = null;
    try {
      row = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
           AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
         WHERE p.id = ?`
      ).bind(id).first()) as ProductRow | null;
    } catch (err) {
      if (tenantId !== 'default') throw err;
      row = (await db.prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      ).bind(id).first()) as ProductRow | null;
    }

    if (!row || !matchesCatalogTenant(row, tenantId)) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatProduct(row, locale),
    });
  });

  // GET /api/products/slug/:slug - Get product by slug
  router.openapi(ProductRoutes.getBySlug as any, async (c: any) => {
    const tenantCheck = verifyProductReadTenant(c);
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: tenantCheck.error }, tenantCheck.status);
    }
    const db = getDatabase(c);
    const tenantId = tenantCheck.tenantId;
    const { slug } = c.req.valid('param' as never) as { slug: string };
    const locale = c.req.query('locale') || 'vi';

    const scopedSlugSql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
        AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
      WHERE p.slug = ?
    `;
    const unscopedSlugSql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.slug = ?
    `;

    let row: ProductRow | null = null;
    try {
      row = (await db.prepare(scopedSlugSql).bind(slug).first()) as ProductRow | null;
    } catch (err) {
      if (tenantId !== 'default') throw err;
      row = (await db.prepare(unscopedSlugSql).bind(slug).first()) as ProductRow | null;
    }

    if (row && !matchesCatalogTenant(row, tenantId)) {
      let allRows: { results?: ProductRow[] } = { results: [] };
      try {
        allRows = (await db.prepare(scopedSlugSql).bind(slug).all()) as { results?: ProductRow[] };
      } catch (err) {
        if (tenantId !== 'default') throw err;
        allRows = (await db.prepare(unscopedSlugSql).bind(slug).all().catch(() => ({ results: [] }))) as { results?: ProductRow[] };
      }
      row = (allRows.results || []).find((r) => matchesCatalogTenant(r, tenantId)) || null;
    }

    if (!row || !matchesCatalogTenant(row, tenantId)) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatProduct(row, locale),
    });
  });
}
