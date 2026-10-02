import type { OpenAPIHono } from '@hono/zod-openapi';
import { CategoryRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { formatCategory, type CategoryRow } from './helpers';
import { getDatabase } from '../../lib/db';

export function registerCategoryReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // GET /api/categories - List categories with pagination and tree support
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

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (parentId) {
      whereClause += ' AND c.parent_id = ?';
      params.push(parentId);
    } else if (parentId === null) {
      whereClause += ' AND c.parent_id IS NULL';
    }
    if (isActive !== undefined) {
      whereClause += ' AND c.is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    // Get total count
    const countResult = (await db.prepare(
      `SELECT COUNT(*) as total FROM categories c ${whereClause}`
    ).bind(...params).first()) as { total: number } | null;
    const total = countResult?.total || 0;

    // Get categories with translations
    const offset = (page - 1) * limit;
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
      `SELECT c.*, ct.name as translation_name, ct.description as translation_description
       FROM categories c
       LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(locale, ...params, limit, offset).all()) as { results: CategoryRow[] };

    const categories = rows.results.map((row) => formatCategory(row, locale));

    return c.json({
      success: true,
      data: { categories, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/categories/tree - Get category tree
  router.openapi(CategoryRoutes.tree as any, async (c: any) => {
    const db = getDatabase(c);
    const query = c.req.valid('query' as never) as {
      locale?: string;
      locationId?: string;
      includeInactive?: boolean;
    };
    const { locale = 'vi', locationId, includeInactive } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [locale];

    if (locationId) {
      whereClause += ' AND c.location_id = ?';
      params.push(locationId);
    }
    if (!includeInactive) {
      whereClause += ' AND c.is_active = 1';
    }

    const rows = (await db.prepare(
      `SELECT c.*, ct.name as translation_name, ct.description as translation_description
       FROM categories c
       LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
       ${whereClause}
       ORDER BY c.sort_order ASC, c.name ASC`
    ).bind(...params).all()) as { results: CategoryRow[] };

    // Build tree
    const categoryMap = new Map<string, ReturnType<typeof formatCategory>>();
    const roots: ReturnType<typeof formatCategory>[] = [];

    for (const row of rows.results) {
      const cat = formatCategory(row, locale);
      categoryMap.set(row.id, cat);
    }

    for (const cat of categoryMap.values()) {
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(cat);
      } else {
        roots.push(cat);
      }
    }

    return c.json({
      success: true,
      data: roots,
    });
  });

  // GET /api/categories/:id - Get category by ID
  router.openapi(CategoryRoutes.get as any, async (c: any) => {
    const db = getDatabase(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const locale = c.req.query('locale') || 'vi';

    const row = (await db.prepare(
      `SELECT c.*, ct.name as translation_name, ct.description as translation_description
       FROM categories c
       LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.locale = ?
       WHERE c.id = ?`
    ).bind(locale, id).first()) as CategoryRow | null;

    if (!row) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...row,
        translations: row.translation_name ? [{
          locale,
          name: row.translation_name,
          description: row.translation_description,
        }] : [],
        parent_id: row.parent_id,
        location: row.location_id ? { id: row.location_id } : null,
      },
    });
  });
}
