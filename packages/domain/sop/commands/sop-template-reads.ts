/**
 * Template read side — the checklist definitions an operator may run.
 *
 * Apart from the run reads so each file stays inside the size ceiling. Every
 * query binds `tenant_id` first: the tables are shared, so a query without the
 * tenant predicate would return another store's SOP definitions.
 */

import type { SopTemplate } from '../model/sop-types';
import type { SopTemplateItemRow, SopTemplateRow } from '../src/model/sop-row-mapper';
import { toTemplate } from '../src/model/sop-row-mapper';
import { sopDatabase } from './sop-violation-columns';
import { type SopScope } from './sop-access';

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const group = map.get(key(row));
    if (group) group.push(row);
    else map.set(key(row), [row]);
  }
  return map;
}

/**
 * A template with its items attached, in declared order. Shared by every read
 * so the item ordering lives in one place, and exported so the write
 * repository reads one back after an insert instead of repeating the shape.
 */
export function attachTemplateItems(
  row: SopTemplateRow,
  items: SopTemplateItemRow[] = []
): SopTemplate {
  return toTemplate(row, items);
}

export async function listTemplates(scope: SopScope): Promise<SopTemplate[]> {
  const templates = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, code, title, description, source, shift_type, applicable_roles,
              version, is_active, created_at, updated_at
       FROM sop_templates WHERE tenant_id = ? AND is_active = 1 ORDER BY shift_type, code`
    )
    .bind(scope.tenantId)
    .all<SopTemplateRow>();

  const items = await sopDatabase(scope)
    .prepare(
      `SELECT ti.id, ti.tenant_id, ti.template_id, ti.label, ti.description, ti.order_index,
              ti.is_critical, ti.requires_note, ti.requires_value, ti.created_at
       FROM sop_template_items ti
       JOIN sop_templates t ON t.id = ti.template_id AND t.tenant_id = ti.tenant_id
       WHERE ti.tenant_id = ? AND t.is_active = 1`
    )
    .bind(scope.tenantId)
    .all<SopTemplateItemRow>();

  const byTemplate = groupBy(items.results ?? [], (row) => row.template_id);
  return (templates.results ?? []).map((row) => attachTemplateItems(row, byTemplate.get(row.id)));
}

/**
 * Every template, active or retired, for the admin console. Retired templates
 * are kept visible because the runs they produced are still compliance
 * evidence and their code cannot be reused while the row survives.
 */
export async function listAllTemplates(scope: SopScope): Promise<SopTemplate[]> {
  const templates = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, code, title, description, source, shift_type, applicable_roles,
              version, is_active, created_at, updated_at
       FROM sop_templates WHERE tenant_id = ? ORDER BY shift_type, code`
    )
    .bind(scope.tenantId)
    .all<SopTemplateRow>();

  const items = await sopDatabase(scope)
    .prepare(
      `SELECT ti.id, ti.tenant_id, ti.template_id, ti.label, ti.description, ti.order_index,
              ti.is_critical, ti.requires_note, ti.requires_value, ti.created_at
       FROM sop_template_items ti
       JOIN sop_templates t ON t.id = ti.template_id AND t.tenant_id = ti.tenant_id
       WHERE ti.tenant_id = ? ORDER BY ti.order_index, ti.id`
    )
    .bind(scope.tenantId)
    .all<SopTemplateItemRow>();

  const byTemplate = groupBy(items.results ?? [], (row) => row.template_id);
  return (templates.results ?? []).map((row) => attachTemplateItems(row, byTemplate.get(row.id)));
}

/** Escapes a like-pattern wildcard so a code containing % is not treated as a pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function findTemplate(scope: SopScope, templateId: string): Promise<SopTemplate | null> {
  const row = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, code, title, description, source, shift_type, applicable_roles,
              version, is_active, created_at, updated_at
       FROM sop_templates WHERE tenant_id = ? AND id = ?`
    )
    .bind(scope.tenantId, templateId)
    .first<SopTemplateRow>();
  if (!row) return null;

  const items = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, template_id, label, description, order_index, is_critical,
              requires_note, requires_value, created_at
       FROM sop_template_items WHERE tenant_id = ? AND template_id = ?
       ORDER BY order_index, id`
    )
    .bind(scope.tenantId, templateId)
    .all<SopTemplateItemRow>();

  return attachTemplateItems(row, items.results ?? []);
}

/**
 * The template an operator should run now, or null when none applies. Roles
 * are filtered in SQL so a restricted template is not even fetched.
 */
export async function findTemplateByCode(scope: SopScope, code: string): Promise<SopTemplate | null> {
  const row = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, code, title, description, source, shift_type, applicable_roles,
              version, is_active, created_at, updated_at
       FROM sop_templates WHERE tenant_id = ? AND code = ? AND is_active = 1`
    )
    .bind(scope.tenantId, escapeLike(code))
    .first<SopTemplateRow>();
  if (!row) return null;

  const items = await sopDatabase(scope)
    .prepare(
      `SELECT id, tenant_id, template_id, label, description, order_index, is_critical,
              requires_note, requires_value, created_at
       FROM sop_template_items WHERE tenant_id = ? AND template_id = ?
       ORDER BY order_index, id`
    )
    .bind(scope.tenantId, row.id)
    .all<SopTemplateItemRow>();

  return attachTemplateItems(row, items.results ?? []);
}
