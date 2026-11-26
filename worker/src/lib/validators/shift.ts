/** Client names are accepted for compatibility; D1 supplies the stored identity. */
import { z } from 'zod';
const staffId = z.string().trim().min(1, 'staff_id là bắt buộc').max(100);
const optionalShiftRef = z.union([z.string().trim().min(1).max(100), z.number().int().positive()]).optional();
export const clockInSchema = z.object({
  staff_id: staffId,
  staff_name: z.string().max(100).optional(),
  opening_cash: z.number().finite().min(0).optional(),
  openingCash: z.number().finite().min(0).optional(),
  scheduled_shift_id: optionalShiftRef,
  shift_id: optionalShiftRef,
  notes: z.string().max(500).optional(),
});
export const clockOutSchema = z.object({
  staff_id: staffId,
  shift_id: optionalShiftRef,
  attendance_id: optionalShiftRef,
  notes: z.string().max(500).optional(),
});
