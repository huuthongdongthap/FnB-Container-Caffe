import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerAuthHandlers } from './auth-handlers';
import { registerStaffHandlers } from './staff-handlers';
import { registerDeviceHandlers } from './device-handlers';

export const authRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to protected routes only (exact path match, never endsWith)
const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/bootstrap-owner',
]);
authRoutes.use('/api/auth/*', async (c, next) => {
  const rawPath = c.req.path;
  const normalizedPath = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  if (PUBLIC_AUTH_PATHS.has(normalizedPath)) {
    return next();
  }
  return requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'kitchen', 'barista', 'chef', 'cashier', 'shipper', 'customer'])(c, next);
});

// Register all handler groups
registerAuthHandlers(authRoutes);
registerStaffHandlers(authRoutes);
registerDeviceHandlers(authRoutes);

export default authRoutes;
