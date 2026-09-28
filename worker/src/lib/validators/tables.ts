/**
 * Table management validators
 */

import { z } from 'zod';

export const updateTableStatusSchema = z.object({
  status: z.enum(['Available', 'Occupied', 'Reserved', 'Overdue'])
});