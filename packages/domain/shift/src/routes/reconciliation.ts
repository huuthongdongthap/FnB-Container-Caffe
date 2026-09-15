import { Hono } from 'hono';
import { reconcileShiftCash, getReconciliationForShift } from '../policies/cash-reconciliation-policy';

interface AppContext {
  Bindings: {
    AURA_DB: D1Database;
  };
  Variables: {
    user?: { sub: string; role: string };
  };
}

export function reconciliationRoutes(app: Hono<AppContext>) {
  /**
   * POST /api/shifts/:id/reconcile
   * Perform cash reconciliation for a shift.
   */
  app.post('/api/shifts/:id/reconcile', async (c) => {
    const shiftId = c.req.param('id');
    const body = await c.req.json<{
      opening_float: number;
      denominations: { denomination: number; count: number }[];
      notes?: string;
    }();

    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const env = { AURA_DB: c.env.AURA_DB };

    try {
      const reconciliation = await reconcileShiftCash(
        env,
        {
          shift_id: shiftId,
          opening_float: body.opening_float,
          denominations: { denominations: body.denominations },
          notes: body.notes,
        },
        user.sub
      );

      return c.json(reconciliation);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reconciliation failed';
      return c.json({ error: message }, 500);
    }
  });

  /**
   * GET /api/shifts/:id/reconciliation
   * Fetch existing reconciliation for a shift.
   */
  app.get('/api/shifts/:id/reconciliation', async (c) => {
    const shiftId = c.req.param('id');
    const env = { AURA_DB: c.env.AURA_DB };

    const reconciliation = await getReconciliationForShift(env, shiftId);
    if (!reconciliation) return c.json({ error: 'Not found' }, 404);

    return c.json(reconciliation);
  });
}
