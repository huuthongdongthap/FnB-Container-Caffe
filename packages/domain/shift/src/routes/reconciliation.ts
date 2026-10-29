import type { Hono } from 'hono';

/** The attendance pilot has no validated POS cash lifecycle contract. */
export function reconciliationRoutes(app: Hono<any>) {
  for (const [method, path] of [
    ['post', '/api/shifts/:id/reconcile'],
    ['get', '/api/shifts/:id/reconciliation'],
  ] as const) {
    app[method](path, (c) => {
      const user = c.get('user');
      if (!user) return c.json({ error: 'Unauthorized' }, 401);
      if (!['owner', 'manager', 'staff', 'admin', 'cashier', 'waiter'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403);
      return c.json({ success: false,
      code: 'PILOT_CASH_RECONCILIATION_DISABLED',
      error: 'Cash reconciliation is unavailable for the attendance pilot',
      }, 501);
    });
  }
}
