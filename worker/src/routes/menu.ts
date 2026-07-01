/**
 * Menu Routes
 * Converted from routes/menu.js with TypeScript + typed query params.
 * Business logic preserved exactly.
 */

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import type { MenuItem } from '../types/models';

const log = createLogger({ route: 'menu' });

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

    if (available !== null) {
      query += ' AND available = ?';
      params.push((available === 'true' || available === '1') ? 1 : 0);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY category, name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all<MenuItem>();

    const items = results.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags as string) : [],
      price: parseInt(item.price as unknown as string),
      available: Boolean(item.available),
    }));

    const countQuery = 'SELECT COUNT(*) as total FROM menu_items WHERE 1=1' +
      (category ? ' AND category = ?' : '') +
      (available !== null ? ' AND available = ?' : '') +
      (search ? ' AND (name LIKE ? OR description LIKE ?)' : '');

    const countParams: unknown[] = [];
    if (category) { countParams.push(category); }
    if (available !== null) { countParams.push((available === 'true' || available === '1') ? 1 : 0); }
    if (search) { countParams.push(`%${search}%`, `%${search}%`); }

    const { results: countResult } = await db.prepare(countQuery).bind(...countParams).all<{ total: number }>();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      items,
      pagination: {
        total: parseInt(total as unknown as string),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    log.error('GetMenu error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch menu: ' + (error as Error).message, 500);
  }
}

export async function getMenuItem(request: Request, env: Record<string, unknown>, id: string) {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const { results } = await db.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).all<MenuItem>();

    if (!results || results.length === 0) {
      return errorResponse('Menu item not found', 404);
    }

    const item = {
      ...results[0],
      tags: results[0].tags ? JSON.parse(results[0].tags as string) : [],
      price: parseInt(results[0].price as unknown as string),
      available: Boolean(results[0].available),
    };

    return jsonResponse({ success: true, item });
  } catch (error) {
    log.error('GetMenuItem error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch menu item: ' + (error as Error).message, 500);
  }
}
