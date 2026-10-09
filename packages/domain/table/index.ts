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
export type {
  TablePhysicalStatus,
  ReservationLifecycleStatus,
  CanonicalTable,
  CanonicalReservation,
  CreateReservationPolicyInput,
  SeatTableInput,
  ReleaseTableInput,
  AvailabilityQuery,
} from './src/model/table-reservation-types';
export {
  validateOrderTable,
  checkTableAvailability,
} from './src/policies/table-availability-policy';
export {
  createCanonicalReservation,
  updateReservationStatus,
  seatTable,
  releaseTable,
} from './src/policies/table-reservation-policy';
