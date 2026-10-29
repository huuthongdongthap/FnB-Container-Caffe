/**
 * Shared helpers for the SOP violation command layer — the D1 binding, the
 * column list, and the two predicates every repository in the package needs.
 *
 * `sopDatabase` resolves the binding here so a missing binding is one error
 * message everywhere rather than four slightly different ones. The role
 * predicates live beside it because the register (reads) and the ladder (writes)
 * both gate on the same line, and a copy per file is how the two drift apart.
 */

import { SOP_VIOLATION_ROLES, SopAccessError, type SopScope } from './sop-access';

/** Resolves the D1 binding from the scope's environment. */
export function sopDatabase(scope: SopScope): D1Database {
  const database = (scope.env as unknown as { AURA_DB?: unknown }).AURA_DB as D1Database | undefined;
  if (!database) throw new SopAccessError('D1 database binding missing', 503);
  return database;
}

/** The ladder is manager-plus only; an operator may not record against a peer by accident. */
export function assertViolationRole(scope: SopScope): void {
  if (!SOP_VIOLATION_ROLES.includes(scope.actorRole as (typeof SOP_VIOLATION_ROLES)[number])) {
    throw new SopAccessError('Owner, manager or admin required', 403);
  }
}

export function role(scope: SopScope): string {
  return String(scope.actorRole);
}

/**
 * The violation columns every read and write selects. Kept in one string so a
 * column added to `sop_violations` is added to every statement in the same
 * edit instead of drifting between them.
 *
 * `alias` prefixes each column. Pass `''` when the table is queried without a
 * name (`FROM sop_violations`), and `'v'` when it is (`FROM sop_violations v`):
 * the prefix must match the query or SQLite rejects the column outright.
 */
export function sopViolationColumns(alias: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}id, ${prefix}tenant_id, ${prefix}staff_id, ${prefix}staff_name, ${prefix}category,
    ${prefix}is_serious, ${prefix}description, ${prefix}sanction_note, ${prefix}occurred_at, ${prefix}recorded_by,
    ${prefix}status, ${prefix}discipline_step, ${prefix}confirmed_by, ${prefix}confirmed_at,
    ${prefix}applied_by, ${prefix}applied_at, ${prefix}appeal_explanation, ${prefix}audit_log_id,
    ${prefix}closed_at, ${prefix}created_at, ${prefix}updated_at`;
}
