/**
 * Dindin (AURA Cafe Menu Ordering) validators
 */

import { z } from 'zod';

export const dindinCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'sessionId là bắt buộc'),
  payment_method: z.enum(['cod', 'payos'])
});
