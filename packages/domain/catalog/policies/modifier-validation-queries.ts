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
}

export interface GroupRow {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: number;
  is_active?: number | boolean;
  active?: number | boolean;
}

export async function fetchModifierChoice(
  db: D1Like,
  modId: string | null,
  modName: string | null,
): Promise<ChoiceRow | null> {
  for (const cols of ['id, group_id, name, price_delta, is_available', 'id, group_id, name, price_delta']) {
    try {
      if (modId) {
        const row = await db.prepare(`SELECT ${cols} FROM modifier_choices WHERE id = ?`).bind(modId).first<ChoiceRow>();
        if (row) return row;
      }
      if (modName) {
        const row = await db.prepare(`SELECT ${cols} FROM modifier_choices WHERE name = ?`).bind(modName).first<ChoiceRow>();
        if (row) return row;
      }
    } catch {
      // Fallback to next query projection
    }
  }
  return null;
}

export async function fetchModifierGroup(db: D1Like, groupId: string): Promise<GroupRow | null> {
  for (const cols of ['id, name, type, required, is_active', 'id, name, type, required']) {
    try {
      const row = await db.prepare(`SELECT ${cols} FROM modifier_groups WHERE id = ?`).bind(groupId).first<GroupRow>();
      if (row) return row;
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
): Promise<boolean> {
  for (const pid of productIds) {
    try {
      const link = await db
        .prepare('SELECT product_id, group_id FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')
        .bind(pid, groupId)
        .first<{ product_id: string; group_id: string }>();
      if (link) return true;
    } catch {
      // Ignore query error
    }
  }
  return false;
}
