/**
 * Reviews Routes
 * GET  /api/reviews       — list reviews with rating filter + pagination
 * POST /api/reviews       — submit a new review
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

async function throttle(request, env, key, max, windowSec) {
  const kv = env.AUTH_KV;
  if (!kv) return true;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const fullKey = `rl:${key}:${ip}`;
  const cur = parseInt(await kv.get(fullKey) || '0', 10);
  if (cur >= max) return false;
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

/**
 * GET /api/reviews?rating=5&page=1&limit=20&status=approved
 */
export async function getReviews(request, env) {
  try {
    const url = new URL(request.url);
    const rating = url.searchParams.get('rating');
    const status = url.searchParams.get('status') || 'approved';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM reviews WHERE 1=1';
    const params = [];

    if (rating) {
      query += ' AND rating = ?';
      params.push(parseInt(rating));
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await env.AURA_DB.prepare(query).bind(...params).all();

    // Count query
    let countQuery = 'SELECT COUNT(*) as total FROM reviews WHERE 1=1';
    const countParams = [];
    if (rating) { countQuery += ' AND rating = ?'; countParams.push(parseInt(rating)); }
    if (status) { countQuery += ' AND status = ?'; countParams.push(status); }

    const { results: countResult } = await env.AURA_DB.prepare(countQuery).bind(...countParams).all();
    const total = countResult[0]?.total || 0;

    const items = (results || []).map(r => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : [],
      rating: parseInt(r.rating),
    }));

    return jsonResponse({
      success: true,
      reviews: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (error) {
    return errorResponse('Failed to fetch reviews: ' + error.message, 500);
  }
}

/**
 * POST /api/reviews
 * Body: { customer_name, rating (1-5), content, tags? }
 */
export async function createReview(request, env) {
  try {
    // Throttle: 3 reviews / hour / IP
    if (!(await throttle(request, env, 'rev', 3, 3600))) {
      return errorResponse('Quá nhiều đánh giá, vui lòng thử lại sau', 429);
    }

    const body = await request.json();
    const { customer_name, rating, content, tags } = body;

    if (!customer_name || !customer_name.trim() || customer_name.length > 80) {
      return errorResponse('customer_name is required (max 80 chars)', 400);
    }
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return errorResponse('rating must be a number between 1 and 5', 400);
    }
    if (!content || !content.trim() || content.length > 2000) {
      return errorResponse('content is required (max 2000 chars)', 400);
    }

    const tagsJson = tags && Array.isArray(tags) ? JSON.stringify(tags.slice(0, 10)) : null;

    const result = await env.AURA_DB.prepare(
      'INSERT INTO reviews (customer_name, rating, content, tags, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(customer_name.trim().slice(0, 80), rating, content.trim().slice(0, 2000), tagsJson, 'pending').run();

    return jsonResponse({
      success: true,
      message: 'Review submitted successfully. Pending approval.',
      id: result.lastRowId,
    }, 201);
  } catch (error) {
    return errorResponse('Failed to create review: ' + error.message, 500);
  }
}

/**
 * Router dispatcher for /api/reviews*
 */
export const reviewsRouter = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/reviews' && method === 'GET') {
      return getReviews(request, env);
    }
    if (path === '/api/reviews' && method === 'POST') {
      return createReview(request, env);
    }
    return errorResponse('Not Found', 404);
  },
};
