/**
 * Compatibility re-export shim.
 * utils/logger.ts → middleware/logger.ts
 * Preserved so routes can still import from '../utils/logger.js'.
 */
export { createLogger, newRequestId } from '../middleware/logger';
