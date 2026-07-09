/**
 * Reviews Routes — /api/reviews
 */

import { Hono } from 'hono';
import { createReviewSchema } from '../lib/validators';
import type { Env } from '../types/env';

interface ReviewInput {
  order_id: string;
  rating: number;
  comment?: string;
  customer_name?: string;
}

interface ReviewRecord {
  id: string;
  order_id: string;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}

export const reviewsRouter = new Hono<{ Bindings: Env }>();

// POST /api/reviews — submit a review
reviewsRouter.post('/', async(c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const data = parsed.data;
  const rating = data.rating;

  const id = `rev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO reviews (id, order_id, rating, comment, customer_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, data.order_id, rating, data.comment || '', data.customer_name || 'Anonymous', now).run();

  const row = await db.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first<ReviewRecord>();
  return c.json({ success: true, data: row }, 201);
});

// GET /api/reviews — paginated list
reviewsRouter.get('/', async(c) => {
  const db = c.env.AURA_DB;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const ratingFilter = c.req.query('rating');
  const offset = (page - 1) * limit;

  let countQuery = 'SELECT COUNT(*) as total FROM reviews WHERE 1=1';
  let dataQuery = 'SELECT * FROM reviews WHERE 1=1';
  const params: unknown[] = [];

  if (ratingFilter) {
    countQuery += ' AND rating = ?';
    dataQuery += ' AND rating = ?';
    params.push(parseInt(ratingFilter, 10));
  }

  dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const { results: countResults } = await db.prepare(countQuery).bind(...params).all<{ total: number }>();
  const total = countResults?.[0]?.total || 0;

  const { results } = await db.prepare(dataQuery).bind(...params, limit, offset).all<ReviewRecord>();

  return c.json({
    success: true,
    data: results || [],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

// GET /api/reviews/stats — aggregate statistics
reviewsRouter.get('/stats', async(c) => {
  const db = c.env.AURA_DB;
  const row = await db.prepare(
    'SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 0) as average_rating FROM reviews'
  ).first<{ total_reviews: number; average_rating: number }>();

  return c.json({
    success: true,
    data: {
      total_reviews: row?.total_reviews || 0,
      average_rating: row ? Math.round(row.average_rating * 10) / 10 : 0
    }
  });
});
