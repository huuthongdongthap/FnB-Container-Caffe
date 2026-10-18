import { it, expect } from 'vitest';
import { tablesRouter } from '@aura/domain-table';

it('list all registered routes', async () => {
  const anyRouter = tablesRouter as any;
  const props = Object.getOwnPropertyNames(tablesRouter);
  expect(props.length).toBeGreaterThan(0);
  expect(Array.isArray(anyRouter.routes)).toBe(true);
  expect(anyRouter.routes.length).toBeGreaterThan(0);
  const methods = anyRouter.routes.map((r: { method: string }) => r.method);
  expect(methods).toContain('GET');
  expect(methods).toContain('PATCH');
});
