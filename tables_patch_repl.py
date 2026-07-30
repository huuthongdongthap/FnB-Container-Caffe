// PATCH /api/tables/:id/occupy — public (QR ordering)
tablesRouter.patch('/:id/occupy', async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  await db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind('Occupied', id).run();
  return c.json({ success: true, message: `Table ${id} → Occupied` });
});

// PATCH /api/tables/:id/release — public (QR ordering)
tablesRouter.patch('/:id/release', async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const table = await db.prepare('SELECT * FROM cafe_tables WHERE id = ?').bind(id).first<CafeTable>();
  if (!table) {
    return c.json({ success: false, error: 'Table not found' }, 404);
  }

  await db.prepare('UPDATE cafe_tables SET status = ? WHERE id = ?').bind('Available', id).run();
  return c.json({ success: true, message: `Table ${id} → Available` });
});

// PATCH /api/tables/:id/status — staff/owner only
tablesRouter.patch('/:id/status', requireAuth(['owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateTableStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const { status } = parsed.data;

  await db.prepare(
    'UPDATE cafe_tables SET status = ? WHERE id = ?'
  ).bind(status, id).run();

  return c.json({ success: true, message: `Table ${id} → ${status}` });
});
