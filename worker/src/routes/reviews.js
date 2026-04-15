/**
 * Reviews Routes
 * GET  /api/reviews       — list reviews with rating filter + pagination
 * POST /api/reviews       — submit a new review
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

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
    const body = await request.json();
    const { customer_name, rating, content, tags } = body;

    if (!customer_name || !customer_name.trim()) {
      return errorResponse('customer_name is required', 400);
    }
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return errorResponse('rating must be a number between 1 and 5', 400);
    }
    if (!content || !content.trim()) {
      return errorResponse('content is required', 400);
    }

    const tagsJson = tags ? JSON.stringify(tags) : null;

    const result = await env.AURA_DB.prepare(
      'INSERT INTO reviews (customer_name, rating, content, tags, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(customer_name.trim(), rating, content.trim(), tagsJson, 'pending').run();

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
