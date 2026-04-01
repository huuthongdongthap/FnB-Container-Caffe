/**
 * Menu Routes
 * API endpoints cho menu operations
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

// Debug logging configuration
const DEBUG = typeof FNB_DEBUG !== 'undefined' && FNB_DEBUG;

/**
 * GET /api/menu
 * Query params: category, available, search, limit, offset
 */
export async function getMenu(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const available = url.searchParams.get('available');
    const search = url.searchParams.get('search');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';

    let query = 'SELECT * FROM menu_items WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (available !== null) {
      query += ' AND available = ?';
      params.push(available === 'true' ? 1 : 0);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY category, name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await env.FNB_DB.prepare(query).bind(...params).all();

    // Parse JSON fields
    const items = results.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags) : [],
      price: parseInt(item.price),
      available: Boolean(item.available),
    }));

    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM menu_items WHERE 1=1' +
      (category ? ' AND category = ?' : '') +
      (available !== null ? ' AND available = ?' : '') +
      (search ? ' AND (name LIKE ? OR description LIKE ?)' : '');

    const countParams = [];
    if (category) {countParams.push(category);}
    if (available !== null) {countParams.push(available === 'true' ? 1 : 0);}
    if (search) {countParams.push(`%${search}%`, `%${search}%`);}

    const { results: countResult } = await env.FNB_DB.prepare(countQuery).bind(...countParams).all();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      items,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    if (DEBUG) {console.error('GetMenu error:', error);}
    return errorResponse('Failed to fetch menu: ' + error.message, 500);
  }
}

/**
 * GET /api/menu/:id
 */
export async function getMenuItem(request, env, id) {
  try {
    const { results } = await env.FNB_DB
      .prepare('SELECT * FROM menu_items WHERE id = ?')
      .bind(id)
      .all();

    if (!results || results.length === 0) {
      return errorResponse('Menu item not found', 404);
    }

    const item = {
      ...results[0],
      tags: results[0].tags ? JSON.parse(results[0].tags) : [],
      price: parseInt(results[0].price),
      available: Boolean(results[0].available),
    };

    return jsonResponse({ success: true, item });
  } catch (error) {
    if (DEBUG) {console.error('GetMenuItem error:', error);}
    return errorResponse('Failed to fetch menu item: ' + error.message, 500);
  }
}
