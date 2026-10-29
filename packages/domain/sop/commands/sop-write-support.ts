/**
 * Helpers shared by the SOP write repositories.
 *
 * The run lifecycle is spread over two files (start, and the tick/complete/
 * abandon mutations). The accessors and the policy-error mapper they both need
 * live here so neither file has to import the other.
 */

import type { SopRun, SopTemplateItem } from '../model/sop-types';
import { assertActorOrManager, SopAccessError } from './sop-access';

export function nowIso(): string {
  return new Date().toISOString();
}

export function runItemId(runId: string, templateItemId: string): string {
  return `${runId}:${templateItemId}`;
}

/** The rule a tick was judged against, taken from the version the run pinned. */
export function templateItemOf(run: SopRun, templateItemId: string): SopTemplateItem {
  const rule = run.templateItems?.find((item) => item.id === templateItemId);
  if (!rule) throw new SopAccessError('Checklist item not found', 404);
  return rule;
}

export function templateItemsOf(run: SopRun): SopTemplateItem[] {
  return run.templateItems ?? [];
}

/** Maps a policy refusal code onto the message the route should surface. */
export function mapPolicyError(code: string): string {
  switch (code) {
    case 'run_immutable':
      return 'This checklist is already closed';
    case 'critical_items_incomplete':
      return 'Every required step must be ticked first';
    case 'missing_required_detail':
      return 'A ticked step is missing its measurement or note';
    case 'reason_required':
      return 'A reason is required to abandon a checklist';
    case 'template_not_executable':
      return 'This checklist has no steps to run';
    default:
      return 'Checklist could not be updated';
  }
}

export { assertActorOrManager };
