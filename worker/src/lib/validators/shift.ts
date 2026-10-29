/** Client names are accepted for compatibility; D1 supplies the stored identity. */
import { z } from 'zod';
const staffId = z.string().trim().min(1, 'staff_id là bắt buộc').max(100);
export const clockInSchema = z.object({
  staff_id: staffId,
  staff_name: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});
export const clockOutSchema = z.object({ staff_id: staffId });
