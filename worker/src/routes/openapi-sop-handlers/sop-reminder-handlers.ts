/**
 * Recurring-duty reminder handlers — the ledger and the acknowledge action.
 *
 * Kept out of the checklist read and write handler files: the read file is
 * already near the size ceiling, and the acknowledge action belongs with these
 * rather than with the checklist writes it has nothing in common with.
 *
 * Scope comes from the session via `sopScope` and the domain layer re-checks the
 * role, so a tenant id in a query is never trusted — a store may only read and
 * acknowledge its own notices.
 */

import type { OpenAPIHono } from '@hono/zod-openapi';
import {
  acknowledgeReminder,
  countOpenReminders,
  listReminders,
  sopScope,
} from '@aura/domain-sop';
import type { Env } from '../../types/env';
import type { SopAdminRoutes } from '../../schemas/sop-routes';

export function registerSopReminderHandlers(app: OpenAPIHono<{ Bindings: Env }>, routes: typeof SopAdminRoutes) {
  /**
   * Counts are computed from the same filters as the list rather than reported
   * separately, so the badge can never disagree with the rows beneath it.
   */
  app.openapi(routes.reminders as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const query = c.req.valid('query');
    // The query schema passes the string through unchanged, so `'false'` must be
    // read as false rather than tested for truthiness, which any non-empty string
    // satisfies.
    const unreadOnly = query.unread === undefined ? undefined : query.unread === 'true';
    const [reminders, counts] = await Promise.all([
      listReminders(scope, {
        kind: query.kind,
        dayKey: query.dayKey,
        templateId: query.templateId,
        unreadOnly,
        limit: query.limit,
      }),
      countOpenReminders(scope),
    ]);
    return c.json({ success: true, data: { reminders, counts } });
  });

  /**
   * Idempotent: acknowledging a notice that is already acknowledged reports
   * success rather than 404, because the caller's intent is satisfied either
   * way and a double-tap should not read as a failure.
   */
  app.openapi(routes.acknowledgeReminder as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const acknowledged = await acknowledgeReminder(scope, c.req.valid('param').id);
    return c.json({ success: true, data: { acknowledged } });
  });
}
