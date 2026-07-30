import { it, expect } from 'vitest';
import { tablesRouter } from '../../routes/tables';

it('PATCH on imported tablesRouter', async () => {
  const res = await tablesRouter.fetch(
    new Request('http://test/1/occupy', { method: 'PATCH' }),
    { AURA_DB: { prepare: (sql) => ({ async all() { return { results: [] }; }, async first() { return null; }, async run() { return { success: true }; } }) } } as any,
    { req: new Request('http://test', { method: 'GET' }), header: () => null, env: {} } as any
  );
  console.log('PATCH status:', res.status);
  expect(res.status).toBe(200);
});
