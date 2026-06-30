/**
 * Signage Routes — Xibo digital signage widget endpoints
 *
 * Public endpoints for local network Xibo players.
 * No auth required, CORS handled by parent router.
 * Cache-Control: public, max-age=300 (5 min).
 *
 * GET /api/signage/menu  — categories with available products
 * GET /api/signage/promos — active promotions
 */

import { Hono } from 'hono';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'signage' });

export const signageRouter = new Hono();

// ── GET /api/signage/menu ──────────────────────────────────────────
signageRouter.get('/menu', async (c) => {
  const db = c.env.AURA_DB;
  try {
    // Join products with categories, filter available, sort by category order then product name
    const { results } = await db.prepare(`
      SELECT
        p.name AS product_name,
        p.price,
        p.image_url,
        p.description,
        p.category_id,
        c.id AS category_id,
        c.name AS category_name,
        c.sort_order AS category_sort_order
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = 1
      ORDER BY c.sort_order ASC, p.name ASC
    `).all();

    // Group products by category
    const categoryMap = new Map();
    for (const row of results || []) {
      const catId = row.category_id;
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: row.category_name,
          sort_order: row.category_sort_order,
          products: [],
        });
      }
      categoryMap.get(catId).products.push({
        name: row.product_name,
        price: row.price,
        image: row.image_url || '',
        description: row.description || '',
      });
    }

    // Flatten to array sorted by category sort_order
    const data = Array.from(categoryMap.values())
      .sort((a, b) => a.sort_order - b.sort_order);

    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data });
  } catch (e) {
    log.error('signage_menu_failed', { error: e.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── GET /api/signage/promos ─────────────────────────────────────────
signageRouter.get('/promos', async (c) => {
  const db = c.env.AURA_DB;
  try {
    const { results } = await db.prepare(
      'SELECT code, percent, max_discount, min_order, expires_at FROM promotions WHERE is_active = 1'
    ).all();

    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data: results || [] });
  } catch (e) {
    log.error('signage_promos_failed', { error: e.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
