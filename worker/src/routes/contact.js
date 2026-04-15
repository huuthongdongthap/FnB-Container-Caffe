import { Hono } from 'hono';

export const contactRouter = new Hono();

contactRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.name || !body.content) {
      return c.json({ success: false, error: 'Name and content are required' }, 400);
    }
    
    const id = crypto.randomUUID();
    await c.env.AURA_DB.prepare(
      'INSERT INTO contact_messages (id, name, phone, email, category, content) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, body.name, body.phone || '', body.email || '', body.category || 'general', body.content).run();
    
    return c.json({ success: true, message_id: id });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
