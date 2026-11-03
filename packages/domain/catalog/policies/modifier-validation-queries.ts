/**
 * Modifier Validation DB Queries — D1 query helpers for modifier contract.
 */

export interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] } | T[]>;
      run(): Promise<unknown>;
    };
  };
}

export interface ChoiceRow {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_available?: number | boolean;
  available?: number | boolean;
  is_active?: number | boolean;
  active?: number | boolean;
  tenant_id?: string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: number;
  is_active?: number | boolean;
  active?: number | boolean;
  tenant_id?: string | null;
}

async function matchesRowTenantIfPresent(
  db: D1Like,
  table: 'modifier_choices' | 'modifier_groups' | 'product_modifier_groups',
  whereSql: string,
  bindArgs: unknown[],
  row: { tenant_id?: string | null },
  tenantId?: string,
): Promise<boolean> {
  if (!tenantId || !tenantId.trim() || tenantId.trim() === '*') return true;
  const normTenant = tenantId.trim() || 'default';
  let rowTenantVal: string | null | undefined = row.tenant_id;
  if (rowTenantVal === undefined) {
    try {
      const probe = await db
        .prepare(`SELECT tenant_id FROM ${table} WHERE ${whereSql}`)
        .bind(...bindArgs)
        .first<{ tenant_id?: string | null }>();
      if (probe && 'tenant_id' in probe && probe.tenant_id !== undefined) {
        rowTenantVal = probe.tenant_id;
      }
    } catch {
      return true;
    }
  }
  if (rowTenantVal === undefined) return true;
  const resolved = (rowTenantVal && String(rowTenantVal).trim()) || 'default';
  return resolved === normTenant;
}

export async function fetchModifierChoice(
  db: D1Like,
  modId: string | null,
  modName: string | null,
  tenantId?: string,
): Promise<ChoiceRow | null> {
  for (const cols of [
    'id, group_id, name, price_delta, is_available',
    'id, group_id, name, price_delta',
    'id, group_id, name, price_adjustment AS price_delta, available AS is_available',
    'id, group_id, name, price_adjustment AS price_delta',
  ]) {
    try {
      if (modId) {
        const row = await db.prepare(`SELECT ${cols} FROM modifier_choices WHERE id = ?`).bind(modId).first<ChoiceRow>();
        if (row && (await matchesRowTenantIfPresent(db, 'modifier_choices', 'id = ?', [row.id || modId], row, tenantId))) {
          return row;
        }
      }
      if (modName) {
        const row = await db.prepare(`SELECT ${cols} FROM modifier_choices WHERE name = ?`).bind(modName).first<ChoiceRow>();
        if (row) {
          if (await matchesRowTenantIfPresent(db, 'modifier_choices', 'id = ?', [row.id], row, tenantId)) {
            return row;
          }
          if (tenantId && tenantId.trim() && tenantId.trim() !== '*') {
            const normTenant = tenantId.trim();
            const allRes = await db
              .prepare(`SELECT ${cols}, tenant_id FROM modifier_choices WHERE name = ?`)
              .bind(modName)
              .all<ChoiceRow>()
              .catch(() => null);
            const list = (Array.isArray(allRes) ? allRes : allRes?.results || []) as ChoiceRow[];
            const matched = list.find((r) => {
              if (!('tenant_id' in r) || r.tenant_id === undefined) return normTenant === 'default';
              return ((r.tenant_id && String(r.tenant_id).trim()) || 'default') === normTenant;
            });
            if (matched) return matched;
          }
        }
      }
    } catch {
      // Fallback to next query projection
    }
  }
  return null;
}

export async function fetchModifierGroup(
  db: D1Like,
  groupId: string,
  tenantId?: string,
): Promise<GroupRow | null> {
  for (const cols of [
    'id, name, type, required, is_active',
    'id, name, type, required',
    "id, name, CASE WHEN COALESCE(max_select, 1) <= 1 THEN 'single' ELSE 'multiple' END AS type, required",
  ]) {
    try {
      const row = await db.prepare(`SELECT ${cols} FROM modifier_groups WHERE id = ?`).bind(groupId).first<GroupRow>();
      if (row) {
        if (await matchesRowTenantIfPresent(db, 'modifier_groups', 'id = ?', [groupId], row, tenantId)) {
          return row;
        }
        return null;
      }
    } catch {
      // Fallback
    }
  }
  return null;
}

export async function isGroupLinkedToProduct(
  db: D1Like,
  productIds: string[],
  groupId: string,
  tenantId?: string,
): Promise<boolean> {
  for (const pid of productIds) {
    try {
      const link = await db
        .prepare('SELECT product_id, group_id FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')
        .bind(pid, groupId)
        .first<{ product_id: string; group_id: string; tenant_id?: string | null }>();
      if (
        link &&
        (await matchesRowTenantIfPresent(
          db,
          'product_modifier_groups',
          'product_id = ? AND group_id = ?',
          [pid, groupId],
          link,
          tenantId,
        ))
      ) {
        return true;
      }
    } catch {
      // Ignore query error
    }
  }
  return false;
}
