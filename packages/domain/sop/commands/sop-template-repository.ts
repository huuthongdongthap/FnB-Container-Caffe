/**
 * Template authoring — create and version-edit a checklist template.
 *
 * Editing a template writes a new version and leaves the rows already created
 * by `sop_runs` alone: a run pins the version it started against, so changing
 * the paper a checklist was transcribed from cannot rewrite history that a
 * completed run has already been judged by.
 */

import type { SopShiftType, SopSource, SopTemplate } from '../model/sop-types';
import type { SopTemplateItemRow, SopTemplateRow } from '../src/model/sop-row-mapper';
import { toTemplate } from '../src/model/sop-row-mapper';
import { SopAccessError, assertId, type SopScope } from './sop-access';
import { sopDatabase } from './sop-violation-columns';
import { findTemplate } from './sop-template-reads';

/** Only manager-level roles author the paper the floor executes. */
function assertAuthor(scope: SopScope): void {
  if (!scope.canManage) throw new SopAccessError('Owner, manager or admin required', 403);
}

export interface TemplateItemInput {
  label: string;
  description?: string | null;
  requireValue: boolean;
  requireNote: boolean;
  orderIndex: number;
  isCritical: boolean;
}

export interface CreateTemplateInput {
  code: string;
  title: string;
  description?: string | null;
  source: SopSource;
  shiftType: SopShiftType;
  applicableRoles: string[];
  items: TemplateItemInput[];
}

function readItems(items: TemplateItemInput[]): TemplateItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new SopAccessError('A template needs at least one item', 400);
  }
  return items.map((item, index) => {
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    if (!label) throw new SopAccessError(`Item ${index + 1} needs a label`, 400);
    return {
      label,
      description: typeof item?.description === 'string' ? item.description : null,
      requireValue: Boolean(item?.requireValue),
      requireNote: Boolean(item?.requireNote),
      orderIndex: Number.isFinite(item?.orderIndex) ? Number(item.orderIndex) : index,
      isCritical: Boolean(item?.isCritical),
    };
  });
}

export async function createTemplate(scope: SopScope, input: CreateTemplateInput): Promise<SopTemplate> {
  assertAuthor(scope);
  const code = assertId(input?.code, 'code');
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  if (!title) throw new SopAccessError('A title is required', 400);
  const items = readItems(input?.items ?? []);
  const roles = Array.isArray(input?.applicableRoles) ? input.applicableRoles.map(String) : [];
  if (roles.length === 0) throw new SopAccessError('At least one applicable role is required', 400);

  const existing = await sopDatabase(scope)
    .prepare('SELECT id FROM sop_templates WHERE tenant_id = ? AND code = ?')
    .bind(scope.tenantId, code)
    .first<{ id: string }>();
  if (existing) throw new SopAccessError('That template code is already in use', 409);

  const id = `tpl_${crypto.randomUUID()}`;
  await sopDatabase(scope)
    .prepare(
      `INSERT INTO sop_templates (id, tenant_id, code, title, description, source, shift_type,
         applicable_roles, version, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
    )
    .bind(
      id,
      scope.tenantId,
      code,
      title,
      typeof input.description === 'string' ? input.description : null,
      input.source,
      input.shiftType,
      roles.join(','),
    )
    .run();

  await insertItems(scope, id, items);
  return loadTemplate(scope, id);
}

async function insertItems(scope: SopScope, templateId: string, items: TemplateItemInput[]): Promise<void> {
  for (const item of items) {
    await sopDatabase(scope)
      .prepare(
        `INSERT INTO sop_template_items (id, tenant_id, template_id, label, description, order_index,
           is_critical, requires_note, requires_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `ti_${crypto.randomUUID()}`,
        scope.tenantId,
        templateId,
        item.label,
        item.description,
        item.orderIndex,
        item.isCritical ? 1 : 0,
        item.requireNote ? 1 : 0,
        item.requireValue ? 1 : 0,
      )
      .run();
  }
}

/**
 * Replaces the item set and bumps the version. The old rows are deleted rather
 * than archived because the template is a definition, not evidence — the run
 * rows carry the version they were executed under, and that is what survives.
 */
export async function updateTemplate(
  scope: SopScope,
  templateId: string,
  input: Partial<CreateTemplateInput>
): Promise<SopTemplate> {
  assertAuthor(scope);
  const id = assertId(templateId);
  const current = await sopDatabase(scope)
    .prepare('SELECT id, version FROM sop_templates WHERE tenant_id = ? AND id = ?')
    .bind(scope.tenantId, id)
    .first<Pick<SopTemplateRow, 'id' | 'version'>>();
  if (!current) throw new SopAccessError('Template not found', 404);

  const items = input.items ? readItems(input.items) : null;
  const roles = input.applicableRoles ? input.applicableRoles.map(String) : null;
  if (roles && roles.length === 0) throw new SopAccessError('At least one applicable role is required', 400);

  const assignments: string[] = ['version = version + 1'];
  const params: (string | number | null)[] = [];
  if (typeof input.code === 'string' && input.code.trim()) {
    assignments.push('code = ?');
    params.push(assertId(input.code, 'code'));
  }
  if (typeof input.title === 'string' && input.title.trim()) {
    assignments.push('title = ?');
    params.push(input.title.trim());
  }
  if (input.description !== undefined) {
    assignments.push('description = ?');
    params.push(typeof input.description === 'string' ? input.description : null);
  }
  if (input.source) {
    assignments.push('source = ?');
    params.push(input.source);
  }
  if (input.shiftType) {
    assignments.push('shift_type = ?');
    params.push(input.shiftType);
  }
  if (roles) {
    assignments.push('applicable_roles = ?');
    params.push(roles.join(','));
  }

  await sopDatabase(scope)
    .prepare(`UPDATE sop_templates SET ${assignments.join(', ')} WHERE tenant_id = ? AND id = ?`)
    .bind(...params, scope.tenantId, id)
    .run();

  if (items) {
    await sopDatabase(scope)
      .prepare('DELETE FROM sop_template_items WHERE tenant_id = ? AND template_id = ?')
      .bind(scope.tenantId, id)
      .run();
    await insertItems(scope, id, items);
  }

  return loadTemplate(scope, id);
}

/** Reads the template back after a write, items included, or 404 if it vanished. */
async function loadTemplate(scope: SopScope, templateId: string): Promise<SopTemplate> {
  const template = await findTemplate(scope, templateId);
  if (!template) throw new SopAccessError('Template not found', 404);
  return template;
}
