import { Hono } from 'hono';

export const reviewsRouter = new Hono();

reviewsRouter.get('/', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 10;
    const rating = c.req.query('rating');
    
    let query = 'SELECT * FROM reviews WHERE status = "published"';
    const params = [];
    
    if (rating) {
      query += ` AND rating = ?`;
      params.push(Number(rating));
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const stmt = c.env.AURA_DB.prepare(query);
    const reviews = await stmt.bind(...params).all();
    
    // Also get average rating
    const avgData = await c.env.AURA_DB.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE status = "published"').first();
    
    return c.json({ 
      success: true, 
      reviews: reviews.results,
      average_rating: avgData?.avg || 0,
      total_count: avgData?.count || 0
    });
  } catch(err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

reviewsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.customer_name || !body.rating || !body.content) {
      return c.json({ success: false, error: 'Required fields missing' }, 400);
    }
    
    const id = crypto.randomUUID();
    await c.env.AURA_DB.prepare(
      'INSERT INTO reviews (id, customer_name, rating, content, tags) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, body.customer_name, body.rating, body.content, body.tags ? JSON.stringify(body.tags) : '[]').run();
    
    return c.json({ success: true, review_id: id });
  } catch(err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
