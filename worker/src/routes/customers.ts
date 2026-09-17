/**
 * Customers Routes — /api/customers barrel re-export
 * Split into worker/src/routes/customers-handlers/
 * - types.ts: CustomerRecord, SEGMENTS, PROFILE_SQL
 * - profile-handlers.ts: GET /me, PATCH /me
 * - admin-handlers.ts: GET /segments, GET /
 * - routes.ts: Router initialization and route composition
 * - index.ts: Barrel export
 */

import { customersRouter } from './customers-handlers';

export {
  customersRouter,
  SEGMENTS,
  PROFILE_SQL
} from './customers-handlers';

export type { CustomerRecord } from './customers-handlers';

export default customersRouter;
