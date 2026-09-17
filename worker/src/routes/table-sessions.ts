/**
 * Table Sessions Routes — /api/table-sessions barrel re-export
 * Split into worker/src/routes/table-sessions-handlers/
 * - types.ts: TableSession, OpenSessionInput, CloseSessionInput, SESSION_STATUSES, makeSessionId
 * - session-handlers.ts: List, get, open, patch table sessions
 * - order-handlers.ts: Attach order to session, list orders in session
 * - routes.ts: Router initialization and route composition
 * - index.ts: Barrel export
 */

import { tableSessionsRouter } from './table-sessions-handlers';

export {
  tableSessionsRouter,
  SESSION_STATUSES,
  makeSessionId
} from './table-sessions-handlers';

export type {
  TableSession,
  OpenSessionInput,
  CloseSessionInput
} from './table-sessions-handlers';

export default tableSessionsRouter;
