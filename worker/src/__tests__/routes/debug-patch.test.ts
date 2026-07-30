import { it } from 'vitest';
import { tablesRouter } from '../../routes/tables';

it('list all registered routes', async () => {
  const anyRouter = tablesRouter as any;
  // Hono stores routes internally, try different property names
  const props = Object.getOwnPropertyNames(tablesRouter);
  console.log('own props:', props);

  // Try to find the route store
  for (const p of props) {
    try {
      const v = (tablesRouter as any)[p];
      if (Array.isArray(v)) {
        console.log(`[${p}] array length:`, v.length);
        v.forEach((item: any) => {
          if (item && typeof item === 'object') {
            const keys = Object.keys(item);
            console.log(`  keys: ${keys.join(', ')}`);
            if (item.method) console.log(`  method: ${item.method}`);
            if (item.path) console.log(`  path: ${item.path}`);
            if (item.route) console.log(`  route: ${item.route}`);
          }
        });
      }
    } catch (e) {}
  }
});
