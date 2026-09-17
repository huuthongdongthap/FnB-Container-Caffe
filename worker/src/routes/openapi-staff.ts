/**
 * Staff OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-staff-handlers/
 * - routes.ts: Hono route router and middleware
 * - staff-handlers.ts: Staff CRUD and hashPassword helper
 * - shift-handlers.ts: Shift management CRUD
 * - attendance-handlers.ts: Check-in, check-out, and attendance history
 * - index.ts: Barrel export
 */

import { openApiStaffRouter } from './openapi-staff-handlers';

export { openApiStaffRouter } from './openapi-staff-handlers';
export default openApiStaffRouter;
