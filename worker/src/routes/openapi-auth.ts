/**
 * Auth OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-auth-handlers/
 * - routes.ts: Hono route handlers
 * - helpers.ts: Crypto helpers (hashPassword, verifyPassword, generateToken)
 * - index.ts: Barrel export
 */

import { authRoutes } from './openapi-auth-handlers';

export { authRoutes, authRoutes as openApiAuthRouter } from './openapi-auth-handlers';
export * from './openapi-auth-handlers';
export default authRoutes;
