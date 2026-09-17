/**
 * Admin Audit Log Routes — /api/admin/audit-logs barrel re-export
 * Split into worker/src/routes/admin-audit-logs-handlers/
 * - types.ts: PaginatedResponse, AuditLogRow, AuditLogQueryParams, CSV_HEADERS
 * - csv-helper.ts: escapeCsv
 * - query-handler.ts: GET /audit-logs query endpoint
 * - export-handler.ts: GET /audit-logs/export CSV endpoint
 * - routes.ts: Router setup + registerAuditLogRoutes
 * - index.ts: Barrel export
 */

import { adminAuditLogsRouter, registerAuditLogRoutes } from './admin-audit-logs-handlers';

export { adminAuditLogsRouter, registerAuditLogRoutes } from './admin-audit-logs-handlers';
export { registerQueryHandler } from './admin-audit-logs-handlers';
export { registerExportHandler } from './admin-audit-logs-handlers';
export * from './admin-audit-logs-handlers';

export default adminAuditLogsRouter;