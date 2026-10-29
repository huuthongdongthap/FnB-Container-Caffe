/**
 * The shapes that tie a checklist to the shift it is being run in.
 *
 * Split out of `sop.ts` so that file stays under the 200-line ceiling; the same
 * reason the admin and violation schemas live apart. Only `sop.ts` imports from
 * here — the DOM order mirrors `sop.ts` → `sop-admin.ts`, so nothing cycles.
 */

import { z } from '@hono/zod-openapi';
import { DateTimeSchema } from './common';
import { SopShiftTypeEnum } from './sop-enums';

/**
 * Why this template matched — or why none did.
 *
 * `not_clocked_in` is the operator's state, not a policy outcome: the template
 * set is unchanged, but there is no open shift to record a shift-bound
 * checklist against, so the suggestion is withheld rather than left unlinked.
 */
export const SopTemplateReasonSchema = z
  .enum([
    'shift_template',
    'deep_clean_due',
    'inventory_audit_due',
    'not_clocked_in',
    'none_applicable',
  ])
  .openapi('SopTemplateReason');

/** The open shift a checklist is being recorded against, resolved server-side. */
export const SopOpenShiftSchema = z
  .object({
    id: z.string().min(1),
    clockIn: DateTimeSchema,
    /** Which shift the clock-in falls in, on the store's clock. */
    shiftType: SopShiftTypeEnum,
  })
  .openapi('SopOpenShift');
