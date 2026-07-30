import { Hono } from 'hono';

// Simulate the actual tables router
const t = new Hono();
t.patch('/:id/occupy', async (c) => {
  return c.json({ ok: true, route: 'occupy' });
});
t.patch('/:id/release', async (c) => {
  return c.json({ ok: true, route: 'release' });
});
t.patch('/:id/status', async (c) => {
  return c.json({ ok: true, route: 'status' });
});

const app = new Hono();
app.route('/api/tables', t);

for (const p of ['/1/occupy', '/1/occupy/', '/1/release', '/1/status', '/1']) {
  const r = await app.fetch(new Request(`http://test${p}`, { method: 'PATCH' }));
  console.log(`${r.status} ${p}`);
}
