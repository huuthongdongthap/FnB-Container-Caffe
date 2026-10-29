/**
 * SOP enums and the shared item shape — the base of the SOP schema tree.
 *
 * These live apart from `sop.ts` so the admin-only and violation files can
 * import them without a cycle: `sop.ts` re-exports those two, so importing
 * `sop.ts` from them would leave the barrel half-initialised at the moment a
 * file-level `.omit()` runs. A cycle here does not fail the typecheck — it
 * fails at request time with a `Cannot read properties of undefined` from
 * whichever module lost the race.
 */

import { z } from '@hono/zod-openapi';

export const SopSourceEnum = z
  .enum(['SOP00', 'SOP01', 'SOP06', 'SOP09'])
  .openapi('SopSource', { description: 'Paper SOP document the template was transcribed from' });

export const SopShiftTypeEnum = z
  .enum(['a', 'b', 'c', 'any'])
  .openapi('SopShiftType', { description: "Shift a template belongs to; 'any' means not shift-bound" });

export const SopRunStatusEnum = z
  .enum(['in_progress', 'completed', 'abandoned'])
  .openapi('SopRunStatus', { description: 'Lifecycle state of one checklist run' });

export const SopViolationStatusEnum = z
  .enum(['recorded', 'confirmed', 'applied', 'appealed', 'closed'])
  .openapi('SopViolationStatus', { description: 'Where a conduct breach sits on the approval ladder' });

export const SopViolationCategoryEnum = z
  .enum(['time', 'conduct', 'assets_finance', 'secrets', 'stimulants', 'workspace'])
  .openapi('SopViolationCategory', { description: 'Prohibited-conduct group from SOP 09 §2' });

export const SopDisciplineStepEnum = z
  .enum(['none', 'written_warning', 'fine', 'termination'])
  .openapi('SopDisciplineStep', { description: 'Discipline ladder step, in escalating order' });

export const SopTemplateItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().nullable(),
    /** Item must carry a numeric measurement before the run can complete. */
    requireValue: z.boolean(),
    /** Item must carry a free-text note before the run can complete. */
    requireNote: z.boolean(),
    orderIndex: z.number().int().nonnegative(),
    /** A critical item blocks completion while unchecked. */
    isCritical: z.boolean(),
  })
  .openapi('SopTemplateItem');
