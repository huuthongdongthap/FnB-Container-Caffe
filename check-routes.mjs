import { Hono } from 'hono';

async function test() {
  // Scenario 1: Only /:id/*
  const h1 = new Hono();
  h1.patch('/:id/*', async (c) => {
    const tail = c.req.param('*');
    console.log('  handler tail:', JSON.stringify(tail), 'typeof:', typeof tail);
    return c.json({ tail });
  });

  for (const p of ['/1/occupy', '/1/occupy/', '/1/release', '/1/status', '/1']) {
    const r = await h1.fetch(new Request(`http://test${p}`, { method: 'PATCH' }));
    console.log(`${r.status} ${p}`);
  }

  console.log('---');

  // Scenario 2: /:id/* + .patch('/:id/foo')
  const h2 = new Hono();
  h2.patch('/:id/*', (c) => c.json({ src: 'wildcard' }));
  h2.patch('/1/foo', (c) => c.json({ src: 'explicit' }));

  for (const p of ['/1/foo', '/1/occupy', '/1/bar']) {
    const r = await h2.fetch(new Request(`http://test${p}`, { method: 'PATCH' }));
    console.log(`${r.status} ${p} -> ${await r.text()}`);
  }

  console.log('---');

  // Scenario 3: Register order test
  const h3 = new Hono();
  h3.patch('/1/occupy', (c) => c.json({ src: 'explicit-occupy' }));
  h3.patch('/:id/*', (c) => c.json({ src: 'wildcard' }));

  for (const p of ['/1/occupy', '/1/release', '/1/status']) {
    const r = await h3.fetch(new Request(`http://test${p}`, { method: 'PATCH' }));
    console.log(`${r.status} ${p} -> ${await r.text()}`);
  }
}
test();
