/**
 * Compatibility re-export shim.
 * utils/logger.js → middleware/logger.ts
 * Preserved so unconverted JS routes can still import from '../utils/logger.js'.
 */
export { createLogger, newRequestId } from '../middleware/logger';
