/**
 * Menu Projection Policy & Synchronization Engine
 * Canonical Source of Truth: `products` table
 * Read Projection: `menu_items` table (customer-safe fields for public GET /api/menu)
 *
 * Enforces single deterministic projection sync for:
 * - Create: Upsert product into menu_items with resolved category slug
 * - Update: Synchronize name, price, description, image_url, tags, category
 * - Availability Change: Synchronize is_available to available (0/1)
 * - Soft-Delete: Set available = 0 in menu_items
 * - Hard-Delete: Remove record from menu_items
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Product } from '../model/catalog-types';

export interface MenuItemProjection {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  tags: string | null;
  badge: string | null;
  available: number;
}

/**
 * Pure projection mapping from canonical Product to customer-safe MenuItem row.
 * Excludes internal fields (compare_at_price, cost, supplier, sku).
 */
export function mapProductToMenuProjection(
  product: Product,
  categorySlug?: string | null
): MenuItemProjection {
  const category = categorySlug || product.category_name || product.category_id || 'other';
  let formattedTags: string | null = null;
  if (product.tags) {
    formattedTags = typeof product.tags === 'string' ? product.tags : JSON.stringify(product.tags);
  }

  return {
    id: product.id,
    category,
    name: product.name,
    price: product.price,
    description: product.description || '',
    image_url: product.image_url || '',
    tags: formattedTags,
    badge: product.badge || null,
    available: product.is_available ? 1 : 0,
  };
}

/**
 * Synchronize a single product from canonical `products` table to `menu_items` projection.
 */
export async function syncProductToMenuProjection(db: D1Database, productId: string): Promise<void> {
  const query = `
    SELECT p.*, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;
  const row = (await db.prepare(query).bind(productId).first()) as (Product & { category_slug?: string }) | null;
  if (!row) return;

  const projection = mapProductToMenuProjection(row, row.category_slug);

  const upsertSql = `
    INSERT INTO menu_items (id, category, name, price, description, image_url, tags, badge, available, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      name = excluded.name,
      price = excluded.price,
      description = excluded.description,
      image_url = excluded.image_url,
      tags = excluded.tags,
      badge = excluded.badge,
      available = excluded.available,
      updated_at = CURRENT_TIMESTAMP
  `;

  await db.prepare(upsertSql).bind(
    projection.id,
    projection.category,
    projection.name,
    projection.price,
    projection.description,
    projection.image_url,
    projection.tags,
    projection.badge,
    projection.available
  ).run();
}

/**
 * Synchronize availability changes (active/inactive or soft-delete) to menu_items.
 */
export async function syncProductAvailabilityProjection(
  db: D1Database,
  productId: string,
  isAvailable: boolean | number
): Promise<void> {
  const availableFlag = isAvailable ? 1 : 0;
  await db.prepare(
    'UPDATE menu_items SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(availableFlag, productId).run();
}

/**
 * Delete corresponding projection item from menu_items when hard-deleted.
 */
export async function deleteProductProjection(db: D1Database, productId: string): Promise<void> {
  await db.prepare('DELETE FROM menu_items WHERE id = ?').bind(productId).run();
}

/**
 * Update projection category slugs when a category slug is updated.
 */
export async function syncCategorySlugToMenuProjection(
  db: D1Database,
  categoryId: string,
  newSlug: string
): Promise<void> {
  await db.prepare(`
    UPDATE menu_items
    SET category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT id FROM products WHERE category_id = ?)
  `).bind(newSlug, categoryId).run();
}

/**
 * Reconciles all canonical products into menu_items projection to heal any drift.
 */
export async function reconcileAllMenuProjections(db: D1Database): Promise<{ count: number }> {
  const { results } = await db.prepare(`
    SELECT p.*, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `).all<Product & { category_slug?: string }>();

  const products = results || [];
  for (const product of products) {
    const proj = mapProductToMenuProjection(product, product.category_slug);
    await db.prepare(`
      INSERT INTO menu_items (id, category, name, price, description, image_url, tags, badge, available, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        name = excluded.name,
        price = excluded.price,
        description = excluded.description,
        image_url = excluded.image_url,
        tags = excluded.tags,
        badge = excluded.badge,
        available = excluded.available,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      proj.id,
      proj.category,
      proj.name,
      proj.price,
      proj.description,
      proj.image_url,
      proj.tags,
      proj.badge,
      proj.available
    ).run();
  }
  return { count: products.length };
}
