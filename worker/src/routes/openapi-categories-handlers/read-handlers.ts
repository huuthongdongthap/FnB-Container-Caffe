import type { OpenAPIHono } from '@hono/zod-openapi';
import { CategoryRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { formatCategory, matchesCatalogTenant, resolveCatalogTenantId, type CategoryRow } from './helpers';
import { getDatabase } from '../../lib/db';

export function registerCategoryReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // GET /api/categories - List categories with pagination
  router.openapi(CategoryRoutes.list as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query' as never) as {
      page?: number;
      limit?: number;
      sort?: string;
      order?: string;
      search?: string;
      parentId?: string | null;
      isActive?: boolean;
      locale?: string;
    };
    const { page = 1, limit = 20, sort = 'sort_order', order = 'asc', search, parentId, isActive, locale = 'vi' } = query;

    // Short-circuit if searching for nonexistent child categories
    if (parentId || isActive === false) {
      return c.json({
        success: true,
        data: { categories: [], meta: { page, limit, total: 0, totalPages: 0 } },
      });
    }

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const tenantId = resolveCatalogTenantId(c);
    const safePage = Number.isFinite(Number(page)) && Number(page) >= 1 ? Math.floor(Number(page)) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) >= 1 ? Math.min(Math.floor(Number(limit)), 100) : 20;

    // Get categories directly from canonical categories table and filter by tenant before slicing
    const offset = (safePage - 1) * safeLimit;
    const allowedSorts: Record<string, string> = {
      sort_order: 'c.sort_order',
      name: 'c.name',
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
    };
    const safeSort = allowedSorts[sort] || 'c.sort_order';
    const safeDirection = (order?.toLowerCase() === 'desc') ? 'DESC' : 'ASC';
    const orderClause = `${safeSort} ${safeDirection}`;
    const rows = (await db.prepare(
      `SELECT c.* FROM categories c
       ${whereClause}
       ORDER BY ${orderClause}`
    ).bind(...params).all()) as { results: CategoryRow[] };

    const rawRows = rows.results || [];
    const filteredRows = rawRows.filter((row) => matchesCatalogTenant(row, tenantId));
    const total = filteredRows.length;
    const pagedRows = filteredRows.slice(offset, offset + safeLimit);
    const categories = pagedRows.map((row) => formatCategory(row, locale));

    return c.json({
      success: true,
      data: { categories, meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } },
    });
  });

  // GET /api/categories/tree - Get category tree
  router.openapi(CategoryRoutes.tree as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolveCatalogTenantId(c);
    const query = c.req.valid('query' as never) as {
      locale?: string;
      locationId?: string;
      includeInactive?: boolean;
    };
    const { locale = 'vi', includeInactive } = query;

    if (includeInactive === false) {
      // In canonical DB, categories are active by default
    }

    const rows = (await db.prepare(
      `SELECT c.* FROM categories c ORDER BY c.sort_order ASC, c.name ASC`
    ).all()) as { results: CategoryRow[] };

    const roots = (rows.results || [])
      .filter((row) => matchesCatalogTenant(row, tenantId))
      .map((row) => formatCategory(row, locale));

    return c.json({
      success: true,
      data: roots,
    });
  });

  // GET /api/categories/:id - Get category by ID
  router.openapi(CategoryRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const tenantId = resolveCatalogTenantId(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const locale = c.req.query('locale') || 'vi';

    const row = (await db.prepare(
      `SELECT c.* FROM categories c WHERE c.id = ?`
    ).bind(id).first()) as CategoryRow | null;

    if (!row || !matchesCatalogTenant(row, tenantId)) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatCategory(row, locale),
    });
  });
}
