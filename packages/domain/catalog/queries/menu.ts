/**
 * Menu Queries
 * Converted from routes/menu.js with TypeScript + typed query params.
 * Business logic preserved exactly.
 */
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import type { MenuItem } from 'worker/src/types/models';
import { parseAvailabilityFilter, toAvailabilityFlag } from '../policies/availability';

const log = createLogger({ route: 'menu' });

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

export async function getMenu(request: Request, env: Record<string, unknown>) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const available = url.searchParams.get('available');
    const search = url.searchParams.get('search');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    let query = 'SELECT * FROM menu_items WHERE 1=1';
    const params: unknown[] = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    const availableFlag = parseAvailabilityFilter(available);
    if (availableFlag !== null) {
      query += ' AND available = ?';
      params.push(availableFlag);
    }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY category, name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    let results: MenuItem[] = [];
    let useProductsFallback = false;
    try {
      const res = await db.prepare(query).bind(...params).all<MenuItem>();
      results = res.results ?? [];
    } catch {
      useProductsFallback = true;
      let prodQuery = 'SELECT *, category_id as category, is_available as available FROM products WHERE 1=1';
      const prodParams: unknown[] = [];
      if (category) {
        prodQuery += ' AND category_id = ?';
        prodParams.push(category);
      }
      if (availableFlag !== null) {
        prodQuery += ' AND is_available = ?';
        prodParams.push(availableFlag);
      }
      if (search) {
        prodQuery += ' AND (name LIKE ? OR description LIKE ?)';
        prodParams.push(`%${search}%`, `%${search}%`);
      }
      prodQuery += ' ORDER BY category_id, name LIMIT ? OFFSET ?';
      prodParams.push(parseInt(limit), parseInt(offset));
      const res = await db.prepare(prodQuery).bind(...prodParams).all<MenuItem>();
      results = res.results ?? [];
    }

    const items = (results ?? []).map((item: MenuItem) => ({
      ...item,
      tags: parseTags(item.tags),
      price: parseInt(item.price as unknown as string),
      available: toAvailabilityFlag(item.available ?? (item as unknown as { is_available?: unknown }).is_available)
    }));

    const tableName = useProductsFallback ? 'products' : 'menu_items';
    const catCol = useProductsFallback ? 'category_id' : 'category';
    const availCol = useProductsFallback ? 'is_available' : 'available';
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} WHERE 1=1${
      category ? ` AND ${catCol} = ?` : ''
    }${availableFlag !== null ? ` AND ${availCol} = ?` : ''
    }${search ? ' AND (name LIKE ? OR description LIKE ?)' : ''}`;

    const countParams: unknown[] = [];
    if (category) {
      countParams.push(category);
    }
    if (availableFlag !== null) {
      countParams.push(availableFlag);
    }
    if (search) {
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const { results: countResult } = await db.prepare(countQuery).bind(...countParams).all<{ total: number }>();
    const total = countResult[0]?.total || 0;

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

export async function getMenuItem(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    let rawItem: MenuItem | undefined;
    try {
      const { results } = await db.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).all<MenuItem>();
      rawItem = results?.[0];
    } catch {
      const { results } = await db.prepare('SELECT *, category_id as category, is_available as available FROM products WHERE id = ?').bind(id).all<MenuItem>();
      rawItem = results?.[0];
    }
    if (!rawItem) {
      try {
        const { results } = await db.prepare('SELECT *, category_id as category, is_available as available FROM products WHERE id = ?').bind(id).all<MenuItem>();
        rawItem = results?.[0];
      } catch {
        // Ignore if products fallback fails after menu_items succeeded
      }
    }
    if (!rawItem) {
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
