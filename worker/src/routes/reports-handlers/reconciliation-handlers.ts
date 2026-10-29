import type { Hono } from 'hono';
import type { Env } from '../../types/env';

/** Attendance records do not supply cash reconciliation or settlement evidence. */
export function registerReconciliationHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/reconciliation', (c) => c.json({ success: false,
    code: 'PILOT_CASH_RECONCILIATION_DISABLED',
    error: 'Cash reconciliation is unavailable for the attendance pilot',
  }, 501));
}
