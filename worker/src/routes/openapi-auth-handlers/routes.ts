import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerAuthHandlers } from './auth-handlers';
import { registerStaffHandlers } from './staff-handlers';
import { registerDeviceHandlers } from './device-handlers';

export const authRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to protected routes only
const publicPaths = ['/register', '/login', '/verify-email', '/reset-password', '/bootstrap-owner'];
authRoutes.use('*', async (c, next) => {
  const path = c.req.path;
  if (publicPaths.some(p => path.endsWith(p))) {
    return next();
  }
  return requireAuth(['owner', 'manager', 'staff'])(c, next);
});

// Register all handler groups
registerAuthHandlers(authRoutes);
registerStaffHandlers(authRoutes);
registerDeviceHandlers(authRoutes);

export default authRoutes;