import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { ProductRoutes } from '@aura/domain-catalog';
import type { Env } from '../../types/env';
import { formatProduct, type ProductRow } from './helpers';

export function registerProductReadHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  // GET /api/products - List products with pagination, filtering, and search
  router.openapi(ProductRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
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
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (minPrice !== undefined) {
      whereClause += ' AND p.base_price >= ?';
      params.push(minPrice);
    }
    if (maxPrice !== undefined) {
      whereClause += ' AND p.base_price <= ?';
      params.push(maxPrice);
    }
    if (tags) {
      whereClause += ' AND p.tags LIKE ?';
      params.push(`%${tags}%`);
    }

    // Get total count
    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`
    ).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Get products with translations
    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
       FROM products p
       LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(locale, ...params, limit, offset).all<ProductRow>();

    const products = rows.results.map((row) => formatProduct(row, locale));

    return c.json({
      success: true,
      data: { products, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/products/:id - Get product by ID
  router.openapi(ProductRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param' as never) as { id: string };
    const locale = c.req.query('locale') || 'vi';

    const row = await db.prepare(
      `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
       FROM products p
       LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
       WHERE p.id = ?`
    ).bind(locale, id).first<ProductRow>();

    if (!row) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatProduct(row, locale),
    });
  });

  // GET /api/products/slug/:slug - Get product by slug
  router.openapi(ProductRoutes.getBySlug, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { slug } = c.req.valid('param' as never) as { slug: string };
    const locale = c.req.query('locale') || 'vi';

    const row = await db.prepare(
      `SELECT p.*, pt.name as translation_name, pt.description as translation_description, pt.ingredients as translation_ingredients, pt.allergens as translation_allergens, pt.story as translation_story
       FROM products p
       LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = ?
       WHERE p.slug = ?`
    ).bind(locale, slug).first<ProductRow>();

    if (!row) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      data: formatProduct(row, locale),
    });
  });
}
