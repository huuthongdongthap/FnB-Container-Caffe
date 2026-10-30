/**
 * Admin SOP read handlers — oversight dashboard, run history, run detail, and
 * the violation register.
 *
 * Split from the write handlers because the group is eleven endpoints and a
 * single file would pass the 200-line ceiling. Every handler derives scope from
 * the session via `sopScope`, so no tenant id is read from a query or body.
 */

import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import {
  businessDate,
  findRun,
  findTemplate,
  isOverdue,
  listRunsForStaffDay,
  listAllTemplates,
  listViolations,
  sopScope,
  type SopRun,
  type SopScope,
  type SopTemplate,
  type SopViolation,
} from '@aura/domain-sop';
import type { SopAdminRoutes } from '../../schemas/sop-routes';

function progressOf(run: SopRun) {
  const total = run.templateItems?.length ?? run.items.length;
  const checked = run.items.filter((item) => item.isChecked).length;
  const criticalRemaining = (run.templateItems ?? []).filter(
    (rule) => rule.isCritical && !run.items.some((item) => item.templateItemId === rule.id && item.isChecked)
  ).length;
  return { checked, total, criticalRemaining };
}

/** Shape the run-summary list view: progress and template identity, no ticks. */
function toRunSummary(run: SopRun, template: { code: string; title: string } | null) {
  return {
    id: run.id,
    templateId: run.templateId,
    templateCode: template?.code ?? '',
    templateTitle: template?.title ?? '',
    status: run.status,
    scheduledDate: run.scheduledDate,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    progress: progressOf(run),
  };
}

/** Run detail pairs every tick with the rule it was judged against. */
function toRunDetail(run: SopRun, template: SopTemplate) {
  const rules = run.templateItems ?? template.items;
  return {
    run,
    states: run.items.map((item) => ({ item, rule: rules.find((rule) => rule.id === item.templateItemId) })),
    template: { ...template, items: template.items },
  };
}

/**
 * The oversight row for one open or finished checklist: who is running what,
 * how far along, and whether it has overrun the window its shift allows.
 */
function toMonitorItem(
  run: SopRun,
  templates: Map<string, { code: string; title: string }>,
  now: Date
) {
  const template = templates.get(run.templateId);
  return {
    id: run.id,
    staffId: run.staffId,
    staffName: run.staffName ?? null,
    templateCode: template?.code ?? '',
    templateTitle: template?.title ?? '',
    shiftType: run.shiftType,
    status: run.status,
    startedAt: run.startedAt,
    progress: progressOf(run),
    // Measured from the store's clock: an open run that has passed its window
    // needs the shift leader's attention, and the app shows it as overdue.
    isOverdue: run.status === 'in_progress' && isOverdue(run.startedAt, run.shiftType, now),
  };
}

/**
 * Template identity for a day's runs, read once per distinct template rather
 * than once per run — a day of twenty runs across two templates is two reads.
 */
async function templateIdentities(scope: SopScope, runs: SopRun[]) {
  const ids = [...new Set(runs.map((run) => run.templateId))];
  const entries = await Promise.all(ids.map(async (id) => {
    const template = await findTemplate(scope, id);
    return [id, { code: template?.code ?? '', title: template?.title ?? '' }] as const;
  }));
  return new Map(entries);
}

export function registerSopAdminReadHandlers(app: OpenAPIHono<{ Bindings: Env }>, routes: typeof SopAdminRoutes) {
  app.openapi(routes.monitor as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const now = new Date();
    const date = businessDate(now);
    // No staff filter: this is the store's view, so every member's run for the
    // day is in scope. The repository still binds the tenant.
    const runs = await listRunsForStaffDay(scope, '', date);
    const templates = await templateIdentities(scope, runs);
    const items = runs.map((run) => toMonitorItem(run, templates, now));
    return c.json({
      success: true,
      data: {
        date,
        runs: items,
        completedToday: items.filter((item) => item.status === 'completed').length,
        inProgressToday: items.filter((item) => item.status === 'in_progress').length,
        overdueToday: items.filter((item) => item.isOverdue).length,
      },
    });
  });

  app.openapi(routes.runs as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const query = c.req.valid('query');
    const date = query.date ?? businessDate();
    const rows = await listRunsForStaffDay(scope, query.staffId ?? '', date);
    const runs = rows.filter((run) => !query.status || run.status === query.status);
    return c.json({
      success: true,
      data: {
        runs: runs.map((run) => toRunSummary(run, null)),
        meta: { page: 1, limit: runs.length, total: runs.length },
      },
    });
  });

  app.openapi(routes.templates as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const templates = await listAllTemplates(scope);
    return c.json({ success: true, data: templates });
  });

  app.openapi(routes.runDetail as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const run = await findRun(scope, c.req.valid('param').id);
    if (!run) return c.json({ success: false, error: 'Không tìm thấy checklist run' }, { status: 404 });
    const template = await findTemplate(scope, run.templateId);
    if (!template) return c.json({ success: false, error: 'Không tìm thấy bản mẫu' }, { status: 404 });
    return c.json({ success: true, data: { run, detail: toRunDetail(run, template) } });
  });

  app.openapi(routes.violations as any, async (c: any) => {
    const scope = sopScope(c.env, c.get('user'));
    const query = c.req.valid('query');
    const violations: SopViolation[] = await listViolations(scope, {
      status: query.status,
      month: query.month,
      staffId: query.staffId,
    });
    return c.json({ success: true, data: { violations } });
  });
}
