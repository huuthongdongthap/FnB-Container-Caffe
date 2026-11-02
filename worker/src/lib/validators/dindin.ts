/**
 * Dindin (AURA Cafe Menu Ordering) validators
 */

import { z } from 'zod';

export const DINDIN_SESSION_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;

export const dindinCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'sessionId là bắt buộc').max(128).regex(DINDIN_SESSION_ID_RE, 'sessionId không hợp lệ'),
  payment_method: z.enum(['cod', 'payos'])
});
