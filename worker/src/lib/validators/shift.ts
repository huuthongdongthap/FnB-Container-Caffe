/**
 * Staff shift validators
 */

import { z } from 'zod';

export const clockInSchema = z.object({
  staff_id: z.string().min(1, 'staff_id là bắt buộc'),
  staff_name: z.string().optional(),
  notes: z.string().optional()
});

export const clockOutSchema = z.object({
  staff_id: z.string().min(1, 'staff_id là bắt buộc')
});