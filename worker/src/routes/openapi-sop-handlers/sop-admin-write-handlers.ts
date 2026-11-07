/**
 * Admin SOP write handlers — template authoring and the violation ladder.
 *
 * The ladder handlers (record, confirm, apply, appeal, close) delegate to the
 * domain repository, which routes every transition through the policy gate
 * before preparing a statement. A route here only marshals input; it never
 * decides whether a step is allowed.
 */


import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import {
  appealViolation,
  applyViolation,
  closeViolation,
  confirmViolation,
  createTemplate,
  recordViolation,
  SopAccessError,
  sopScope,
  updateTemplate,
  type CreateTemplateInput,
  type SopDisciplineStep,
} from '@aura/domain-sop';
import type { SopAdminRoutes } from '../../schemas/sop-routes';
import { auditActor, auditSopAction } from './sop-audit';

function handleSopWriteError(c: any, err: unknown) {
  if (err instanceof SopAccessError) {
    return c.json({ success: false, error: err.message }, { status: err.status });
  }
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = Number((err as { status: unknown }).status);
    if (status >= 400 && status <= 599) {
      const msg = err instanceof Error ? err.message : 'Yêu cầu SOP không hợp lệ';
      return c.json({ success: false, error: msg }, { status });
    }
  }
  return c.json({ success: false, error: 'Không thể xử lý yêu cầu SOP' }, { status: 500 });
}

export function registerSopAdminWriteHandlers(app: OpenAPIHono<{ Bindings: Env }>, routes: typeof SopAdminRoutes) {
  app.openapi(routes.createTemplate as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const body = c.req.valid('json');
      const template = await createTemplate(scope, body as CreateTemplateInput);
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_template.created',
        resourceId: template.id,
        metadata: { code: template.code, source: template.source, version: template.version },
      });
      return c.json({ success: true, data: template }, { status: 201 });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });

  app.openapi(routes.updateTemplate as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const body = c.req.valid('json');
      const template = await updateTemplate(scope, c.req.valid('param').id, body);
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_template.updated',
        resourceId: template.id,
        // The version bump is the point: a completed run keeps the version it ran
        // under, so which version this write produced is the fact worth keeping.
        metadata: { version: template.version, itemCount: template.items.length },
      });
      return c.json({ success: true, data: template });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });

  app.openapi(routes.recordViolation as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const body = c.req.valid('json');
      // Seriousness is not taken from the body: the category decides it, so a
      // caller cannot file a dismissible breach as a lesser one.
      const violation = await recordViolation(scope, {
        staffId: body.staffId,
        category: body.category,
        note: body.note,
        occurredAt: body.occurredAt,
      });
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_violation.recorded',
        resourceId: violation.id,
        metadata: { staffId: violation.staffId, category: violation.category, isSerious: violation.isSerious, disciplineStep: violation.disciplineStep },
      });
      return c.json({ success: true, data: violation }, { status: 201 });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });

  app.openapi(routes.confirmViolation as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const violation = await confirmViolation(scope, c.req.valid('param').id);
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_violation.confirmed',
        resourceId: violation.id,
        metadata: { staffId: violation.staffId },
      });
      return c.json({ success: true, data: violation });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });

  app.openapi(routes.applyViolation as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const body = c.req.valid('json');
      const step = body?.step;
      // The body may only restate a step; an unknown value is a malformed request,
      // not a silent fallback to the recorded one.
      if (step !== undefined && !['none', 'written_warning', 'fine', 'termination'].includes(String(step))) {
        return c.json({ success: false, error: 'Hình thức kỷ luật không hợp lệ' }, { status: 400 });
      }
      const violation = await applyViolation(scope, c.req.valid('param').id, {
        disciplineStep: step as SopDisciplineStep | undefined,
        sanctionNote: body?.sanctionNote,
      });
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_violation.applied',
        resourceId: violation.id,
        metadata: { disciplineStep: violation.disciplineStep, staffId: violation.staffId },
      });
      return c.json({ success: true, data: violation });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });

  app.openapi(routes.closeViolation as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const violation = await closeViolation(scope, c.req.valid('param').id);
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_violation.closed',
        resourceId: violation.id,
        metadata: { disciplineStep: violation.disciplineStep, staffId: violation.staffId },
      });
      return c.json({ success: true, data: violation });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });

  app.openapi(routes.appealViolation as any, async (c: any) => {
    try {
      const scope = sopScope(c.env, c.get('user'), c);
      const body = c.req.valid('json');
      const explanation = typeof body?.appealExplanation === 'string' ? body.appealExplanation.trim() : '';
      if (explanation.length < 1 || explanation.length > 2000) {
        return c.json({ success: false, error: 'Giải trình khiếu nại phải từ 1 đến 2000 ký tự' }, { status: 400 });
      }
      const violation = await appealViolation(scope, c.req.valid('param').id, explanation);
      await auditSopAction({
        db: c.env.AURA_DB,
        actor: auditActor(c, scope.tenantId),
        action: 'sop_violation.appealed',
        resourceId: violation.id,
        // Only the fact of the appeal, never its text: the explanation is the
        // staff member's own words and belongs to the violation row, not the log.
        metadata: { staffId: violation.staffId },
      });
      return c.json({ success: true, data: violation });
    } catch (err) {
      return handleSopWriteError(c, err);
    }
  });
}
