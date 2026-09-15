/**
 * @aura/domain-table — Tables surface
 * Extracted from worker/src/routes/tables.ts.
 */
export { tablesRouter } from './commands/tables';
export { qrRouter } from './commands/qr-scan';
export {
  TABLE_STATUSES,
  TABLE_STATUS_TRANSITIONS,
  canTransitionTo,
} from './policies/status';
export type { TableStatus } from './policies/status';
export type { CafeTable, QrCodeRow } from './model/table-types';
