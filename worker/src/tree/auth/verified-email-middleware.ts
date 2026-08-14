/** Verified-email middleware — rejects if user.email_verified !== 1 */

import { createLogger } from '../../middleware/logger';
import type { MiddlewareHandler } from 'hono';

const log = createLogger({ route: 'verified-email' });

export const requireVerifiedEmail: MiddlewareHandler = async (c, next) => {
  const user = c.get('user') as { email_verified?: number } | undefined;

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Vui lòng đăng nhập' }, 401);
  }

  if (user.email_verified !== 1) {
    log.warn('Unverified user attempted protected action', { userId: (user as Record<string, unknown>).id });
    return c.json(
      {
        error: 'email_not_verified',
        message: 'Vui lòng xác thực email trước khi tiếp tục. Kiểm tra hộp thư của bạn.',
        verifyEndpoint: '/api/auth/verify-email'
      },
      403
    );
  }

  await next();
};
