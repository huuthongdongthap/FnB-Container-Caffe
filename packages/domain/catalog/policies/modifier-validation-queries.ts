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
  is_required?: number | boolean;
  min_selections?: number | null;
  is_active?: number | boolean;
  active?: number | boolean;
  tenant_id?: string | null;
}

async function matchesRowTenantIfPresent(
  db: D1Like,
  table: 'modifier_choices' | 'modifier_groups' | 'product_modifier_groups',
  whereSql: string,
  bindArgs: unknown[],
  row: { tenant_id?: string | null; group_id?: string | null },
  tenantId?: string,
): Promise<boolean> {
  if (!tenantId || !tenantId.trim() || tenantId.trim() === '*' || tenantId.trim().toLowerCase() === 'hq') return true;
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
      // Fall through to parent group probe or fail-closed check
    }
  }
  if (table !== 'modifier_groups' && row.group_id) {
    try {
      const groupProbe = await db
        .prepare('SELECT tenant_id FROM modifier_groups WHERE id = ?')
        .bind(row.group_id)
        .first<{ tenant_id?: string | null }>();
      if (groupProbe && 'tenant_id' in groupProbe && groupProbe.tenant_id !== undefined) {
        const groupTenant = (groupProbe.tenant_id && String(groupProbe.tenant_id).trim()) || 'default';
        if (groupTenant !== normTenant) {
          return false;
        }
        if (rowTenantVal === undefined || rowTenantVal === null || String(rowTenantVal).trim() === '') {
          rowTenantVal = groupProbe.tenant_id;
        }
      }
    } catch {
      // Fall through to fail-closed check
    }
  }
  if (rowTenantVal === undefined) {
    return normTenant === 'default';
  }
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
          if (tenantId && tenantId.trim() && tenantId.trim() !== '*' && tenantId.trim().toLowerCase() !== 'hq') {
            const allRes = await db
              .prepare(`SELECT ${cols}, tenant_id FROM modifier_choices WHERE name = ?`)
              .bind(modName)
              .all<ChoiceRow>()
              .catch(() => null);
            const list = (Array.isArray(allRes) ? allRes : allRes?.results || []) as ChoiceRow[];
            for (const candidate of list) {
              if (await matchesRowTenantIfPresent(db, 'modifier_choices', 'id = ?', [candidate.id], candidate, tenantId)) {
                return candidate;
              }
            }
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

export async function fetchRequiredModifierGroupsForProduct(
  db: D1Like,
  productIds: string[],
  tenantId?: string,
): Promise<GroupRow[]> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];
  const seenGroupIds = new Set<string>();
  const requiredGroups: GroupRow[] = [];

  const queries = [
    `SELECT mg.id, mg.name, mg.type, mg.required, mg.min_selections, mg.is_active, mg.tenant_id
     FROM product_modifier_groups pm
     JOIN modifier_groups mg ON mg.id = pm.group_id
     WHERE pm.product_id = ?`,
    `SELECT mg.id, mg.name, mg.type, mg.required, mg.is_active, mg.tenant_id
     FROM product_modifier_groups pm
     JOIN modifier_groups mg ON mg.id = pm.group_id
     WHERE pm.product_id = ?`,
    `SELECT mg.id, mg.name, mg.type, mg.required, mg.is_active
     FROM product_modifier_groups pm
     JOIN modifier_groups mg ON mg.id = pm.group_id
     WHERE pm.product_id = ?`,
  ];

  for (const pid of uniqueIds) {
    for (const sql of queries) {
      try {
        const stmt = db.prepare(sql).bind(pid);
        if (typeof stmt.all !== 'function') break;
        const res = await stmt.all<GroupRow>();
        const rows = (Array.isArray(res) ? res : res?.results || []) as GroupRow[];
        for (const row of rows) {
          if (!row || !row.id || seenGroupIds.has(row.id)) continue;
          if (!(await matchesRowTenantIfPresent(db, 'modifier_groups', 'id = ?', [row.id], row, tenantId))) {
            continue;
          }
          if (
            !(await matchesRowTenantIfPresent(
              db,
              'product_modifier_groups',
              'product_id = ? AND group_id = ?',
              [pid, row.id],
              { group_id: row.id },
              tenantId,
            ))
          ) {
            continue;
          }
          const isGroupActive = row.is_active ?? row.active;
          if (isGroupActive === 0 || isGroupActive === false) continue;
          const isReq =
            Number(row.required ?? row.is_required ?? 0) === 1 ||
            Boolean(row.required) === true ||
            row.is_required === true;
          const minSel =
            row.min_selections !== undefined && row.min_selections !== null
              ? Number(row.min_selections)
              : 0;
          if (isReq || (Number.isFinite(minSel) && minSel > 0)) {
            seenGroupIds.add(row.id);
            requiredGroups.push(row);
          }
        }
        break;
      } catch {
        // Fallback to narrower query projection or skip when table is absent
      }
    }
  }

  return requiredGroups;
}
