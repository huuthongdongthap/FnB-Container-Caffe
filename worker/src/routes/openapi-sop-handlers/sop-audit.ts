/**
 * Audit writes for the SOP surfaces.
 *
 * A completed checklist and a closed conduct file are both compliance
 * evidence, so the trail is part of the write rather than a separate report a
 * reader reconstructs. The three shapes below mirror the ladder the domain
 * policy owns: `sop_run` for checklist execution and `sop_violation` for a
 * breach, which is the pair an owner filters the register by.
 *
 * Writes are best-effort: the caller's action has already succeeded, and
 * failing the request over the log would leave the action undone but the staff
 * member blamed for it. `writeCanonicalAuditLog` already carries the three
 * schema fallbacks this worker's `audit_logs` table has gone through.
 */

import { writeCanonicalAuditLog, type AuditActor } from '@aura/domain-audit';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { D1Database } from '@cloudflare/workers-types';

/** What a checklist action did, named so the register reads as a sentence. */
export type SopRunAction = 'sop_run.started' | 'sop_run.item_checked' | 'sop_run.completed' | 'sop_run.abandoned';

/** Authoring the checklist the floor executes. */
export type SopTemplateAction = 'sop_template.created' | 'sop_template.updated';

/** Ladder transitions, one per rung, so a closed file shows its full history. */
export type SopViolationAction =
  | 'sop_violation.recorded'
  | 'sop_violation.confirmed'
  | 'sop_violation.applied'
  | 'sop_violation.appealed'
  | 'sop_violation.closed';

export type SopAuditAction = SopRunAction | SopTemplateAction | SopViolationAction;

/**
 * The session cast into the shape the shared audit writer expects. Both SOP
 * surfaces build the actor the same way, so this lives here rather than being
 * written twice.
 */
export function auditActor(c: Context<{ Bindings: Env }>): AuditActor {
  const user = c.get('user') as { id: string; name?: string; role?: string; tenantId?: string } | undefined;
  return {
    id: String(user?.id ?? ''),
    name: user?.name ?? user?.id ?? '',
    role: String(user?.role ?? 'staff'),
    tenantId: user?.tenantId,
    operatingUnitId: undefined,
  };
}

interface AuditInput {
  db: D1Database;
  actor: AuditActor;
  action: SopAuditAction;
  resourceId: string;
  /** Small, non-sensitive facts: which item, which step, why it was abandoned. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Records one SOP action. Never throws — see the module note on why the log
 * must not be able to fail the request that preceded it.
 */
export async function auditSopAction(input: AuditInput): Promise<void> {
  const resourceType = input.action.startsWith('sop_violation') ? 'sop_violation' : 'sop_run';
  try {
    await writeCanonicalAuditLog(input.db, {
      actor: input.actor,
      action: input.action,
      resourceType,
      resourceId: input.resourceId,
      tenantId: input.actor.tenantId,
      outcome: 'success',
      metadata: input.metadata ?? null,
    });
  } catch {
    // Best-effort: the action itself already landed, and refusing the request
    // here would tell the staff member their tick failed when it did not.
  }
}
