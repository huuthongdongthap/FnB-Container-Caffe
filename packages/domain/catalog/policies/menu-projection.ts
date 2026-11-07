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

function resolveProjectionTenant(tenantId?: string | null, fallbackTenant?: string | null): string {
  const candidate = tenantId && tenantId.trim() ? tenantId : fallbackTenant;
  return candidate && candidate.trim() && candidate.trim() !== '*' ? candidate.trim() : 'default';
}

/**
 * Synchronize a single product from canonical `products` table to `menu_items` projection.
 */
export async function syncProductToMenuProjection(
  db: D1Database,
  productId: string,
  tenantId?: string
): Promise<void> {
  const scopedQuery = `
    SELECT p.*, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
      AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
    WHERE p.id = ?
  `;
  const unscopedQuery = `
    SELECT p.*, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;
  let row: (Product & { category_slug?: string }) | null = null;
  try {
    row = (await db.prepare(scopedQuery).bind(productId).first()) as (Product & { category_slug?: string }) | null;
  } catch {
    if (!tenantId || !tenantId.trim() || tenantId.trim() === 'default') {
      row = (await db.prepare(unscopedQuery).bind(productId).first()) as (Product & { category_slug?: string }) | null;
    }
  }
  if (!row) return;

  const projection = mapProductToMenuProjection(row, row.category_slug);
  const rawTenant = (row as unknown as { tenant_id?: string | null }).tenant_id;
  const effectiveTenant = resolveProjectionTenant(tenantId, rawTenant);

  const upsertWithTenantGuardSql = `
    INSERT INTO menu_items (id, category, name, price, description, image_url, tags, badge, available, tenant_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      name = excluded.name,
      price = excluded.price,
      description = excluded.description,
      image_url = excluded.image_url,
      tags = excluded.tags,
      badge = excluded.badge,
      available = excluded.available,
      tenant_id = excluded.tenant_id,
      updated_at = CURRENT_TIMESTAMP
    WHERE COALESCE(NULLIF(TRIM(menu_items.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(excluded.tenant_id), ''), 'default')
  `;

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

  try {
    await db.prepare(upsertWithTenantGuardSql).bind(
      projection.id,
      projection.category,
      projection.name,
      projection.price,
      projection.description,
      projection.image_url,
      projection.tags,
      projection.badge,
      projection.available,
      effectiveTenant
    ).run();
  } catch {
    if (effectiveTenant === 'default') {
      try {
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
        return;
      } catch {
        // Fall through to tenant-scoped UPDATE fallback
      }
    }
    try {
      await db.prepare(
        "UPDATE menu_items SET category = ?, name = ?, price = ?, description = ?, image_url = ?, tags = ?, badge = ?, available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(
        projection.category,
        projection.name,
        projection.price,
        projection.description,
        projection.image_url,
        projection.tags,
        projection.badge,
        projection.available,
        projection.id,
        effectiveTenant
      ).run();
    } catch {
      // Graceful fallback when menu_items projection table or columns are unmigrated
    }
  }
}

export const projectProductToMenu = syncProductToMenuProjection;

/**
 * Synchronize availability changes (active/inactive or soft-delete) to menu_items.
 */
export async function syncProductAvailabilityProjection(
  db: D1Database,
  productId: string,
  isAvailable: boolean | number,
  tenantId?: string
): Promise<void> {
  const availableFlag = isAvailable ? 1 : 0;
  let resolvedTenant = tenantId;
  if (!resolvedTenant) {
    const prodRow = await db.prepare('SELECT tenant_id FROM products WHERE id = ?').bind(productId).first<{ tenant_id?: string | null }>().catch(() => null);
    resolvedTenant = prodRow?.tenant_id ?? 'default';
  }
  const effectiveTenant = resolveProjectionTenant(resolvedTenant);
  try {
    await db.prepare(
      "UPDATE menu_items SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(availableFlag, productId, effectiveTenant).run();
  } catch {
    try {
      await db.prepare(
        "UPDATE menu_items SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(availableFlag, productId, effectiveTenant).run();
    } catch {
      if (effectiveTenant === 'default') {
        try {
          await db.prepare(
            'UPDATE menu_items SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).bind(availableFlag, productId).run();
        } catch {
          // Graceful fallback when menu_items projection table is unmigrated
        }
      }
    }
  }
}

/**
 * Delete corresponding projection item from menu_items when hard-deleted.
 */
export async function deleteProductProjection(
  db: D1Database,
  productId: string,
  tenantId?: string
): Promise<void> {
  const effectiveTenant = resolveProjectionTenant(tenantId);
  try {
    await db.prepare(
      "DELETE FROM menu_modifiers WHERE item_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(productId, effectiveTenant).run();
  } catch {
    if (effectiveTenant === 'default') {
      try {
        await db.prepare('DELETE FROM menu_modifiers WHERE item_id = ?').bind(productId).run();
      } catch {
        // Ignore when menu_modifiers has no item_id column or is unmigrated
      }
    }
  }
  try {
    await db.prepare(
      "DELETE FROM menu_items WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(productId, effectiveTenant).run();
  } catch {
    if (effectiveTenant === 'default') {
      try {
        await db.prepare('DELETE FROM menu_items WHERE id = ?').bind(productId).run();
      } catch {
        // Graceful fallback when menu_items projection table is unmigrated
      }
    }
  }
}

export const removeMenuProjection = deleteProductProjection;

/**
 * Update projection category slugs when a category slug is updated.
 */
export async function syncCategorySlugToMenuProjection(
  db: D1Database,
  categoryId: string,
  newSlug: string,
  tenantId?: string
): Promise<void> {
  let resolvedTenant = tenantId;
  if (!resolvedTenant) {
    const catRow = await db.prepare('SELECT tenant_id FROM categories WHERE id = ?').bind(categoryId).first<{ tenant_id?: string | null }>().catch(() => null);
    resolvedTenant = catRow?.tenant_id ?? 'default';
  }
  const effectiveTenant = resolveProjectionTenant(resolvedTenant);
  try {
    await db.prepare(`
      UPDATE menu_items
      SET category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM products
        WHERE category_id = ?
          AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
      )
      AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
    `).bind(newSlug, categoryId, effectiveTenant, effectiveTenant).run();
  } catch {
    if (effectiveTenant === 'default') {
      try {
        await db.prepare(`
          UPDATE menu_items
          SET category = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id IN (SELECT id FROM products WHERE category_id = ?)
        `).bind(newSlug, categoryId).run();
      } catch {
        // Graceful fallback when menu_items projection table is unmigrated
      }
    }
  }
}

/**
 * Reconciles all canonical products into menu_items projection to heal any drift.
 */
export async function reconcileAllMenuProjections(db: D1Database): Promise<{ count: number }> {
  let results: Array<Product & { category_slug?: string }> | undefined;
  try {
    const res = await db.prepare(`
      SELECT p.*, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
        AND COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default')
    `).all<Product & { category_slug?: string }>();
    results = res.results;
  } catch {
    const res = await db.prepare(`
      SELECT p.*, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `).all<Product & { category_slug?: string }>();
    results = res.results;
  }

  const products = results || [];
  for (const product of products) {
    const proj = mapProductToMenuProjection(product, product.category_slug);
    const rawTenant = (product as unknown as { tenant_id?: string | null }).tenant_id;
    const effectiveTenant = rawTenant && String(rawTenant).trim() ? String(rawTenant).trim() : 'default';
    try {
      await db.prepare(`
        INSERT INTO menu_items (id, category, name, price, description, image_url, tags, badge, available, tenant_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          name = excluded.name,
          price = excluded.price,
          description = excluded.description,
          image_url = excluded.image_url,
          tags = excluded.tags,
          badge = excluded.badge,
          available = excluded.available,
          tenant_id = excluded.tenant_id,
          updated_at = CURRENT_TIMESTAMP
        WHERE COALESCE(NULLIF(TRIM(menu_items.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(excluded.tenant_id), ''), 'default')
      `).bind(
        proj.id,
        proj.category,
        proj.name,
        proj.price,
        proj.description,
        proj.image_url,
        proj.tags,
        proj.badge,
        proj.available,
        effectiveTenant
      ).run();
    } catch {
      if (effectiveTenant === 'default') {
        try {
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
        } catch {
          // Graceful fallback when menu_items projection table is unmigrated
        }
      }
    }
  }
  return { count: products.length };
}

export interface ModifierChoiceProjection {
  id: string;
  group_id: string;
  option_name: string;
  price_delta: number;
  available: number;
}

/**
 * Pure projection mapping from canonical ModifierChoice to customer-safe projection row.
 * Uses option_name, price_delta, and available to match menu_modifiers projection contract.
 */
export function mapModifierChoiceToProjection(
  choice: { id: string; group_id: string; name: string; price_delta: number; is_available?: number | boolean }
): ModifierChoiceProjection {
  const isAvailable = choice.is_available === undefined || choice.is_available === true || choice.is_available === 1;
  return {
    id: choice.id,
    group_id: choice.group_id,
    option_name: choice.name,
    price_delta: Math.max(0, Math.round(Number(choice.price_delta) || 0)),
    available: isAvailable ? 1 : 0,
  };
}

/**
 * Synchronize modifier choice to menu_modifiers projection if table exists.
 */
export async function syncModifierChoiceToMenuProjection(
  db: D1Database,
  choice: {
    id: string;
    group_id: string;
    name: string;
    price_delta: number;
    is_available?: number | boolean;
    tenant_id?: string | null;
  },
  tenantId?: string
): Promise<void> {
  const proj = mapModifierChoiceToProjection(choice);
  let resolvedTenant = tenantId ?? choice.tenant_id ?? null;
  if (!resolvedTenant) {
    const grp = await db.prepare('SELECT tenant_id FROM modifier_groups WHERE id = ?').bind(choice.group_id).first<{ tenant_id?: string | null }>().catch(() => null);
    resolvedTenant = grp?.tenant_id ?? 'default';
  }
  const effectiveTenant = resolveProjectionTenant(resolvedTenant);
  try {
    await db.prepare(`
      INSERT INTO menu_modifiers (id, group_id, option_name, price_delta, available, tenant_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        group_id = excluded.group_id,
        option_name = excluded.option_name,
        price_delta = excluded.price_delta,
        available = excluded.available,
        tenant_id = excluded.tenant_id,
        updated_at = CURRENT_TIMESTAMP
      WHERE COALESCE(NULLIF(TRIM(menu_modifiers.tenant_id), ''), 'default') = ?
    `).bind(proj.id, proj.group_id, proj.option_name, proj.price_delta, proj.available, effectiveTenant, effectiveTenant).run();
  } catch (err) {
    if (effectiveTenant === 'default') {
      try {
        await db.prepare(`
          INSERT INTO menu_modifiers (id, group_id, option_name, price_delta, available, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            option_name = excluded.option_name,
            price_delta = excluded.price_delta,
            available = excluded.available,
            updated_at = CURRENT_TIMESTAMP
        `).bind(proj.id, proj.group_id, proj.option_name, proj.price_delta, proj.available).run();
        return;
      } catch {
        // Fall through to tenant-scoped UPDATE fallback
      }
    }
    try {
      await db.prepare(
        "UPDATE menu_modifiers SET group_id = ?, option_name = ?, price_delta = ?, available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(proj.group_id, proj.option_name, proj.price_delta, proj.available, proj.id, effectiveTenant).run();
    } catch {
      console.error('[menu-projection] modifier sync failed', choice.id, err);
    }
  }
}

export const upsertMenuItemModifier = syncModifierChoiceToMenuProjection;

/**
 * Synchronize modifier group active status to menu_modifiers projection availability.
 */
export async function syncModifierGroupAvailabilityToMenuProjection(
  db: D1Database,
  groupId: string,
  isActive: number | boolean,
  tenantId?: string
): Promise<void> {
  const activeFlag = isActive === true || isActive === 1 ? 1 : 0;
  let resolvedTenant = tenantId;
  if (!resolvedTenant) {
    const grp = await db.prepare('SELECT tenant_id FROM modifier_groups WHERE id = ?').bind(groupId).first<{ tenant_id?: string | null }>().catch(() => null);
    resolvedTenant = grp?.tenant_id ?? 'default';
  }
  const effectiveTenant = resolveProjectionTenant(resolvedTenant);
  try {
    if (activeFlag === 0) {
      await db.prepare(
        "UPDATE menu_modifiers SET available = 0, updated_at = CURRENT_TIMESTAMP WHERE group_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(groupId, effectiveTenant).run();
      return;
    }
    await db.prepare(
      `UPDATE menu_modifiers
       SET available = COALESCE((SELECT mc.is_available FROM modifier_choices mc WHERE mc.id = menu_modifiers.id), 1),
           updated_at = CURRENT_TIMESTAMP
       WHERE group_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(groupId, effectiveTenant).run();
    return;
  } catch {
    if (effectiveTenant !== 'default') {
      return;
    }
  }
  try {
    if (activeFlag === 0) {
      await db.prepare(
        'UPDATE menu_modifiers SET available = 0, updated_at = CURRENT_TIMESTAMP WHERE group_id = ?'
      ).bind(groupId).run();
    } else {
      try {
        await db.prepare(
          `UPDATE menu_modifiers
           SET available = COALESCE((SELECT mc.is_available FROM modifier_choices mc WHERE mc.id = menu_modifiers.id), 1),
               updated_at = CURRENT_TIMESTAMP
           WHERE group_id = ?`
        ).bind(groupId).run();
      } catch {
        await db.prepare(
          'UPDATE menu_modifiers SET available = 1, updated_at = CURRENT_TIMESTAMP WHERE group_id = ?'
        ).bind(groupId).run();
      }
    }
  } catch {
    try {
      await db.prepare('UPDATE menu_modifiers SET available = ? WHERE group_id = ?').bind(activeFlag, groupId).run();
    } catch {
      // Best-effort sync for environments or minimal mocks without menu_modifiers
    }
  }
}
