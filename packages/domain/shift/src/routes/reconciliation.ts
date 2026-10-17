import { Hono } from 'hono';
import { reconcileShiftCash, getReconciliationForShift } from '../policies/cash-reconciliation-policy';

interface AppContext {
  Bindings: {
    AURA_DB: D1Database;
  };
  Variables: {
    user?: { sub?: string; id?: string; role: string };
  };
}

const ALLOWED_RECONCILIATION_ROLES = new Set(['owner', 'manager', 'staff']);

export function reconciliationRoutes(app: Hono<AppContext>) {
  /**
   * POST /api/shifts/:id/reconcile
   * Perform cash reconciliation for a shift.
   */
  app.post('/api/shifts/:id/reconcile', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!ALLOWED_RECONCILIATION_ROLES.has(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const shiftId = c.req.param('id');
    const body = await c.req.json<{
      opening_float: number;
      denominations: { denomination: number; count: number }[];
      notes?: string;
    }>().catch(() => null);

    if (
      !body ||
      typeof body.opening_float !== 'number' ||
      !Number.isFinite(body.opening_float) ||
      body.opening_float < 0 ||
      !Array.isArray(body.denominations)
    ) {
      return c.json({ error: 'Invalid opening_float or denominations' }, 400);
    }

    const env = { AURA_DB: c.env.AURA_DB };
    const staffId = user.sub || user.id || 'unknown';

    try {
      const reconciliation = await reconcileShiftCash(
        env,
        {
          shift_id: shiftId,
          opening_float: body.opening_float,
          denominations: { denominations: body.denominations },
          notes: body.notes,
        },
        staffId
      );

      return c.json(reconciliation);
    } catch {
      return c.json({ error: 'Cash reconciliation failed' }, 500);
    }
  });

  /**
   * GET /api/shifts/:id/reconciliation
   * Fetch existing reconciliation for a shift.
   */
  app.get('/api/shifts/:id/reconciliation', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!ALLOWED_RECONCILIATION_ROLES.has(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const shiftId = c.req.param('id');
    const env = { AURA_DB: c.env.AURA_DB };

    try {
      const reconciliation = await getReconciliationForShift(env, shiftId);
      if (!reconciliation) return c.json({ error: 'Not found' }, 404);

      return c.json(reconciliation);
    } catch {
      return c.json({ error: 'Failed to fetch shift reconciliation' }, 500);
    }
  });
}
